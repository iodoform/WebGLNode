import { Node } from '../../domain/entities/Node';
import { Connection } from '../../domain/entities/Connection';
import { SocketType } from '../../domain/value-objects/SocketType';
import { nodeDefinitionLoader } from '../../nodes/NodeDefinitionLoader';
import type { NodeDefinition } from '../../types';

/**
 * WGSLシェーダー生成器
 * 
 * ドメインエンティティ（Node、Connection）からWGSLシェーダーコードを生成します。
 * ノードグラフを解析し、適切な関数呼び出しと変数宣言を生成します。
 */
interface GenerationContext {
  nodes: Map<string, Node>;
  connections: Map<string, Connection>;
  processedNodes: Set<string>;
  functionCode: string[];
  variableDeclarations: string[];
  variableCounter: number;
  nodeOutputVars: Map<string, Map<string, string>>; // nodeId -> outputName -> varName
}

export class WGSLGenerator {
  private static typeToWGSL(type: SocketType): string {
    switch (type) {
      case 'float': return 'f32';
      case 'vec2': return 'vec2f';
      case 'vec3': return 'vec3f';
      case 'vec4': return 'vec4f';
      case 'color': return 'vec3f';
      default: return 'f32';
    }
  }

  private static getDefaultValue(type: SocketType, value?: number | number[]): string {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        switch (type) {
          case 'vec2': return `vec2f(${value[0] ?? 0}, ${value[1] ?? 0})`;
          case 'vec3': 
          case 'color': return `vec3f(${value[0] ?? 0}, ${value[1] ?? 0}, ${value[2] ?? 0})`;
          case 'vec4': return `vec4f(${value[0] ?? 0}, ${value[1] ?? 0}, ${value[2] ?? 0}, ${value[3] ?? 1})`;
          default: return String(value[0] ?? 0);
        }
      }
      return String(value);
    }
    switch (type) {
      case 'vec2': return 'vec2f(0.0, 0.0)';
      case 'vec3':
      case 'color': return 'vec3f(0.0, 0.0, 0.0)';
      case 'vec4': return 'vec4f(0.0, 0.0, 0.0, 1.0)';
      default: return '0.0';
    }
  }

  static generate(nodes: Node[], connections: Connection[]): string {
    // Convert arrays to Maps for easier lookup
    const nodesMap = new Map<string, Node>();
    const connectionsMap = new Map<string, Connection>();
    
    for (const node of nodes) {
      nodesMap.set(node.id.value, node);
    }
    
    for (const connection of connections) {
      connectionsMap.set(connection.id.value, connection);
    }

    const context: GenerationContext = {
      nodes: nodesMap,
      connections: connectionsMap,
      processedNodes: new Set(),
      functionCode: [],
      variableDeclarations: [],
      variableCounter: 0,
      nodeOutputVars: new Map(),
    };

    // Find output node
    const outputNode = nodes.find(
      n => n.definitionId === 'output_color'
    );

    if (!outputNode) {
      return this.generateDefaultShader();
    }

    // Collect all needed function definitions
    const usedDefinitions = new Set<string>();
    this.collectUsedDefinitions(outputNode, nodesMap, connectionsMap, usedDefinitions);

    // Generate function code for each used definition
    const functionDeclarations: string[] = [];
    for (const defId of usedDefinitions) {
      const def = nodeDefinitionLoader.getDefinition(defId);
      if (def && def.code) {
        // Replace {{id}} placeholder with unique identifier
        const nodesOfType = Array.from(nodesMap.values()).filter(n => n.definitionId === defId);
        for (const node of nodesOfType) {
          const code = def.code.replace(/\{\{id\}\}/g, node.id.value.replace('node_', ''));
          if (!functionDeclarations.includes(code)) {
            functionDeclarations.push(code);
          }
        }
      }
    }

    // Generate main fragment calculation
    const mainBody = this.generateNodeEvaluation(outputNode, context);

    return this.assembleShader(functionDeclarations, mainBody, context);
  }

  private static collectUsedDefinitions(
    node: Node,
    nodes: Map<string, Node>,
    connections: Map<string, Connection>,
    usedDefinitions: Set<string>
  ): void {
    usedDefinitions.add(node.definitionId);

    // Find all input connections
    for (const input of node.inputs) {
      const connection = Array.from(connections.values()).find(
        c => c.toNodeId.value === node.id.value && c.toSocketId.value === input.id.value
      );
      if (connection) {
        const sourceNode = nodes.get(connection.fromNodeId.value);
        if (sourceNode && !usedDefinitions.has(sourceNode.definitionId)) {
          this.collectUsedDefinitions(sourceNode, nodes, connections, usedDefinitions);
        }
      }
    }
  }

  private static generateNodeEvaluation(
    node: Node,
    context: GenerationContext
  ): string {
    if (context.processedNodes.has(node.id.value)) {
      return '';
    }
    context.processedNodes.add(node.id.value);

    const definition = nodeDefinitionLoader.getDefinition(node.definitionId);
    if (!definition) return '';

    const lines: string[] = [];

    // Process all input connections first
    const inputValues: string[] = [];
    for (const input of node.inputs) {
      const connection = this.findInputConnection(node.id, input.id, context.connections);
      
      if (connection) {
        const sourceNode = context.nodes.get(connection.fromNodeId.value);
        if (sourceNode) {
          // Recursively evaluate source node
          const sourceEval = this.generateNodeEvaluation(sourceNode, context);
          if (sourceEval) lines.push(sourceEval);
          
          // Get the output variable name
          const sourceOutput = sourceNode.outputs.find(o => o.id.value === connection.fromSocketId.value);
          const outputVars = context.nodeOutputVars.get(sourceNode.id.value);
          if (outputVars && sourceOutput) {
            inputValues.push(outputVars.get(sourceOutput.name) || this.getDefaultValue(input.type));
          } else {
            inputValues.push(this.getDefaultValue(input.type));
          }
        }
      } else {
        // Use node's stored value or default
        const value = node.getValue(input.name);
        inputValues.push(this.getDefaultValue(input.type, value));
      }
    }

    // Handle output node specially
    if (node.definitionId === 'output_color') {
      const colorValue = inputValues[0] || 'vec3f(0.0)';
      const alphaValue = inputValues[1] || '1.0';
      lines.push(`  let finalColor = vec4f(${colorValue}, ${alphaValue});`);
      return lines.join('\n');
    }

    // Generate output variables for this node
    const nodeId = node.id.value.replace('node_', '');
    const outputVars = new Map<string, string>();
    context.nodeOutputVars.set(node.id.value, outputVars);

    // Special handling for color picker node
    if (definition.customUI === 'colorPicker') {
      const output = definition.outputs[0];
      const varName = `v${++context.variableCounter}`;
      outputVars.set(output.name, varName);
      
      const colorValue = node.getValue('_color') as number[] || [1, 1, 1];
      const colorStr = `vec3f(${colorValue[0].toFixed(4)}, ${colorValue[1].toFixed(4)}, ${colorValue[2].toFixed(4)})`;
      lines.push(`  let ${varName}: vec3f = ${colorStr};`);
      return lines.join('\n');
    }

    if (definition.outputs.length === 1) {
      // Single output - simple function call
      const output = definition.outputs[0];
      const varName = `v${++context.variableCounter}`;
      outputVars.set(output.name, varName);
      
      const funcCall = `node_${nodeId}(${inputValues.join(', ')})`;
      lines.push(`  let ${varName}: ${this.typeToWGSL(output.type)} = ${funcCall};`);
    } else if (definition.outputs.length > 1) {
      // Multiple outputs - call separate functions for each
      for (const output of definition.outputs) {
        const varName = `v${++context.variableCounter}`;
        outputVars.set(output.name, varName);
        
        const funcName = `node_${nodeId}_${output.name.toLowerCase()}`;
        const funcCall = `${funcName}(${inputValues.join(', ')})`;
        lines.push(`  let ${varName}: ${this.typeToWGSL(output.type)} = ${funcCall};`);
      }
    }

    return lines.join('\n');
  }

  private static findInputConnection(
    nodeId: Node['id'],
    socketId: { value: string },
    connections: Map<string, Connection>
  ): Connection | undefined {
    return Array.from(connections.values()).find(
      c => c.toNodeId.value === nodeId.value && c.toSocketId.value === socketId.value
    );
  }

  private static assembleShader(
    functions: string[],
    mainBody: string,
    _context: GenerationContext
  ): string {
    return `// Generated WGSL Shader
struct Uniforms {
  time: f32,
  resolution: vec2f,
  mouse: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0)
  );
  
  var output: VertexOutput;
  output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  output.uv = pos[vertexIndex] * 0.5 + 0.5;
  return output;
}

// Node functions
${functions.join('\n\n')}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let uv = input.uv;
  
${mainBody}
  
  return finalColor;
}
`;
  }

  private static generateDefaultShader(): string {
    return `// Default WGSL Shader
struct Uniforms {
  time: f32,
  resolution: vec2f,
  mouse: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0)
  );
  
  var output: VertexOutput;
  output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  output.uv = pos[vertexIndex] * 0.5 + 0.5;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return vec4f(input.uv, 0.5 + 0.5 * sin(uniforms.time), 1.0);
}
`;
  }
}

