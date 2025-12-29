import { Node } from '../../domain/entities/Node';
import { Position } from '../../domain/value-objects/Position';
import { NodeFactory } from '../../domain/services/NodeFactory';
import { NodeGraph } from '../../domain/entities/NodeGraph';
import type { NodeDefinition } from '../../infrastructure/types';

/**
 * ノード追加ユースケース
 * 
 * ノード定義と位置情報からノードを作成します。
 * リポジトリへの永続化は行いません（アプリケーション層で実行）。
 */
export class AddNodeUseCase {
  execute(
    nodeGraph: NodeGraph,
    definition: NodeDefinition,
    position: Position
  ): Node {
    // ドメインロジック: ノードを作成
    const node = NodeFactory.create(definition, position);
    
    // NodeGraphに追加
    nodeGraph.addNode(node);
    
    return node;
  }
}

