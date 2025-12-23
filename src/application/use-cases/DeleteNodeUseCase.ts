import { NodeId } from '../../domain/value-objects/Id';
import { INodeRepository } from '../../domain/repositories/INodeRepository';
import { IConnectionRepository } from '../../domain/repositories/IConnectionRepository';

/**
 * ノード削除ユースケース
 * 
 * ノードとその関連接続を削除します。
 */
export class DeleteNodeUseCase {
  constructor(
    private nodeRepository: INodeRepository,
    private connectionRepository: IConnectionRepository
  ) {}

  execute(nodeId: NodeId): void {
    const node = this.nodeRepository.findById(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }

    // 関連する接続を削除
    const connections = this.connectionRepository.findByNodeId(nodeId);
    for (const connection of connections) {
      this.connectionRepository.delete(connection.id);
    }

    // ノードを削除
    this.nodeRepository.delete(nodeId);
  }
}

