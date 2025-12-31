import { Connection } from '../../domain/entities/Connection';
import { ICommand } from './ICommand';
import { SerializedConnection } from '../../domain/services/NodeSerializer';
import { commandDIContainer } from '../../infrastructure/di/CommandDIContainer';

/**
 * 接続作成コマンド
 */
export class CreateConnectionCommand implements ICommand {
  private serializedCreatedConnection: SerializedConnection | null = null;
  private serializedDeletedConnections: SerializedConnection[] = [];

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
    this.serializedDeletedConnections = toSocketConnections.map(conn =>
      deps.nodeEditorService.serializeConnection(conn)
    );

    const createdConnection = deps.nodeEditorService.createConnection(
      this.fromSocketId,
      this.toSocketId
    );
    this.serializedCreatedConnection = deps.nodeEditorService.serializeConnection(createdConnection);
    
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
    if (!this.serializedCreatedConnection) return;

    const deps = commandDIContainer.get();

    // 作成した接続を削除
    deps.nodeEditorService.deleteConnection(this.serializedCreatedConnection.id);

    // 削除されていた接続を復元（同じIDで作成）
    for (const serializedConn of this.serializedDeletedConnections) {
      try {
        deps.nodeEditorService.restoreConnection(serializedConn);
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

