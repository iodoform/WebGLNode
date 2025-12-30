import { CommandHistory } from '../application/commands/CommandHistory';
import { AddNodeCommand } from '../application/commands/AddNodeCommand';
import { DeleteNodeWithConnectionsCommand } from '../application/commands/DeleteNodeWithConnectionsCommand';
import { MoveNodeCommand } from '../application/commands/MoveNodeCommand';
import { CreateConnectionCommand } from '../application/commands/CreateConnectionCommand';
import { DeleteConnectionCommand } from '../application/commands/DeleteConnectionCommand';
import { UpdateNodeValueCommand } from '../application/commands/UpdateNodeValueCommand';
import type { NodeDefinition } from '../infrastructure/types';
import { Node } from '../domain/entities/Node';
import { Socket } from '../domain/entities/Socket';
import { NodeEditorService } from '../application/services/NodeEditorService';
import { EditorStateManager } from './EditorStateManager';
import { NodeRenderer } from '../infrastructure/rendering/NodeRenderer';
import { ConnectionRenderer } from '../infrastructure/rendering/ConnectionRenderer';
import { IShaderGenerator } from '../infrastructure/shader/IShaderGenerator';
import { EditorEventBus, EditorEventType } from './EditorEventBus';

/**
 * コマンド実行を管理するクラス
 * 
 * コマンドの実行、undo/redo、およびコマンド実行後の状態更新を担当します。
 */
export class CommandExecutor {
  private commandHistory: CommandHistory;
  private nodeRenderer: NodeRenderer;
  private connectionRenderer: ConnectionRenderer;

  constructor(
    private nodeEditorService: NodeEditorService,
    private stateManager: EditorStateManager,
    nodeRenderer: NodeRenderer,
    connectionRenderer: ConnectionRenderer,
    private shaderGenerator: IShaderGenerator,
    private nodeContainer: HTMLElement,
    private eventBus: EditorEventBus
  ) {
    this.commandHistory = new CommandHistory();
    this.nodeRenderer = nodeRenderer;
    this.connectionRenderer = connectionRenderer;
  }

  /**
   * レンダラーを設定（初期化後に呼び出し可能）
   */
  setRenderers(nodeRenderer: NodeRenderer, connectionRenderer: ConnectionRenderer): void {
    this.nodeRenderer = nodeRenderer;
    this.connectionRenderer = connectionRenderer;
  }

  /**
   * ノードを追加
   */
  addNode(definition: NodeDefinition, x: number, y: number): Node | null {
    const command = new AddNodeCommand(definition, x, y);
    this.commandHistory.execute(command);
    
    const allNodes = this.nodeEditorService.getAllNodes();
    const addedNode = allNodes.find(n => 
      n.definitionId === definition.id && 
      Math.abs(n.position.x - x) < 1 && 
      Math.abs(n.position.y - y) < 1
    );
    
    if (addedNode) {
      this.eventBus.emit(EditorEventType.NODE_ADDED, { nodeId: addedNode.id.value });
    }
    
    return addedNode || null;
  }

  /**
   * ノードを移動
   */
  moveNode(nodeId: string, oldX: number, oldY: number, newX: number, newY: number): void {
    if (oldX !== newX || oldY !== newY) {
      const command = new MoveNodeCommand(nodeId, oldX, oldY, newX, newY);
      this.commandHistory.execute(command);
      this.eventBus.emit(EditorEventType.NODE_MOVED, { nodeId, x: newX, y: newY });
    }
  }

  /**
   * 接続を作成
   */
  createConnection(from: Socket, to: Socket): void {
    try {
      const command = new CreateConnectionCommand(from.id.value, to.id.value);
      this.commandHistory.execute(command);
      
      // 作成された接続のIDを取得
      const connections = this.nodeEditorService.getAllConnections();
      const createdConnection = connections.find(conn =>
        conn.fromSocketId.value === from.id.value &&
        conn.toSocketId.value === to.id.value
      );
      if (createdConnection) {
        this.eventBus.emit(EditorEventType.CONNECTION_CREATED, { connectionId: createdConnection.id.value });
      }
    } catch (error) {
      console.warn('Failed to create connection:', error);
    }
  }

  /**
   * 接続を削除
   */
  deleteConnection(connectionId: string): void {
    try {
      const command = new DeleteConnectionCommand(connectionId);
      this.commandHistory.execute(command);
      this.eventBus.emit(EditorEventType.CONNECTION_DELETED, { connectionId });
    } catch (error) {
      console.warn('Failed to delete connection:', error);
    }
  }

  /**
   * ノードの値を更新
   */
  updateNodeValue(nodeId: string, name: string, oldValue: any, newValue: any): void {
    const command = new UpdateNodeValueCommand(nodeId, name, oldValue, newValue);
    this.commandHistory.execute(command);
    this.eventBus.emit(EditorEventType.NODE_VALUE_CHANGED, { nodeId, name, value: newValue });
  }

  /**
   * 選択されたノードを削除
   */
  deleteSelectedNodes(): void {
    const selectedNodes = this.stateManager.getSelectedNodes();
    const nodesToDelete = Array.from(selectedNodes).filter(nodeIdStr => {
      const node = this.nodeEditorService.getNode(nodeIdStr);
      return node?.definitionId !== 'output_color';
    });

    for (const nodeIdStr of nodesToDelete) {
      const command = new DeleteNodeWithConnectionsCommand(nodeIdStr);
      this.commandHistory.execute(command);
    }

    this.stateManager.clearSelectedNodes();
    this.eventBus.emit(EditorEventType.SHADER_UPDATE_NEEDED, {});
  }

  /**
   * Undoを実行
   */
  undo(): boolean {
    if (this.commandHistory.undo()) {
      this.syncStateAfterCommand();
      return true;
    }
    return false;
  }

  /**
   * Redoを実行
   */
  redo(): boolean {
    if (this.commandHistory.redo()) {
      this.syncStateAfterCommand();
      return true;
    }
    return false;
  }

  /**
   * コマンド実行後の状態同期
   */
  private syncStateAfterCommand(): void {
    this.syncNodeCacheToState();
    const allNodes = this.nodeEditorService.getAllNodes();
    const allConnections = this.nodeEditorService.getAllConnections();
    
    // DOMを更新
    for (const node of allNodes) {
      const nodeEl = this.nodeContainer.querySelector(`[data-node-id="${node.id.value}"]`);
      if (!nodeEl) {
        this.nodeRenderer.renderNode(node);
      } else {
        this.nodeRenderer.updateNodePosition(node);
        this.nodeRenderer.updateNodeInputFields(node);
      }
    }
    
    // 存在しないノードのDOMを削除
    const existingNodeIds = new Set(allNodes.map(n => n.id.value));
    const nodeElements = this.nodeContainer.querySelectorAll('.node');
    nodeElements.forEach(el => {
      const nodeId = (el as HTMLElement).dataset.nodeId;
      if (nodeId && !existingNodeIds.has(nodeId)) {
        el.remove();
      }
    });
    
    // 接続を更新
    this.connectionRenderer.updateConnections(allConnections);
    
    // ソケット表示を更新
    for (const node of allNodes) {
      for (const socket of [...node.inputs, ...node.outputs]) {
        this.nodeRenderer.updateSocketDisplay(
          socket.id.value,
          this.isSocketConnected(socket.id.value)
        );
      }
    }
    
    this.eventBus.emit(EditorEventType.SHADER_UPDATE_NEEDED, {});
  }

  /**
   * ノードキャッシュを状態に同期
   */
  private syncNodeCacheToState(): void {
    const allNodes = this.nodeEditorService.getAllNodes();
    this.stateManager.syncNodeCache(
      allNodes.map(n => ({
        id: n.id.value,
        definitionId: n.definitionId,
        x: n.position.x,
        y: n.position.y,
      }))
    );
  }

  /**
   * ソケットが接続されているか判定
   */
  private isSocketConnected(socketId: string): boolean {
    const connections = this.nodeEditorService.getAllConnections();
    return connections.some(conn => 
      conn.fromSocketId.value === socketId || conn.toSocketId.value === socketId
    );
  }
}

