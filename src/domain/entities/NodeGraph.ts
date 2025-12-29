import { Node } from './Node';
import { Connection } from './Connection';
import { Socket } from './Socket';
import { NodeId } from '../value-objects/Id';
import { SocketId } from '../value-objects/Id';
import { ConnectionId } from '../value-objects/Id';

/**
 * ノードグラフ集約ルートエンティティ
 * 
 * ノードと接続を管理する集約ルートです。
 * ドメインロジックに必要なグラフ構造の情報を提供します。
 */
export class NodeGraph {
  private nodes: Map<string, Node> = new Map();
  private connections: Map<string, Connection> = new Map();

  /**
   * ノードを追加
   */
  addNode(node: Node): void {
    this.nodes.set(node.id.value, node);
  }

  /**
   * ノードを削除
   */
  removeNode(nodeId: NodeId): void {
    this.nodes.delete(nodeId.value);
  }

  /**
   * 接続を追加
   */
  addConnection(connection: Connection): void {
    this.connections.set(connection.id.value, connection);
  }

  /**
   * 接続を削除
   */
  removeConnection(connectionId: ConnectionId): void {
    this.connections.delete(connectionId.value);
  }

  /**
   * ノードを取得
   */
  getNode(nodeId: NodeId): Node | undefined {
    return this.nodes.get(nodeId.value);
  }

  /**
   * ソケットを取得
   */
  getSocket(socketId: SocketId): Socket | undefined {
    for (const node of this.nodes.values()) {
      const socket = node.getSocket(socketId.value);
      if (socket) {
        return socket;
      }
    }
    return undefined;
  }

  /**
   * 指定されたソケットIDに関連する接続を取得
   */
  getConnectionsBySocketId(socketId: SocketId): Connection[] {
    return Array.from(this.connections.values()).filter(conn =>
      conn.involvesSocket(socketId)
    );
  }

  /**
   * 指定されたノードIDに関連する接続を取得
   */
  getConnectionsByNodeId(nodeId: NodeId): Connection[] {
    return Array.from(this.connections.values()).filter(conn =>
      conn.involvesNode(nodeId)
    );
  }

  /**
   * すべてのノードを取得
   */
  getAllNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  /**
   * すべての接続を取得
   */
  getAllConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  /**
   * ノードが存在するかどうか
   */
  hasNode(nodeId: NodeId): boolean {
    return this.nodes.has(nodeId.value);
  }

  /**
   * 接続が存在するかどうか
   */
  hasConnection(connectionId: ConnectionId): boolean {
    return this.connections.has(connectionId.value);
  }
}

