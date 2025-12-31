import { Connection } from '../../domain/entities/Connection';

/**
 * 接続レンダラーのインターフェース
 */
export interface IConnectionRenderer {
  renderConnection(connection: Connection): void;
  updateConnections(connections: Connection[]): void;
  updateConnectionPreview(fromSocketId: string, currentX: number, currentY: number): void;
  removeConnectionPreview(): void;
  updateConnectionSelection(selectedConnectionId: string | null): void;
}

