import { Connection } from '../../domain/entities/Connection';
import { ConnectionId } from '../../domain/value-objects/Id';
import { SocketId } from '../../domain/value-objects/Id';
import { NodeId } from '../../domain/value-objects/Id';
import { IConnectionRepository } from '../../domain/repositories/IConnectionRepository';

/**
 * インメモリ接続リポジトリの実装
 * 
 * 接続をメモリ上に保存します。
 */
export class InMemoryConnectionRepository implements IConnectionRepository {
  private connections: Map<string, Connection> = new Map();

  save(connection: Connection): void {
    this.connections.set(connection.id.value, connection);
  }

  findById(id: ConnectionId): Connection | undefined {
    return this.connections.get(id.value);
  }

  findAll(): Connection[] {
    return Array.from(this.connections.values());
  }

  findBySocketId(socketId: SocketId): Connection[] {
    return Array.from(this.connections.values()).filter(conn =>
      conn.involvesSocket(socketId)
    );
  }

  findByNodeId(nodeId: NodeId): Connection[] {
    return Array.from(this.connections.values()).filter(conn =>
      conn.involvesNode(nodeId)
    );
  }

  delete(id: ConnectionId): void {
    this.connections.delete(id.value);
  }

  exists(id: ConnectionId): boolean {
    return this.connections.has(id.value);
  }
}

