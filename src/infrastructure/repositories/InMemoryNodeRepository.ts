import { Node } from '../../domain/entities/Node';
import { NodeId } from '../../domain/value-objects/Id';
import { INodeRepository } from '../../domain/repositories/INodeRepository';

/**
 * インメモリノードリポジトリの実装
 * 
 * ノードをメモリ上に保存します。
 */
export class InMemoryNodeRepository implements INodeRepository {
  private nodes: Map<string, Node> = new Map();

  save(node: Node): void {
    this.nodes.set(node.id.value, node);
  }

  findById(id: NodeId): Node | undefined {
    return this.nodes.get(id.value);
  }

  findAll(): Node[] {
    return Array.from(this.nodes.values());
  }

  delete(id: NodeId): void {
    this.nodes.delete(id.value);
  }

  exists(id: NodeId): boolean {
    return this.nodes.has(id.value);
  }
}

