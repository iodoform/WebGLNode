import { Connection } from '../../domain/entities/Connection';
import { Socket } from '../../domain/entities/Socket';
import { SocketId } from '../../domain/value-objects/Id';
import { INodeRepository } from '../../domain/repositories/INodeRepository';
import { IConnectionRepository } from '../../domain/repositories/IConnectionRepository';

/**
 * 接続作成ユースケース
 * 
 * 2つのソケット間の接続を作成し、既存の接続を置き換えます。
 */
export class CreateConnectionUseCase {
  constructor(
    private nodeRepository: INodeRepository,
    private connectionRepository: IConnectionRepository
  ) {}

  execute(fromSocketId: SocketId, toSocketId: SocketId): Connection {
    // ソケットを取得
    const fromSocket = this.findSocket(fromSocketId);
    const toSocket = this.findSocket(toSocketId);

    if (!fromSocket || !toSocket) {
      throw new Error('Socket not found');
    }

    // 既存の接続を削除（入力ソケットに既に接続がある場合）
    const existingConnections = this.connectionRepository.findBySocketId(toSocketId);
    for (const conn of existingConnections) {
      this.connectionRepository.delete(conn.id);
    }

    // 新しい接続を作成
    const connection = Connection.create(fromSocket, toSocket);
    this.connectionRepository.save(connection);

    return connection;
  }

  private findSocket(socketId: SocketId): Socket | undefined {
    const nodes = this.nodeRepository.findAll();
    for (const node of nodes) {
      const socket = node.getSocket(socketId.value);
      if (socket) {
        return socket;
      }
    }
    return undefined;
  }
}

