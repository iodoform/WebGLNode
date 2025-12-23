import { Node } from '../entities/Node';
import { Socket } from '../entities/Socket';
import { NodeId } from '../value-objects/Id';
import { SocketId } from '../value-objects/Id';
import { Position } from '../value-objects/Position';
import type { SocketType, SocketDirection } from '../value-objects/SocketType';
import type { NodeDefinition, SocketDefinition } from '../../types';

/**
 * ノードファクトリサービス
 * 
 * ノード定義からノードエンティティを作成します。
 */
export class NodeFactory {
  /**
   * ノード定義からノードエンティティを作成
   */
  static create(
    definition: NodeDefinition,
    position: Position
  ): Node {
    const nodeId = new NodeId(`node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    
    const inputs = this.createSockets(definition.inputs, nodeId, 'input');
    const outputs = this.createSockets(definition.outputs, nodeId, 'output');
    
    // デフォルト値を初期化
    const values: Record<string, number | number[]> = {};
    for (const input of definition.inputs) {
      values[input.name] = input.default ?? 0;
    }

    return new Node(
      nodeId,
      definition.id,
      position,
      inputs,
      outputs,
      values
    );
  }

  /**
   * ソケット定義からソケットエンティティの配列を作成
   */
  private static createSockets(
    socketDefs: SocketDefinition[],
    nodeId: NodeId,
    direction: SocketDirection
  ): Socket[] {
    return socketDefs.map(socketDef => {
      const socketId = new SocketId(`socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      return new Socket(
        socketId,
        nodeId,
        socketDef.name,
        socketDef.type,
        direction,
        socketDef.default
      );
    });
  }

  /**
   * ノードをクローン（新しいIDで作成）
   */
  static clone(node: Node, offset: Position): Node {
    const newNodeId = new NodeId(`node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    const newPosition = node.position.move(offset.x, offset.y);
    
    const newInputs = node.inputs.map(socket => {
      const newSocketId = new SocketId(`socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      return new Socket(
        newSocketId,
        newNodeId,
        socket.name,
        socket.type,
        socket.direction,
        socket.defaultValue
      );
    });
    
    const newOutputs = node.outputs.map(socket => {
      const newSocketId = new SocketId(`socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      return new Socket(
        newSocketId,
        newNodeId,
        socket.name,
        socket.type,
        socket.direction,
        socket.defaultValue
      );
    });

    // すべての値をコピー
    const allValues = node.getAllValues();
    const newValues: Record<string, number | number[]> = {};
    for (const key in allValues) {
      const value = allValues[key];
      if (Array.isArray(value)) {
        newValues[key] = [...value];
      } else {
        newValues[key] = value;
      }
    }

    return new Node(
      newNodeId,
      node.definitionId,
      newPosition,
      newInputs,
      newOutputs,
      newValues
    );
  }
}

