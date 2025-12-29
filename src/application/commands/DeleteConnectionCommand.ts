import { Connection } from '../../domain/entities/Connection';
import { NodeEditorService } from '../services/NodeEditorService';
import { ICommand } from './ICommand';

/**
 * 接続削除コマンド
 */
export class DeleteConnectionCommand implements ICommand {
  private deletedConnection: Connection | null = null;
  private restoredConnectionId: string | null = null;

  constructor(
    private nodeEditorService: NodeEditorService,
    private connectionId: string,
    private onConnectionDeleted?: (connectionId: string) => void,
    private onConnectionCreated?: (connection: Connection) => void,
    private onConnectionsUpdated?: (connections: Connection[]) => void
  ) {}

  execute(): void {
    // 削除前に接続情報を保存
    const connectionToDelete = this.nodeEditorService.getConnection(
      this.restoredConnectionId || this.connectionId
    ) || null;
    
    if (!connectionToDelete) {
      // undoで復元された接続がない場合、元の接続情報を使用
      if (!this.deletedConnection) {
        this.deletedConnection = this.nodeEditorService.getConnection(this.connectionId) || null;
      }
      if (!this.deletedConnection) return;
    } else {
      // 復元された接続を削除する場合
      this.deletedConnection = connectionToDelete;
    }

    const targetConnectionId = this.restoredConnectionId || this.connectionId;
    this.nodeEditorService.deleteConnection(targetConnectionId);
    this.onConnectionDeleted?.(targetConnectionId);
    
    const updatedConnections = this.nodeEditorService.getAllConnections();
    this.onConnectionsUpdated?.(updatedConnections);
  }

  undo(): void {
    if (!this.deletedConnection) return;

    // 接続を復元
    try {
      const restoredConnection = this.nodeEditorService.createConnection(
        this.deletedConnection.fromSocketId.value,
        this.deletedConnection.toSocketId.value
      );
      // 復元された接続のIDを保存（redo時に使用）
      this.restoredConnectionId = restoredConnection.id.value;
      this.onConnectionCreated?.(restoredConnection);
      
      const updatedConnections = this.nodeEditorService.getAllConnections();
      this.onConnectionsUpdated?.(updatedConnections);
    } catch (error) {
      console.warn('Failed to restore connection:', error);
    }
  }
}

