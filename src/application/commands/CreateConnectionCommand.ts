import { Connection } from '../../domain/entities/Connection';
import { NodeEditorService } from '../services/NodeEditorService';
import { ICommand } from './ICommand';

/**
 * 接続作成コマンド
 */
export class CreateConnectionCommand implements ICommand {
  private createdConnection: Connection | null = null;
  private deletedConnections: Connection[] = [];

  constructor(
    private nodeEditorService: NodeEditorService,
    private fromSocketId: string,
    private toSocketId: string,
    private onConnectionCreated?: (connection: Connection) => void,
    private onConnectionDeleted?: (connectionId: string) => void,
    private onConnectionsUpdated?: (connections: Connection[]) => void
  ) {}

  execute(): void {
    // 接続作成前に削除される接続を保存
    const toSocketConnections = this.nodeEditorService.getAllConnections().filter(conn =>
      conn.toSocketId.value === this.toSocketId
    );
    this.deletedConnections = [...toSocketConnections];

    this.createdConnection = this.nodeEditorService.createConnection(
      this.fromSocketId,
      this.toSocketId
    );
    this.onConnectionCreated?.(this.createdConnection);
    
    // 削除された接続を通知
    for (const conn of this.deletedConnections) {
      this.onConnectionDeleted?.(conn.id.value);
    }
    
    const updatedConnections = this.nodeEditorService.getAllConnections();
    this.onConnectionsUpdated?.(updatedConnections);
  }

  undo(): void {
    if (!this.createdConnection) return;

    // 作成した接続を削除
    this.nodeEditorService.deleteConnection(this.createdConnection.id.value);
    this.onConnectionDeleted?.(this.createdConnection.id.value);

    // 削除されていた接続を復元
    for (const conn of this.deletedConnections) {
      try {
        this.nodeEditorService.createConnection(
          conn.fromSocketId.value,
          conn.toSocketId.value
        );
        this.onConnectionCreated?.(conn);
      } catch (error) {
        console.warn('Failed to restore connection:', error);
      }
    }

    const updatedConnections = this.nodeEditorService.getAllConnections();
    this.onConnectionsUpdated?.(updatedConnections);
  }
}

