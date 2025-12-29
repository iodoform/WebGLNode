import { Connection } from '../../domain/entities/Connection';
import { Socket } from '../../domain/entities/Socket';
import { NodeGraph } from '../../domain/entities/NodeGraph';
import { SocketId } from '../../domain/value-objects/Id';

/**
 * 接続作成ユースケース
 * 
 * 2つのソケット間の接続を作成します。
 * リポジトリへの永続化は行いません（アプリケーション層で実行）。
 */
export class CreateConnectionUseCase {
  execute(
    nodeGraph: NodeGraph,
    fromSocketId: SocketId,
    toSocketId: SocketId
  ): { connection: Connection; deletedConnections: Connection[] } {
    // ソケットを取得（NodeGraphから）
    const fromSocket = nodeGraph.getSocket(fromSocketId);
    const toSocket = nodeGraph.getSocket(toSocketId);

    if (!fromSocket || !toSocket) {
      throw new Error('Socket not found');
    }

    // 既存の接続を取得（入力ソケットに既に接続がある場合）
    const existingConnections = nodeGraph.getConnectionsBySocketId(toSocketId);

    // 新しい接続を作成（ドメインロジック）
    const connection = Connection.create(fromSocket, toSocket);

    // 既存の接続を削除（NodeGraphから）
    for (const conn of existingConnections) {
      nodeGraph.removeConnection(conn.id);
    }

    // 新しい接続を追加（NodeGraphに）
    nodeGraph.addConnection(connection);

    return {
      connection,
      deletedConnections: existingConnections
    };
  }
}

