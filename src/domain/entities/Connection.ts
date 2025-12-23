import { ConnectionId } from '../value-objects/Id';
import { SocketId } from '../value-objects/Id';
import { NodeId } from '../value-objects/Id';
import { Socket } from './Socket';

/**
 * 接続エンティティ
 * 
 * 2つのソケット間の接続を表します。出力ソケットから入力ソケットへの
 * データフローを定義します。
 */
export class Connection {
  constructor(
    public readonly id: ConnectionId,
    public readonly fromNodeId: NodeId,
    public readonly fromSocketId: SocketId,
    public readonly toNodeId: NodeId,
    public readonly toSocketId: SocketId
  ) {
    // 同じノードへの接続は許可しない
    if (fromNodeId.equals(toNodeId)) {
      throw new Error('Cannot create connection within the same node');
    }
  }

  /**
   * 指定されたソケットIDがこの接続に関連しているかどうかを判定
   */
  involvesSocket(socketId: SocketId): boolean {
    return this.fromSocketId.equals(socketId) || this.toSocketId.equals(socketId);
  }

  /**
   * 指定されたノードIDがこの接続に関連しているかどうかを判定
   */
  involvesNode(nodeId: NodeId): boolean {
    return this.fromNodeId.equals(nodeId) || this.toNodeId.equals(nodeId);
  }

  /**
   * ソケットから接続を作成（ファクトリメソッド）
   */
  static create(from: Socket, to: Socket): Connection {
    if (!from.canConnectTo(to)) {
      throw new Error(`Cannot connect ${from.type} to ${to.type}`);
    }

    // 出力と入力の順序を確定
    const outputSocket = from.direction === 'output' ? from : to;
    const inputSocket = from.direction === 'input' ? from : to;

    const connectionId = new ConnectionId(`conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    return new Connection(
      connectionId,
      outputSocket.nodeId,
      outputSocket.id,
      inputSocket.nodeId,
      inputSocket.id
    );
  }

  equals(other: Connection): boolean {
    return this.id.equals(other.id);
  }
}

