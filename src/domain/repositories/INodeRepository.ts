import { Node } from '../entities/Node';
import { NodeId } from '../value-objects/Id';

/**
 * ノードリポジトリのインターフェース
 * 
 * ノードの永続化と取得を定義します。
 */
export interface INodeRepository {
  save(node: Node): void;
  findById(id: NodeId): Node | undefined;
  findAll(): Node[];
  delete(id: NodeId): void;
  exists(id: NodeId): boolean;
}

