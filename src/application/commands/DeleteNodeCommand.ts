import { Node } from '../../domain/entities/Node';
import { Connection } from '../../domain/entities/Connection';
import { ICommand } from './ICommand';
import { nodeDefinitionLoader } from '../../infrastructure/node-definitions/loader/NodeDefinitionLoader';
import { commandDIContainer } from '../../infrastructure/di/CommandDIContainer';

/**
 * ノード削除コマンド
 */
export class DeleteNodeCommand implements ICommand {
  private deletedNode: Node | null = null;
  private deletedConnections: Connection[] = [];
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
      if (!this.deletedNode) {
        const node = deps.nodeEditorService.getNode(this.nodeId);
        if (!node) return;
        this.deletedNode = node;
      }
    } else {
      // 復元されたノードを削除する場合
      this.deletedNode = nodeToDelete;
    }

    const targetNodeId = this.restoredNodeId || this.nodeId;
    const allConnections = deps.nodeEditorService.getAllConnections();
    this.deletedConnections = allConnections.filter(conn =>
      conn.fromNodeId.value === targetNodeId || conn.toNodeId.value === targetNodeId
    );

    // ノードを削除（関連接続も自動的に削除される）
    deps.nodeEditorService.deleteNode(targetNodeId);
    
    // DOM更新
    deps.syncNodeCacheToState();
    const nodeEl = deps.nodeContainer.querySelector(`[data-node-id="${targetNodeId}"]`);
    if (nodeEl) nodeEl.remove();
    
    const updatedConnections = deps.nodeEditorService.getAllConnections();
    deps.connectionRenderer.updateConnections(updatedConnections);
    
    // 接続先ノードの表示を更新
    const affectedNodeIds = new Set<string>();
    for (const conn of this.deletedConnections) {
      if (conn.toNodeId.value !== targetNodeId) {
        affectedNodeIds.add(conn.toNodeId.value);
      }
    }
    for (const affectedNodeId of affectedNodeIds) {
      const affectedNode = deps.nodeEditorService.getNode(affectedNodeId);
      if (affectedNode) {
        deps.nodeRenderer.updateNodeInputFields(affectedNode);
        for (const inputSocket of affectedNode.inputs) {
          deps.nodeRenderer.updateSocketDisplay(
            inputSocket.id.value,
            deps.isSocketConnected(inputSocket.id.value)
          );
        }
      }
    }
    
    deps.triggerShaderUpdate();
  }

  undo(): void {
    if (!this.deletedNode) return;

    const deps = commandDIContainer.get();

    // ノードを再作成（元の位置と値で）
    const definition = nodeDefinitionLoader.getDefinition(this.deletedNode.definitionId);
    if (!definition) return;

    const restoredNode = deps.nodeEditorService.addNode(
      definition,
      this.deletedNode.position.x,
      this.deletedNode.position.y
    );

    // 復元されたノードのIDを保存（redo時に使用）
    this.restoredNodeId = restoredNode.id.value;

    // ノードの値を復元
    const allValues = this.deletedNode.getAllValues();
    for (const [name, value] of Object.entries(allValues)) {
      restoredNode.setValue(name, value);
    }
    deps.nodeEditorService.saveNode(restoredNode.id.value);

    // 接続を復元
    for (const conn of this.deletedConnections) {
      try {
        deps.nodeEditorService.createConnection(
          conn.fromSocketId.value,
          conn.toSocketId.value
        );
      } catch (error) {
        console.warn('Failed to restore connection:', error);
      }
    }

    // DOM更新
    deps.syncNodeCacheToState();
    deps.nodeRenderer.renderNode(restoredNode);
    
    // 接続先ノードの表示を更新
    const allConnections = deps.nodeEditorService.getAllConnections();
    for (const conn of allConnections) {
      if (conn.toNodeId.value === restoredNode.id.value) {
        const toNode = deps.nodeEditorService.getNode(conn.toNodeId.value);
        if (toNode) {
          deps.nodeRenderer.updateNodeInputFields(toNode);
          for (const inputSocket of toNode.inputs) {
            deps.nodeRenderer.updateSocketDisplay(
              inputSocket.id.value,
              deps.isSocketConnected(inputSocket.id.value)
            );
          }
        }
      }
    }
    
    const updatedConnections = deps.nodeEditorService.getAllConnections();
    deps.connectionRenderer.updateConnections(updatedConnections);
    deps.triggerShaderUpdate();
  }
}

