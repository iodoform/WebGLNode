import { Node } from '../../domain/entities/Node';
import { Connection } from '../../domain/entities/Connection';
import { Position } from '../../domain/value-objects/Position';
import { NodeId } from '../../domain/value-objects/Id';
import { SocketId } from '../../domain/value-objects/Id';
import { ConnectionId } from '../../domain/value-objects/Id';
import { INodeRepository } from '../../domain/repositories/INodeRepository';
import { IConnectionRepository } from '../../domain/repositories/IConnectionRepository';
import { AddNodeUseCase } from '../use-cases/AddNodeUseCase';
import { CreateConnectionUseCase } from '../use-cases/CreateConnectionUseCase';
import { DeleteNodeUseCase } from '../use-cases/DeleteNodeUseCase';
import { DeleteConnectionUseCase } from '../use-cases/DeleteConnectionUseCase';
import type { NodeDefinition } from '../../types';

/**
 * ノードエディターアプリケーションサービス
 * 
 * ノードエディターの主要な操作を統合的に管理します。
 * ユースケースを呼び出し、ドメインロジックを実行します。
 */
export class NodeEditorService {
  private addNodeUseCase: AddNodeUseCase;
  private createConnectionUseCase: CreateConnectionUseCase;
  private deleteNodeUseCase: DeleteNodeUseCase;
  private deleteConnectionUseCase: DeleteConnectionUseCase;

  constructor(
    private nodeRepository: INodeRepository,
    private connectionRepository: IConnectionRepository
  ) {
    this.addNodeUseCase = new AddNodeUseCase(nodeRepository);
    this.createConnectionUseCase = new CreateConnectionUseCase(nodeRepository, connectionRepository);
    this.deleteNodeUseCase = new DeleteNodeUseCase(nodeRepository, connectionRepository);
    this.deleteConnectionUseCase = new DeleteConnectionUseCase(connectionRepository);
  }

  /**
   * ノードを追加
   */
  addNode(definition: NodeDefinition, position: Position): Node {
    return this.addNodeUseCase.execute(definition, position);
  }

  /**
   * 接続を作成
   */
  createConnection(fromSocketId: SocketId, toSocketId: SocketId): Connection {
    return this.createConnectionUseCase.execute(fromSocketId, toSocketId);
  }

  /**
   * ノードを削除
   */
  deleteNode(nodeId: NodeId): void {
    this.deleteNodeUseCase.execute(nodeId);
  }

  /**
   * 接続を削除
   */
  deleteConnection(connectionId: ConnectionId): void {
    this.deleteConnectionUseCase.execute(connectionId);
  }

  /**
   * ノードの位置を更新
   */
  moveNode(nodeId: NodeId, position: Position): void {
    const node = this.nodeRepository.findById(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }
    const movedNode = node.moveTo(position);
    this.nodeRepository.save(movedNode);
  }

  /**
   * ノードの値を更新
   */
  updateNodeValue(nodeId: NodeId, name: string, value: number | number[]): void {
    const node = this.nodeRepository.findById(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }
    node.setValue(name, value);
    this.nodeRepository.save(node);
  }

  /**
   * すべてのノードを取得
   */
  getAllNodes(): Node[] {
    return this.nodeRepository.findAll();
  }

  /**
   * すべての接続を取得
   */
  getAllConnections(): Connection[] {
    return this.connectionRepository.findAll();
  }

  /**
   * ノードを取得
   */
  getNode(nodeId: NodeId): Node | undefined {
    return this.nodeRepository.findById(nodeId);
  }

  /**
   * 接続を取得
   */
  getConnection(connectionId: ConnectionId): Connection | undefined {
    return this.connectionRepository.findById(connectionId);
  }
}

