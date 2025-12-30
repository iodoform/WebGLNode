import { ICommand } from './ICommand';
import { SerializedNode } from '../../domain/services/NodeSerializer';
import { commandDIContainer } from '../../infrastructure/di/CommandDIContainer';

/**
 * ノード削除コマンド
 * 
 * ノードのみを削除します。接続の削除は含まれません。
 * 接続の削除も含めたい場合は、DeleteNodeWithConnectionsCommandを使用してください。
 */
export class DeleteNodeCommand implements ICommand {
  private serializedNode: SerializedNode | null = null;
  private restoredNodeId: string | null = null;

  constructor(
    private nodeId: string
  ) {}

  execute(): void {
    const deps = commandDIContainer.get();
    
    // 削除前にノードと接続の情報を保存
    const nodeToDelete = deps.nodeEditorService.getNode(
      this.restoredNodeId || this.nodeId
    );
    
    if (!nodeToDelete) {
      // undoで復元されたノードがない場合、元のノード情報を使用
      if (!this.serializedNode) {
        const node = deps.nodeEditorService.getNode(this.nodeId);
        if (!node) return;
        // ノードをシリアライズして保存
        this.serializedNode = deps.nodeEditorService.serializeNode(node);
      }
    } else {
      // 復元されたノードを削除する場合
      this.serializedNode = deps.nodeEditorService.serializeNode(nodeToDelete);
    }

    const targetNodeId = this.restoredNodeId || this.nodeId;

    // ノードを削除
    deps.nodeEditorService.deleteNode(targetNodeId);
    
    // DOM更新
    deps.syncNodeCacheToState();
    const nodeEl = deps.nodeContainer.querySelector(`[data-node-id="${targetNodeId}"]`);
    if (nodeEl) nodeEl.remove();
    
    deps.triggerShaderUpdate();
  }

  undo(): void {
    if (!this.serializedNode) return;

    const deps = commandDIContainer.get();

    // シリアライズされたノードを復元（同じIDで作成）
    const restoredNode = deps.nodeEditorService.restoreNode(this.serializedNode);

    // 復元されたノードのIDを保存（redo時に使用）
    this.restoredNodeId = restoredNode.id.value;

    // DOM更新
    deps.syncNodeCacheToState();
    deps.nodeRenderer.renderNode(restoredNode);
    deps.triggerShaderUpdate();
  }
}

