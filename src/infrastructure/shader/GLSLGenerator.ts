import { Node } from '../../domain/entities/Node';
import { Connection } from '../../domain/entities/Connection';
import { SocketType } from '../../domain/value-objects/SocketType';
import { nodeDefinitionLoader } from '../node-definitions/loader/NodeDefinitionLoader';
import { IShaderGenerator } from './IShaderGenerator';
import { RendererType } from '../types';

/**
 * GLSLシェーダー生成器
 * 
 * ドメインエンティティ（Node、Connection）からGLSLシェーダーコードを生成します。
 * WebGL2用のシェーダーを生成します。
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

export class GLSLGenerator implements IShaderGenerator {
  readonly rendererType: RendererType = 'webgl';

  private typeToGLSL(type: SocketType): string {
    switch (type) {
      case 'float': return 'float';
      case 'vec3': return 'vec3';
      case 'color': return 'vec3';
      default: return 'float';
    }
  }

  private getDefaultValue(type: SocketType, value?: number | number[]): string {
    // Helper to format number as GLSL float literal
    const toFloat = (n: number): string => {
      const s = String(n);
      return s.includes('.') ? s : s + '.0';
    };

    if (value !== undefined) {
      if (Array.isArray(value)) {
        switch (type) {
          case 'vec3': 
          case 'color': {
            // If array has 2 elements, treat as vec2 and convert to vec3 (z=0)
            if (value.length === 2) {
              return `vec3(${toFloat(value[0] ?? 0)}, ${toFloat(value[1] ?? 0)}, 0.0)`;
            }
            return `vec3(${toFloat(value[0] ?? 0)}, ${toFloat(value[1] ?? 0)}, ${toFloat(value[2] ?? 0)})`;
          }
          default: return toFloat(value[0] ?? 0);
        }
      }
      return toFloat(value);
    }
    switch (type) {
      case 'vec3':
      case 'color': return 'vec3(0.0, 0.0, 0.0)';
      default: return '0.0';
    }
  }

  generate(nodes: Node[], connections: Connection[]): string {
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
      return this.generateDefault();
    }

    // Collect all needed function definitions
    const usedDefinitions = new Set<string>();
    this.collectUsedDefinitions(outputNode, nodesMap, connectionsMap, usedDefinitions);

    // Generate function code for each used definition
    const functionDeclarations: string[] = [];
    for (const defId of usedDefinitions) {
      const def = nodeDefinitionLoader.getDefinition(defId);
      if (def && def.code) {
        const code = typeof def.code === 'string' ? '' : def.code.webgl;
        if (code) {
          // Replace {{id}} placeholder with unique identifier
          const nodesOfType = Array.from(nodesMap.values()).filter(n => n.definitionId === defId);
          for (const node of nodesOfType) {
            const processedCode = code.replace(/\{\{id\}\}/g, node.id.value.replace('node_', ''));
            if (!functionDeclarations.includes(processedCode)) {
              functionDeclarations.push(processedCode);
            }
          }
        }
      }
    }

    // Generate main fragment calculation
    const mainBody = this.generateNodeEvaluation(outputNode, context);

    return this.assembleShader(functionDeclarations, mainBody);
  }

  private collectUsedDefinitions(
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

  private generateNodeEvaluation(
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
      const colorValue = inputValues[0] || 'vec3(0.0)';
      const alphaValue = inputValues[1] || '1.0';
      lines.push(`  vec4 finalColor = vec4(${colorValue}, ${alphaValue});`);
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
      const colorStr = `vec3(${colorValue[0].toFixed(4)}, ${colorValue[1].toFixed(4)}, ${colorValue[2].toFixed(4)})`;
      lines.push(`  vec3 ${varName} = ${colorStr};`);
      return lines.join('\n');
    }

    if (definition.outputs.length === 1) {
      // Single output - simple function call
      const output = definition.outputs[0];
      const varName = `v${++context.variableCounter}`;
      outputVars.set(output.name, varName);
      
      const funcCall = `node_${nodeId}(${inputValues.join(', ')})`;
      lines.push(`  ${this.typeToGLSL(output.type)} ${varName} = ${funcCall};`);
    } else if (definition.outputs.length > 1) {
      // Multiple outputs - call separate functions for each
      for (const output of definition.outputs) {
        const varName = `v${++context.variableCounter}`;
        outputVars.set(output.name, varName);
        
        const funcName = `node_${nodeId}_${output.name.toLowerCase()}`;
        const funcCall = `${funcName}(${inputValues.join(', ')})`;
        lines.push(`  ${this.typeToGLSL(output.type)} ${varName} = ${funcCall};`);
      }
    }

    return lines.join('\n');
  }

  private findInputConnection(
    nodeId: Node['id'],
    socketId: { value: string },
    connections: Map<string, Connection>
  ): Connection | undefined {
    return Array.from(connections.values()).find(
      c => c.toNodeId.value === nodeId.value && c.toSocketId.value === socketId.value
    );
  }

  private assembleShader(
    functions: string[],
    mainBody: string
  ): string {
    const shaders = this.assembleGLSLShaders(functions, mainBody);
    return JSON.stringify(shaders);
  }

  generateDefault(): string {
    return JSON.stringify({
      vertex: `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  vec2 positions[6] = vec2[](
    vec2(-1.0, -1.0),
    vec2( 1.0, -1.0),
    vec2(-1.0,  1.0),
    vec2(-1.0,  1.0),
    vec2( 1.0, -1.0),
    vec2( 1.0,  1.0)
  );
  
  vec2 pos = positions[gl_VertexID];
  gl_Position = vec4(pos, 0.0, 1.0);
  vUv = pos * 0.5 + 0.5;
}
`,
      fragment: `#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

in vec2 vUv;
out vec4 fragColor;

void main() {
  fragColor = vec4(vUv, 0.5 + 0.5 * sin(u_time), 1.0);
}
`
    });
  }

  /**
   * シェーダーを生成してオブジェクトとして返す
   */
  generateShaders(nodes: Node[], connections: Connection[]): { vertex: string; fragment: string } {
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
      return this.generateDefaultShaders();
    }

    // Collect all needed function definitions
    const usedDefinitions = new Set<string>();
    this.collectUsedDefinitions(outputNode, nodesMap, connectionsMap, usedDefinitions);

    // Generate function code for each used definition
    const functionDeclarations: string[] = [];
    for (const defId of usedDefinitions) {
      const def = nodeDefinitionLoader.getDefinition(defId);
      if (def && def.code) {
        const code = typeof def.code === 'string' ? '' : def.code.webgl;
        if (code) {
          // Replace {{id}} placeholder with unique identifier
          const nodesOfType = Array.from(nodesMap.values()).filter(n => n.definitionId === defId);
          for (const node of nodesOfType) {
            const processedCode = code.replace(/\{\{id\}\}/g, node.id.value.replace('node_', ''));
            if (!functionDeclarations.includes(processedCode)) {
              functionDeclarations.push(processedCode);
            }
          }
        }
      }
    }

    // Generate main fragment calculation
    const mainBody = this.generateNodeEvaluation(outputNode, context);

    return this.assembleGLSLShaders(functionDeclarations, mainBody);
  }

  private assembleGLSLShaders(
    functions: string[],
    mainBody: string
  ): { vertex: string; fragment: string } {
    const vertex = `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  vec2 positions[6] = vec2[](
    vec2(-1.0, -1.0),
    vec2( 1.0, -1.0),
    vec2(-1.0,  1.0),
    vec2(-1.0,  1.0),
    vec2( 1.0, -1.0),
    vec2( 1.0,  1.0)
  );
  
  vec2 pos = positions[gl_VertexID];
  gl_Position = vec4(pos, 0.0, 1.0);
  vUv = pos * 0.5 + 0.5;
}
`;

    const fragment = `#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

in vec2 vUv;
out vec4 fragColor;

// Node functions
${functions.join('\n\n')}

void main() {
  vec2 uv = vUv;
  
${mainBody}
  
  fragColor = finalColor;
}
`;

    return { vertex, fragment };
  }

  generateDefaultShaders(): { vertex: string; fragment: string } {
    return {
      vertex: `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  vec2 positions[6] = vec2[](
    vec2(-1.0, -1.0),
    vec2( 1.0, -1.0),
    vec2(-1.0,  1.0),
    vec2(-1.0,  1.0),
    vec2( 1.0, -1.0),
    vec2( 1.0,  1.0)
  );
  
  vec2 pos = positions[gl_VertexID];
  gl_Position = vec4(pos, 0.0, 1.0);
  vUv = pos * 0.5 + 0.5;
}
`,
      fragment: `#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

in vec2 vUv;
out vec4 fragColor;

void main() {
  fragColor = vec4(vUv, 0.5 + 0.5 * sin(u_time), 1.0);
}
`
    };
  }
}
