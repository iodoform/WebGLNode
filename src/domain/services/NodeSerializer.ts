import { Node } from '../entities/Node';
import { Socket } from '../entities/Socket';
import { Connection } from '../entities/Connection';
import { NodeId } from '../value-objects/Id';
import { SocketId } from '../value-objects/Id';
import { ConnectionId } from '../value-objects/Id';
import { Position } from '../value-objects/Position';

/**
 * ノードのシリアライズ形式
 */
export interface SerializedNode {
  id: string;
  definitionId: string;
  position: { x: number; y: number };
  inputs: SerializedSocket[];
  outputs: SerializedSocket[];
  values: Record<string, number | number[]>;
}

/**
 * ソケットのシリアライズ形式
 */
export interface SerializedSocket {
  id: string;
  nodeId: string;
  name: string;
  type: string;
  direction: 'input' | 'output';
  defaultValue?: number | number[];
}

/**
 * 接続のシリアライズ形式
 */
export interface SerializedConnection {
  id: string;
  fromNodeId: string;
  fromSocketId: string;
  toNodeId: string;
  toSocketId: string;
}

/**
 * ノードのシリアライズ/デシリアライズを行うサービス
 */
export class NodeSerializer {
  /**
   * ノードをシリアライズ形式に変換
   */
  static serialize(node: Node): SerializedNode {
    return {
      id: node.id.value,
      definitionId: node.definitionId,
      position: {
        x: node.position.x,
        y: node.position.y,
      },
      inputs: node.inputs.map(socket => this.serializeSocket(socket)),
      outputs: node.outputs.map(socket => this.serializeSocket(socket)),
      values: node.getAllValues(),
    };
  }

  /**
   * ソケットをシリアライズ形式に変換
   */
  private static serializeSocket(socket: Socket): SerializedSocket {
    return {
      id: socket.id.value,
      nodeId: socket.nodeId.value,
      name: socket.name,
      type: socket.type,
      direction: socket.direction,
      defaultValue: socket.defaultValue,
    };
  }

  /**
   * シリアライズ形式からノードを復元（同じIDで作成）
   */
  static deserialize(serialized: SerializedNode): Node {
    const nodeId = new NodeId(serialized.id);
    const position = new Position(serialized.position.x, serialized.position.y);

    const inputs = serialized.inputs.map(s => this.deserializeSocket(s, nodeId));
    const outputs = serialized.outputs.map(s => this.deserializeSocket(s, nodeId));

    return new Node(
      nodeId,
      serialized.definitionId,
      position,
      inputs,
      outputs,
      serialized.values
    );
  }

  /**
   * シリアライズ形式からソケットを復元（同じIDで作成）
   */
  private static deserializeSocket(
    serialized: SerializedSocket,
    nodeId: NodeId
  ): Socket {
    const socketId = new SocketId(serialized.id);
    return new Socket(
      socketId,
      nodeId,
      serialized.name,
      serialized.type as any,
      serialized.direction,
      serialized.defaultValue
    );
  }

  /**
   * 接続をシリアライズ形式に変換
   */
  static serializeConnection(connection: Connection): SerializedConnection {
    return {
      id: connection.id.value,
      fromNodeId: connection.fromNodeId.value,
      fromSocketId: connection.fromSocketId.value,
      toNodeId: connection.toNodeId.value,
      toSocketId: connection.toSocketId.value,
    };
  }

  /**
   * シリアライズ形式から接続を復元（同じIDで作成）
   */
  static deserializeConnection(serialized: SerializedConnection): Connection {
    const connectionId = new ConnectionId(serialized.id);
    const fromNodeId = new NodeId(serialized.fromNodeId);
    const fromSocketId = new SocketId(serialized.fromSocketId);
    const toNodeId = new NodeId(serialized.toNodeId);
    const toSocketId = new SocketId(serialized.toSocketId);

    return new Connection(
      connectionId,
      fromNodeId,
      fromSocketId,
      toNodeId,
      toSocketId
    );
  }
}

