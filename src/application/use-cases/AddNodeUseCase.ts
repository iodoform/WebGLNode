import { Node } from '../../domain/entities/Node';
import { Position } from '../../domain/value-objects/Position';
import { NodeFactory } from '../../domain/services/NodeFactory';
import { INodeRepository } from '../../domain/repositories/INodeRepository';
import type { NodeDefinition } from '../../types';

/**
 * ノード追加ユースケース
 * 
 * ノード定義と位置情報からノードを作成し、リポジトリに保存します。
 */
export class AddNodeUseCase {
  constructor(private nodeRepository: INodeRepository) {}

  execute(definition: NodeDefinition, position: Position): Node {
    const node = NodeFactory.create(definition, position);
    this.nodeRepository.save(node);
    return node;
  }
}

