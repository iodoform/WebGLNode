import { Connection } from '../entities/Connection';
import { ConnectionId } from '../value-objects/Id';
import { SocketId } from '../value-objects/Id';
import { NodeId } from '../value-objects/Id';

/**
 * 接続リポジトリのインターフェース
 * 
 * 接続の永続化と取得を定義します。
 */
export interface IConnectionRepository {
  save(connection: Connection): void;
  findById(id: ConnectionId): Connection | undefined;
  findAll(): Connection[];
  findBySocketId(socketId: SocketId): Connection[];
  findByNodeId(nodeId: NodeId): Connection[];
  delete(id: ConnectionId): void;
  exists(id: ConnectionId): boolean;
}

