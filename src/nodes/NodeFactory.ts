import type { Node, Socket, NodeDefinition, SocketDirection } from '../types';
import { nodeDefinitionLoader } from './NodeDefinitionLoader';

let nodeIdCounter = 0;
let socketIdCounter = 0;

function generateNodeId(): string {
  return `node_${++nodeIdCounter}`;
}

function generateSocketId(): string {
  return `socket_${++socketIdCounter}`;
}

export class NodeFactory {
  static createNode(definitionId: string, x: number, y: number): Node | null {
    const definition = nodeDefinitionLoader.getDefinition(definitionId);
    if (!definition) {
      console.error(`Node definition not found: ${definitionId}`);
      return null;
    }

    const nodeId = generateNodeId();
    const inputs = this.createSockets(definition, nodeId, 'input');
    const outputs = this.createSockets(definition, nodeId, 'output');
    
    // Initialize default values
    const values: Record<string, number | number[]> = {};
    for (const input of definition.inputs) {
      values[input.name] = input.default ?? 0;
    }

    return {
      id: nodeId,
      definitionId,
      x,
      y,
      inputs,
      outputs,
      values,
    };
  }

  private static createSockets(
    definition: NodeDefinition,
    nodeId: string,
    direction: SocketDirection
  ): Socket[] {
    const socketDefs = direction === 'input' ? definition.inputs : definition.outputs;
    
    return socketDefs.map(socketDef => ({
      id: generateSocketId(),
      nodeId,
      name: socketDef.name,
      type: socketDef.type,
      direction,
      value: socketDef.default,
    }));
  }

  static cloneNode(node: Node, offsetX = 50, offsetY = 50): Node {
    const newNodeId = generateNodeId();
    
    return {
      id: newNodeId,
      definitionId: node.definitionId,
      x: node.x + offsetX,
      y: node.y + offsetY,
      inputs: node.inputs.map(socket => ({
        ...socket,
        id: generateSocketId(),
        nodeId: newNodeId,
        connectedTo: undefined,
      })),
      outputs: node.outputs.map(socket => ({
        ...socket,
        id: generateSocketId(),
        nodeId: newNodeId,
        connectedTo: undefined,
      })),
      values: { ...node.values },
    };
  }
}

