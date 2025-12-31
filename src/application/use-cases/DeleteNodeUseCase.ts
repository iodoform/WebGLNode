import { Node } from '../../domain/entities/Node';
import { Connection } from '../../domain/entities/Connection';
import { NodeGraph } from '../../domain/entities/NodeGraph';
import { NodeId } from '../../domain/value-objects/Id';

/**
 * ノード削除ユースケース
 * 
 * ノード削除のドメインロジックを実行します。
 * リポジトリへの永続化は行いません（アプリケーション層で実行）。
 */
export class DeleteNodeUseCase {
  execute(
    nodeGraph: NodeGraph,
    nodeId: NodeId
  ): { nodeToDelete: Node; connectionsToDelete: Connection[] } {
    // ノードを取得（NodeGraphから）
    const node = nodeGraph.getNode(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }

    // 関連する接続を取得（NodeGraphから）
    const relatedConnections = nodeGraph.getConnectionsByNodeId(nodeId);

    // 関連する接続を削除（NodeGraphから）
    for (const connection of relatedConnections) {
      nodeGraph.removeConnection(connection.id);
    }

    // ノードを削除（NodeGraphから）
    nodeGraph.removeNode(nodeId);

    return {
      nodeToDelete: node,
      connectionsToDelete: relatedConnections
    };
  }
}

