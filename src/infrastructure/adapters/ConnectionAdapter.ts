import { Connection } from '../../domain/entities/Connection';
import { ConnectionId } from '../../domain/value-objects/Id';
import { NodeId } from '../../domain/value-objects/Id';
import { SocketId } from '../../domain/value-objects/Id';
import type { Connection as LegacyConnection } from '../../types';

/**
 * 接続アダプター
 * 
 * 古い型と新しいドメインエンティティの変換を行います。
 */
export class ConnectionAdapter {
  /**
   * ドメインエンティティからレガシー型に変換
   */
  static toLegacyConnection(domainConnection: Connection): LegacyConnection {
    return {
      id: domainConnection.id.value,
      fromNodeId: domainConnection.fromNodeId.value,
      fromSocketId: domainConnection.fromSocketId.value,
      toNodeId: domainConnection.toNodeId.value,
      toSocketId: domainConnection.toSocketId.value,
    };
  }

  /**
   * レガシー型からドメインエンティティに変換
   */
  static toDomainConnection(legacyConnection: LegacyConnection): Connection {
    return new Connection(
      new ConnectionId(legacyConnection.id),
      new NodeId(legacyConnection.fromNodeId),
      new SocketId(legacyConnection.fromSocketId),
      new NodeId(legacyConnection.toNodeId),
      new SocketId(legacyConnection.toSocketId)
    );
  }
}

