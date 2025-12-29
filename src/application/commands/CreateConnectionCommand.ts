import { Connection } from '../../domain/entities/Connection';
import { ICommand } from './ICommand';
import { commandDIContainer } from '../../infrastructure/di/CommandDIContainer';

/**
 * 接続作成コマンド
 */
export class CreateConnectionCommand implements ICommand {
  private createdConnection: Connection | null = null;
  private deletedConnections: Connection[] = [];

  constructor(
    private fromSocketId: string,
    private toSocketId: string
  ) {}

  execute(): void {
    const deps = commandDIContainer.get();
    
    // 接続作成前に削除される接続を保存
    const toSocketConnections = deps.nodeEditorService.getAllConnections().filter((conn: Connection) =>
      conn.toSocketId.value === this.toSocketId
    );
    this.deletedConnections = [...toSocketConnections];

    this.createdConnection = deps.nodeEditorService.createConnection(
      this.fromSocketId,
      this.toSocketId
    );
    
    // DOM更新
    const updatedConnections = deps.nodeEditorService.getAllConnections();
    deps.connectionRenderer.updateConnections(updatedConnections);
    deps.nodeRenderer.updateSocketDisplay(this.fromSocketId, deps.isSocketConnected(this.fromSocketId));
    deps.nodeRenderer.updateSocketDisplay(this.toSocketId, deps.isSocketConnected(this.toSocketId));
    
    // 接続先ノードの入力フィールドを更新
    const allConnections = deps.nodeEditorService.getAllConnections();
    const toConnection = allConnections.find((c: Connection) => c.toSocketId.value === this.toSocketId);
    if (toConnection) {
      const toNode = deps.nodeEditorService.getNode(toConnection.toNodeId.value);
      if (toNode) {
        deps.nodeRenderer.updateNodeInputFields(toNode);
      }
    }
    
    deps.triggerShaderUpdate();
  }

  undo(): void {
    if (!this.createdConnection) return;

    const deps = commandDIContainer.get();

    // 作成した接続を削除
    deps.nodeEditorService.deleteConnection(this.createdConnection.id.value);

    // 削除されていた接続を復元
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
    const updatedConnections = deps.nodeEditorService.getAllConnections();
    deps.connectionRenderer.updateConnections(updatedConnections);
    deps.nodeRenderer.updateSocketDisplay(this.fromSocketId, deps.isSocketConnected(this.fromSocketId));
    deps.nodeRenderer.updateSocketDisplay(this.toSocketId, deps.isSocketConnected(this.toSocketId));
    
    // 接続先ノードの入力フィールドを更新
    const toConnection = updatedConnections.find((c: Connection) => c.toSocketId.value === this.toSocketId);
    if (toConnection) {
      const toNode = deps.nodeEditorService.getNode(toConnection.toNodeId.value);
      if (toNode) {
        deps.nodeRenderer.updateNodeInputFields(toNode);
      }
    }
    
    deps.triggerShaderUpdate();
  }
}

