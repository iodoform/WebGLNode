import { Node } from '../../domain/entities/Node';

/**
 * ノードレンダラーのインターフェース
 */
export interface INodeRenderer {
  renderNode(node: Node): void;
  updateNodePosition(node: Node): void;
  updateSelectionDisplay(selectedNodes: Set<string>): void;
  updateSocketDisplay(socketId: string, connected: boolean): void;
  updateNodeInputFields(node: Node): void;
}

