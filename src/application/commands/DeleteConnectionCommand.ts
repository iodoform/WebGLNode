import { Connection } from '../../domain/entities/Connection';
import { ICommand } from './ICommand';
import { SerializedConnection } from '../../domain/services/NodeSerializer';
import { commandDIContainer } from '../../infrastructure/di/CommandDIContainer';

/**
 * 接続削除コマンド
 */
export class DeleteConnectionCommand implements ICommand {
  private serializedConnection: SerializedConnection | null = null;
  private restoredConnectionId: string | null = null;

  constructor(
    private connectionId: string
  ) {}

  execute(): void {
    const deps = commandDIContainer.get();
    
    // 削除前に接続情報を保存
    const connectionToDelete = deps.nodeEditorService.getConnection(
      this.restoredConnectionId || this.connectionId
    ) || null;
    
    if (!connectionToDelete) {
      // undoで復元された接続がない場合、元の接続情報を使用
      if (!this.serializedConnection) {
        const conn = deps.nodeEditorService.getConnection(this.connectionId);
        if (!conn) return;
        this.serializedConnection = deps.nodeEditorService.serializeConnection(conn);
      }
    } else {
      // 復元された接続を削除する場合
      this.serializedConnection = deps.nodeEditorService.serializeConnection(connectionToDelete);
    }

    const targetConnectionId = this.restoredConnectionId || this.connectionId;
    deps.nodeEditorService.deleteConnection(targetConnectionId);
    
    // DOM更新
    const updatedConnections = deps.nodeEditorService.getAllConnections();
    deps.connectionRenderer.updateConnections(updatedConnections);
    
    if (this.serializedConnection) {
      deps.nodeRenderer.updateSocketDisplay(
        this.serializedConnection.fromSocketId,
        deps.isSocketConnected(this.serializedConnection.fromSocketId)
      );
      deps.nodeRenderer.updateSocketDisplay(
        this.serializedConnection.toSocketId,
        deps.isSocketConnected(this.serializedConnection.toSocketId)
      );
      
      // 接続先ノードの入力フィールドを更新
      const toNode = deps.nodeEditorService.getNode(this.serializedConnection.toNodeId);
      if (toNode) {
        deps.nodeRenderer.updateNodeInputFields(toNode);
      }
    }
    
    deps.triggerShaderUpdate();
  }

  undo(): void {
    if (!this.serializedConnection) return;

    const deps = commandDIContainer.get();

    // 接続を復元（同じIDで作成）
    try {
      const restoredConnection = deps.nodeEditorService.restoreConnection(this.serializedConnection);
      // 復元された接続のIDを保存（redo時に使用）
      this.restoredConnectionId = restoredConnection.id.value;
      
      // DOM更新
      const updatedConnections = deps.nodeEditorService.getAllConnections();
      deps.connectionRenderer.updateConnections(updatedConnections);
      deps.nodeRenderer.updateSocketDisplay(
        this.serializedConnection.fromSocketId,
        deps.isSocketConnected(this.serializedConnection.fromSocketId)
      );
      deps.nodeRenderer.updateSocketDisplay(
        this.serializedConnection.toSocketId,
        deps.isSocketConnected(this.serializedConnection.toSocketId)
      );
      
      // 接続先ノードの入力フィールドを更新
      const toNode = deps.nodeEditorService.getNode(this.serializedConnection.toNodeId);
      if (toNode) {
        deps.nodeRenderer.updateNodeInputFields(toNode);
      }
      
      deps.triggerShaderUpdate();
    } catch (error) {
      console.warn('Failed to restore connection:', error);
    }
  }
}

