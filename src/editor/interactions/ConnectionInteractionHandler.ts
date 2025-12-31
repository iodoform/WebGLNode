import { NodeEditorService } from '../../application/services/NodeEditorService';
import { EditorStateManager } from '../EditorStateManager';
import { CommandExecutor } from '../CommandExecutor';
import { CoordinateCalculator } from '../utils/CoordinateCalculator';
import { Socket } from '../../domain/entities/Socket';

/**
 * 接続操作を担当するクラス
 * 
 * 接続の作成、削除、ドラッグなどの操作ロジックを担当します。
 */
export class ConnectionInteractionHandler {
  constructor(
    private container: HTMLElement,
    private svgContainer: SVGSVGElement,
    private nodeEditorService: NodeEditorService,
    private stateManager: EditorStateManager,
    private commandExecutor: CommandExecutor,
    private updateConnectionPreview: (socketId: string, x: number, y: number) => void,
    private removeConnectionPreview: () => void,
    private getSocketAtPosition: (x: number, y: number) => Socket | undefined
  ) {}

  /**
   * 接続ドラッグを開始
   */
  startDrag(socket: Socket): void {
    this.stateManager.setConnectionDrag({
      isConnecting: true,
      fromSocket: {
        id: socket.id.value,
        nodeId: socket.nodeId.value,
        name: socket.name,
        type: socket.type,
        direction: socket.direction,
      },
      currentX: 0,
      currentY: 0,
    });
    this.container.classList.add('connecting');
  }

  /**
   * 接続ドラッグを更新
   */
  updateDrag(clientX: number, clientY: number): void {
    const connectionDrag = this.stateManager.getConnectionDrag();
    if (!connectionDrag.isConnecting) return;

    const state = this.stateManager.getState();
    const localPos = CoordinateCalculator.screenToLocal(
      clientX,
      clientY,
      this.svgContainer.getBoundingClientRect(),
      state.zoom
    );

    this.stateManager.setConnectionDrag({
      ...connectionDrag,
      currentX: localPos.x,
      currentY: localPos.y,
    });

    if (connectionDrag.fromSocket) {
      this.updateConnectionPreview(
        connectionDrag.fromSocket.id,
        localPos.x,
        localPos.y
      );
    }
  }

  /**
   * 接続ドラッグを終了
   */
  endDrag(clientX: number, clientY: number): void {
    const connectionDrag = this.stateManager.getConnectionDrag();
    if (!connectionDrag.isConnecting) return;

    const targetSocket = this.getSocketAtPosition(clientX, clientY);
    if (targetSocket && connectionDrag.fromSocket) {
      const fromNode = this.nodeEditorService.getNode(connectionDrag.fromSocket.nodeId);
      if (fromNode) {
        const fromSocket = fromNode.getSocket(connectionDrag.fromSocket.id);
        if (fromSocket) {
          this.commandExecutor.createConnection(fromSocket, targetSocket);
        }
      }
    }

    this.stateManager.setConnectionDrag({
      isConnecting: false,
      currentX: 0,
      currentY: 0,
    });
    this.removeConnectionPreview();
    this.container.classList.remove('connecting');
  }

  /**
   * 接続を削除
   */
  delete(connectionId: string): void {
    this.commandExecutor.deleteConnection(connectionId);
    
    if (this.stateManager.getSelectedConnectionId() === connectionId) {
      this.stateManager.setSelectedConnectionId(null);
    }
  }

  /**
   * ソケットを切断
   */
  disconnect(socketId: string): void {
    const connections = this.nodeEditorService.getAllConnections();
    const connection = connections.find(conn =>
      conn.fromSocketId.value === socketId || conn.toSocketId.value === socketId
    );
    if (connection) {
      this.delete(connection.id.value);
    }
  }
}

