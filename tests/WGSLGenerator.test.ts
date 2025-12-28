import { describe, it, expect, beforeEach } from 'vitest';
import { Node } from '../src/domain/entities/Node';
import { Connection } from '../src/domain/entities/Connection';
import { Socket } from '../src/domain/entities/Socket';
import { NodeId, SocketId, ConnectionId } from '../src/domain/value-objects/Id';
import { Position } from '../src/domain/value-objects/Position';
import { WGSLGenerator } from '../src/infrastructure/shader/WGSLGenerator';
import { nodeDefinitionLoader } from '../src/nodes/NodeDefinitionLoader';
import type { SocketType, SocketDirection } from '../src/domain/value-objects/SocketType';

// Helper to create a node from definition
function createNode(definitionId: string, nodeIdStr: string): Node {
  const def = nodeDefinitionLoader.getDefinition(definitionId);
  if (!def) {
    throw new Error(`Definition not found: ${definitionId}`);
  }
  
  const nodeId = new NodeId(nodeIdStr);
  const position = new Position(0, 0);
  
  const inputs: Socket[] = def.inputs.map((input, i) => 
    new Socket(
      new SocketId(`${nodeIdStr}_input_${i}`),
      nodeId,
      input.name,
      input.type as SocketType,
      'input' as SocketDirection,
      input.default
    )
  );
  
  const outputs: Socket[] = def.outputs.map((output, i) =>
    new Socket(
      new SocketId(`${nodeIdStr}_output_${i}`),
      nodeId,
      output.name,
      output.type as SocketType,
      'output' as SocketDirection
    )
  );
  
  // Initialize default values
  const values: Record<string, number | number[]> = {};
  for (const input of def.inputs) {
    if (input.default !== undefined) {
      values[input.name] = input.default;
    }
  }
  
  return new Node(nodeId, definitionId, position, inputs, outputs, values);
}

// Helper to create a connection
function createConnection(
  connId: string,
  fromNode: Node,
  fromSocketIdx: number,
  toNode: Node,
  toSocketIdx: number
): Connection {
  return new Connection(
    new ConnectionId(connId),
    fromNode.id,
    fromNode.outputs[fromSocketIdx].id,
    toNode.id,
    toNode.inputs[toSocketIdx].id
  );
}

describe('WGSLGenerator', () => {
  let generator: WGSLGenerator;

  beforeEach(() => {
    generator = new WGSLGenerator();
  });

  describe('UV -> SeparateXY -> CombineXYZ -> Output', () => {
    it('should generate valid WGSL code', () => {
      // Create nodes
      const uvNode = createNode('input_uv', 'node_1');
      const separateNode = createNode('vec_separate2', 'node_2');
      const combineNode = createNode('vec_combine3', 'node_3');
      const outputNode = createNode('output_color', 'node_4');

      const nodes = [uvNode, separateNode, combineNode, outputNode];

      // Create connections
      const connections = [
        createConnection('conn_1', uvNode, 0, separateNode, 0),
        createConnection('conn_2', separateNode, 0, combineNode, 0),
        createConnection('conn_3', separateNode, 1, combineNode, 1),
        createConnection('conn_4', combineNode, 0, outputNode, 0),
      ];

      // Generate shader
      const result = generator.generate(nodes, connections);
      
      console.log('=== Generated WGSL Shader ===');
      console.log(result);
      
      // Verify the shader contains expected elements
      expect(result).toContain('fn node_1()');
      expect(result).toContain('fn node_2_x(');
      expect(result).toContain('fn node_2_y(');
      expect(result).toContain('fn node_3(');
      expect(result).toContain('return finalColor');
    });
  });
});
