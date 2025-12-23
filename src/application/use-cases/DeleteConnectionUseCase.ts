import { ConnectionId } from '../../domain/value-objects/Id';
import { IConnectionRepository } from '../../domain/repositories/IConnectionRepository';

/**
 * 接続削除ユースケース
 * 
 * 指定された接続を削除します。
 */
export class DeleteConnectionUseCase {
  constructor(private connectionRepository: IConnectionRepository) {}

  execute(connectionId: ConnectionId): void {
    const connection = this.connectionRepository.findById(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    this.connectionRepository.delete(connectionId);
  }
}

