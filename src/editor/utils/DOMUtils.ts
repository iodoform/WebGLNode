import { NodeEditorService } from '../../application/services/NodeEditorService';
import { Socket } from '../../domain/entities/Socket';

/**
 * DOM操作ユーティリティクラス
 * 
 * DOM要素の検出や操作を担当します。
 */
export class DOMUtils {
  /**
   * 座標からソケット要素を取得
   */
  static getSocketAtPosition(
    x: number,
    y: number,
    nodeEditorService: NodeEditorService
  ): Socket | undefined {
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      if (el.classList.contains('socket')) {
        const socketId = (el as HTMLElement).dataset.socketId;
        const nodeId = (el as HTMLElement).dataset.nodeId;
        if (socketId && nodeId) {
          const node = nodeEditorService.getNode(nodeId);
          if (node) {
            return [...node.inputs, ...node.outputs].find(s => s.id.value === socketId);
          }
        }
      }
    }
    return undefined;
  }
}

