import { Node } from '../../domain/entities/Node';
import { Connection } from '../../domain/entities/Connection';
import { NodeGraph } from '../../domain/entities/NodeGraph';
import { Position } from '../../domain/value-objects/Position';
import { NodeId, SocketId, ConnectionId } from '../../domain/value-objects/Id';
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
    private nodeGraph: NodeGraph,
    private nodeRepository: INodeRepository,
    private connectionRepository: IConnectionRepository
  ) {
    this.addNodeUseCase = new AddNodeUseCase();
    this.createConnectionUseCase = new CreateConnectionUseCase();
    this.deleteNodeUseCase = new DeleteNodeUseCase();
    this.deleteConnectionUseCase = new DeleteConnectionUseCase();
  }

  /**
   * ノードを追加
   */
  addNode(definition: NodeDefinition, x: number, y: number): Node {
    // 値オブジェクトを生成（アプリケーション層の責務）
    const position = new Position(x, y);
    
    // ドメインロジックを実行（NodeGraphを使用）
    const node = this.addNodeUseCase.execute(this.nodeGraph, definition, position);
    
    // 永続化
    this.nodeRepository.save(node);
    
    return node;
  }

  /**
   * 接続を作成
   */
  createConnection(fromSocketIdStr: string, toSocketIdStr: string): Connection {
    // 値オブジェクトを生成（アプリケーション層の責務）
    const fromSocketId = new SocketId(fromSocketIdStr);
    const toSocketId = new SocketId(toSocketIdStr);
    
    // ドメインロジックを実行（NodeGraphを使用）
    const result = this.createConnectionUseCase.execute(
      this.nodeGraph,
      fromSocketId,
      toSocketId
    );

    // 永続化: 既存の接続を削除
    for (const conn of result.deletedConnections) {
      this.connectionRepository.delete(conn.id);
    }

    // 永続化: 新しい接続を保存
    this.connectionRepository.save(result.connection);

    return result.connection;
  }

  /**
   * ノードを削除
   */
  deleteNode(nodeIdStr: string): void {
    // 値オブジェクトを生成（アプリケーション層の責務）
    const nodeId = new NodeId(nodeIdStr);
    
    // ドメインロジックを実行（NodeGraphを使用）
    const result = this.deleteNodeUseCase.execute(this.nodeGraph, nodeId);

    // 永続化: 関連する接続を削除
    for (const connection of result.connectionsToDelete) {
      this.connectionRepository.delete(connection.id);
    }

    // 永続化: ノードを削除
    this.nodeRepository.delete(result.nodeToDelete.id);
  }

  /**
   * 接続を削除
   */
  deleteConnection(connectionIdStr: string): void {
    // 値オブジェクトを生成（アプリケーション層の責務）
    const connectionId = new ConnectionId(connectionIdStr);
    
    // ドメインロジックを実行（NodeGraphを使用）
    const connectionToDelete = this.deleteConnectionUseCase.execute(
      this.nodeGraph,
      connectionId
    );

    // 永続化
    this.connectionRepository.delete(connectionToDelete.id);
  }

  /**
   * ノードの位置を更新（キャッシュ更新用）
   * 
   * キャッシュを高速に更新するため、リポジトリへの保存は行いません。
   * リポジトリへの保存が必要な場合は、別途saveNodeを呼び出してください。
   * 
   * @param nodeIdStr 移動するノードのID（文字列）
   * @param x 新しいX座標
   * @param y 新しいY座標
   * @returns 更新されたノードエンティティ（キャッシュ更新用）
   */
  moveNodeAndGetUpdated(nodeIdStr: string, x: number, y: number): Node {
    // 値オブジェクトを生成（アプリケーション層の責務）
    const nodeId = new NodeId(nodeIdStr);
    const position = new Position(x, y);
    
    const node = this.nodeGraph.getNode(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }
    node.moveTo(position);
    return node;
  }

  /**
   * ノードをリポジトリに保存
   * 
   * キャッシュ更新とは別に、リポジトリへの永続化を行います。
   * ドラッグ中など頻繁な更新が発生する場合は、非同期で実行するか
   * ドラッグ終了時にまとめて保存することを推奨します。
   * 
   * @param nodeIdStr 保存するノードのID（文字列）
   */
  saveNode(nodeIdStr: string): void {
    // 値オブジェクトを生成（アプリケーション層の責務）
    const nodeId = new NodeId(nodeIdStr);
    
    const node = this.nodeGraph.getNode(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }
    this.nodeRepository.save(node);
  }

  /**
   * ノードの値を更新
   */
  updateNodeValue(nodeIdStr: string, name: string, value: number | number[]): void {
    // 値オブジェクトを生成（アプリケーション層の責務）
    const nodeId = new NodeId(nodeIdStr);
    
    const node = this.nodeGraph.getNode(nodeId);
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
    return this.nodeGraph.getAllNodes();
  }

  /**
   * すべての接続を取得
   */
  getAllConnections(): Connection[] {
    return this.nodeGraph.getAllConnections();
  }

  /**
   * ノードを取得
   */
  getNode(nodeIdStr: string): Node | undefined {
    // 値オブジェクトを生成（アプリケーション層の責務）
    const nodeId = new NodeId(nodeIdStr);
    
    return this.nodeGraph.getNode(nodeId);
  }

  /**
   * 接続を取得
   */
  getConnection(connectionIdStr: string): Connection | undefined {
    // 値オブジェクトを生成（アプリケーション層の責務）
    const connectionId = new ConnectionId(connectionIdStr);
    
    const connections = this.nodeGraph.getAllConnections();
    return connections.find(c => c.id.equals(connectionId));
  }
}

