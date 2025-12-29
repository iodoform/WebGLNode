import { Connection } from '../../domain/entities/Connection';
import { ICommand } from './ICommand';
import { commandDIContainer } from '../../infrastructure/di/CommandDIContainer';

/**
 * 接続削除コマンド
 */
export class DeleteConnectionCommand implements ICommand {
  private deletedConnection: Connection | null = null;
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
      if (!this.deletedConnection) {
        this.deletedConnection = deps.nodeEditorService.getConnection(this.connectionId) || null;
      }
      if (!this.deletedConnection) return;
    } else {
      // 復元された接続を削除する場合
      this.deletedConnection = connectionToDelete;
    }

    const targetConnectionId = this.restoredConnectionId || this.connectionId;
    deps.nodeEditorService.deleteConnection(targetConnectionId);
    
    // DOM更新
    const updatedConnections = deps.nodeEditorService.getAllConnections();
    deps.connectionRenderer.updateConnections(updatedConnections);
    deps.nodeRenderer.updateSocketDisplay(
      this.deletedConnection.fromSocketId.value,
      deps.isSocketConnected(this.deletedConnection.fromSocketId.value)
    );
    deps.nodeRenderer.updateSocketDisplay(
      this.deletedConnection.toSocketId.value,
      deps.isSocketConnected(this.deletedConnection.toSocketId.value)
    );
    
    // 接続先ノードの入力フィールドを更新
    const toNode = deps.nodeEditorService.getNode(this.deletedConnection.toNodeId.value);
    if (toNode) {
      deps.nodeRenderer.updateNodeInputFields(toNode);
    }
    
    deps.triggerShaderUpdate();
  }

  undo(): void {
    if (!this.deletedConnection) return;

    const deps = commandDIContainer.get();

    // 接続を復元
    try {
      const restoredConnection = deps.nodeEditorService.createConnection(
        this.deletedConnection.fromSocketId.value,
        this.deletedConnection.toSocketId.value
      );
      // 復元された接続のIDを保存（redo時に使用）
      this.restoredConnectionId = restoredConnection.id.value;
      
      // DOM更新
      const updatedConnections = deps.nodeEditorService.getAllConnections();
      deps.connectionRenderer.updateConnections(updatedConnections);
      deps.nodeRenderer.updateSocketDisplay(
        this.deletedConnection.fromSocketId.value,
        deps.isSocketConnected(this.deletedConnection.fromSocketId.value)
      );
      deps.nodeRenderer.updateSocketDisplay(
        this.deletedConnection.toSocketId.value,
        deps.isSocketConnected(this.deletedConnection.toSocketId.value)
      );
      
      // 接続先ノードの入力フィールドを更新
      const toNode = deps.nodeEditorService.getNode(this.deletedConnection.toNodeId.value);
      if (toNode) {
        deps.nodeRenderer.updateNodeInputFields(toNode);
      }
      
      deps.triggerShaderUpdate();
    } catch (error) {
      console.warn('Failed to restore connection:', error);
    }
  }
}

