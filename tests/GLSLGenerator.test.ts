import { describe, it, expect, beforeEach } from 'vitest';
import { Node } from '../src/domain/entities/Node';
import { Connection } from '../src/domain/entities/Connection';
import { Socket } from '../src/domain/entities/Socket';
import { NodeId, SocketId, ConnectionId } from '../src/domain/value-objects/Id';
import { Position } from '../src/domain/value-objects/Position';
import { GLSLGenerator } from '../src/infrastructure/shader/GLSLGenerator';
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

describe('GLSLGenerator', () => {
  let generator: GLSLGenerator;

  beforeEach(() => {
    generator = new GLSLGenerator();
  });

  describe('UV -> SeparateXY -> CombineXYZ -> Output', () => {
    it('should generate valid GLSL code', () => {
      // Create nodes
      const uvNode = createNode('input_uv', 'node_1');
      const separateNode = createNode('vec_separate2', 'node_2');
      const combineNode = createNode('vec_combine3', 'node_3');
      const outputNode = createNode('output_color', 'node_4');

      const nodes = [uvNode, separateNode, combineNode, outputNode];

      // Create connections:
      // UV.UV -> SeparateXY.Vector
      // SeparateXY.X -> CombineXYZ.X
      // SeparateXY.Y -> CombineXYZ.Y
      // CombineXYZ.Vector -> Output.Color
      const connections = [
        createConnection('conn_1', uvNode, 0, separateNode, 0),
        createConnection('conn_2', separateNode, 0, combineNode, 0), // X -> X
        createConnection('conn_3', separateNode, 1, combineNode, 1), // Y -> Y
        createConnection('conn_4', combineNode, 0, outputNode, 0),   // Vector -> Color
      ];

      // Generate shader
      const result = generator.generate(nodes, connections);
      
      // Parse JSON result
      const shaders = JSON.parse(result);
      
      // Verify the shader contains expected elements
      expect(shaders.fragment).toContain('vec2 node_1()');
      expect(shaders.fragment).toContain('float node_2_x(vec2');
      expect(shaders.fragment).toContain('float node_2_y(vec2');
      expect(shaders.fragment).toContain('vec3 node_3(float');
      expect(shaders.fragment).toContain('fragColor = finalColor');
      
      // Verify float literals have decimal points
      expect(shaders.fragment).not.toMatch(/node_3\([^)]*[^0-9.]\b0\b[^.]/);
    });

    it('should generate correct variable assignments in main()', () => {
      const uvNode = createNode('input_uv', 'node_1');
      const separateNode = createNode('vec_separate2', 'node_2');
      const combineNode = createNode('vec_combine3', 'node_3');
      const outputNode = createNode('output_color', 'node_4');

      const nodes = [uvNode, separateNode, combineNode, outputNode];

      const connections = [
        createConnection('conn_1', uvNode, 0, separateNode, 0),
        createConnection('conn_2', separateNode, 0, combineNode, 0),
        createConnection('conn_3', separateNode, 1, combineNode, 1),
        createConnection('conn_4', combineNode, 0, outputNode, 0),
      ];

      const result = generator.generate(nodes, connections);
      const shaders = JSON.parse(result);
      
      // Extract main() body
      const mainMatch = shaders.fragment.match(/void main\(\)\s*\{([\s\S]*)\}/);
      expect(mainMatch).toBeTruthy();
      
      const mainBody = mainMatch![1];
      
      // Check for proper variable declarations and function calls
      // The order should be: UV -> Separate -> Combine -> Output
      expect(mainBody).toContain('node_1()');
      expect(mainBody).toContain('node_2_x(');
      expect(mainBody).toContain('node_2_y(');
      expect(mainBody).toContain('node_3(');
      expect(mainBody).toContain('finalColor');
    });
  });

  describe('Default shader', () => {
    it('should generate valid default shader when no output node', () => {
      const uvNode = createNode('input_uv', 'node_1');
      const nodes = [uvNode];
      const connections: Connection[] = [];

      const result = generator.generate(nodes, connections);
      const shaders = JSON.parse(result);
      
      expect(shaders.vertex).toContain('#version 300 es');
      expect(shaders.fragment).toContain('#version 300 es');
      expect(shaders.fragment).toContain('fragColor');
    });
  });

  describe('Float literal formatting', () => {
    it('should format integer 0 as 0.0', () => {
      const combineNode = createNode('vec_combine3', 'node_1');
      const outputNode = createNode('output_color', 'node_2');

      const nodes = [combineNode, outputNode];

      // Only connect combine output to output color (X, Y, Z will use defaults)
      const connections = [
        createConnection('conn_1', combineNode, 0, outputNode, 0),
      ];

      const result = generator.generate(nodes, connections);
      const shaders = JSON.parse(result);
      
      // All default values should have decimal points
      // node_3(0.0, 0.0, 0.0) not node_3(0, 0, 0)
      expect(shaders.fragment).toMatch(/node_1\(0\.0,\s*0\.0,\s*0\.0\)/);
    });
  });

  describe('Realistic node IDs (like actual app)', () => {
    it('should work with timestamp-based node IDs', () => {
      // Simulate actual app node IDs
      const uvNode = createNode('input_uv', 'node_1733123456789_abc123');
      const separateNode = createNode('vec_separate2', 'node_1733123456790_def456');
      const combineNode = createNode('vec_combine3', 'node_1733123456791_ghi789');
      const outputNode = createNode('output_color', 'node_1733123456792_jkl012');

      const nodes = [uvNode, separateNode, combineNode, outputNode];

      const connections = [
        createConnection('conn_1', uvNode, 0, separateNode, 0),
        createConnection('conn_2', separateNode, 0, combineNode, 0),
        createConnection('conn_3', separateNode, 1, combineNode, 1),
        createConnection('conn_4', combineNode, 0, outputNode, 0),
      ];

      const result = generator.generate(nodes, connections);
      const shaders = JSON.parse(result);
      
      // Verify shader is valid
      expect(shaders.fragment).toContain('void main()');
      expect(shaders.fragment).toContain('fragColor = finalColor');
      
      // Verify node functions are generated with correct IDs
      expect(shaders.fragment).toContain('node_1733123456789_abc123');
      expect(shaders.fragment).toContain('node_1733123456790_def456_x');
      expect(shaders.fragment).toContain('node_1733123456790_def456_y');
      expect(shaders.fragment).toContain('node_1733123456791_ghi789');
    });
  });

  describe('Direct UV to Output', () => {
    it('should work with UV -> CombineXYZ -> Output (no SeparateXY)', () => {
      const uvNode = createNode('input_uv', 'node_1');
      const separateNode = createNode('vec_separate2', 'node_2');
      const combineNode = createNode('vec_combine3', 'node_3');
      const outputNode = createNode('output_color', 'node_4');

      const nodes = [uvNode, separateNode, combineNode, outputNode];

      // Connect UV.X and UV.Y through Separate to Combine
      const connections = [
        createConnection('conn_1', uvNode, 0, separateNode, 0),
        createConnection('conn_2', separateNode, 0, combineNode, 0), // X
        createConnection('conn_3', separateNode, 1, combineNode, 1), // Y
        // Z is not connected - should use default 0.0
        createConnection('conn_4', combineNode, 0, outputNode, 0),
      ];

      const result = generator.generate(nodes, connections);
      const shaders = JSON.parse(result);
      
      // Check that the generated code compiles (no syntax errors)
      // This checks that all float literals are properly formatted
      const mainBody = shaders.fragment.match(/void main\(\)\s*\{([\s\S]*)\}/)?.[1] || '';
      
      // Should not have bare integers where floats are expected
      // Look for patterns like "0)" or "0," that should be "0.0)" or "0.0,"
      const bareIntegerPattern = /\b(\d+)(?=[,\)])/g;
      const matches = mainBody.match(bareIntegerPattern);
      
      // All integers should have decimal points
      if (matches) {
        for (const match of matches) {
          // Should be formatted as float
          expect(mainBody).not.toContain(`(${match})`);
          expect(mainBody).not.toContain(`, ${match})`);
        }
      }
    });
  });
});
