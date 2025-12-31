import { ConnectionId } from '../../domain/value-objects/Id';
import { Connection } from '../../domain/entities/Connection';
import { NodeGraph } from '../../domain/entities/NodeGraph';

/**
 * 接続削除ユースケース
 * 
 * 接続削除のドメインロジックを実行します。
 * リポジトリへの永続化は行いません（アプリケーション層で実行）。
 */
export class DeleteConnectionUseCase {
  execute(
    nodeGraph: NodeGraph,
    connectionId: ConnectionId
  ): Connection {
    // 接続を取得（NodeGraphから）
    const connections = nodeGraph.getAllConnections();
    const connection = connections.find(c => c.id.equals(connectionId));
    
    if (!connection) {
      throw new Error('Connection not found');
    }

    // NodeGraphから削除
    nodeGraph.removeConnection(connectionId);

    return connection;
  }
}

