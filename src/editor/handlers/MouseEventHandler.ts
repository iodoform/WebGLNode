import { NodeEditorService } from '../../application/services/NodeEditorService';
import { EditorStateManager } from '../EditorStateManager';
import { EditorEventBus, EditorEventType } from '../EditorEventBus';
import { InteractionController } from '../interactions/InteractionController';
import { NodeInteractionHandler } from '../interactions/NodeInteractionHandler';
import { ConnectionInteractionHandler } from '../interactions/ConnectionInteractionHandler';
import { IMenuManager } from '../../infrastructure/rendering/IMenuManager';
import { Node } from '../../domain/entities/Node';
import { Socket } from '../../domain/entities/Socket';

/**
 * マウスイベントを処理するクラス
 * 
 * マウスイベントのルーティングと基本的な検証を担当します。
 */
export class MouseEventHandler {
  private boundMouseMoveHandler: (e: MouseEvent) => void;
  private boundMouseUpHandler: (e: MouseEvent) => void;

  constructor(
    private container: HTMLElement,
    private nodeEditorService: NodeEditorService,
    private stateManager: EditorStateManager,
    private eventBus: EditorEventBus,
    private interactionController: InteractionController,
    private nodeInteractionHandler: NodeInteractionHandler,
    private connectionInteractionHandler: ConnectionInteractionHandler,
    private menuManager: IMenuManager
  ) {
    this.boundMouseMoveHandler = this.handleMouseMove.bind(this);
    this.boundMouseUpHandler = this.handleMouseUp.bind(this);
  }

  /**
   * マウスイベントリスナーを設定
   */
  setupListeners(): void {
    this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.container.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.container.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.container.addEventListener('wheel', this.handleWheel.bind(this));
    this.container.addEventListener('contextmenu', this.handleContextMenu.bind(this));
  }

  /**
   * マウス移動ハンドラーを取得（document用）
   */
  getBoundMouseMoveHandler(): (e: MouseEvent) => void {
    return this.boundMouseMoveHandler;
  }

  /**
   * マウスアップハンドラーを取得（document用）
   */
  getBoundMouseUpHandler(): (e: MouseEvent) => void {
    return this.boundMouseUpHandler;
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    
    const dragState = this.stateManager.getDragState();
    if (dragState.nodeId) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('.node')) return;
    if (target.closest('.connection')) return;

    const selectedConnectionId = this.stateManager.getSelectedConnectionId();
    if (selectedConnectionId) {
      this.stateManager.setSelectedConnectionId(null);
      this.eventBus.emit(EditorEventType.CONNECTION_SELECTED, { connectionId: null });
    }

    this.interactionController.startPan(e.clientX, e.clientY);
  }

  private handleMouseMove(e: MouseEvent): void {
    const dragState = this.stateManager.getDragState();
    const connectionDrag = this.stateManager.getConnectionDrag();

    if (dragState.isDragging && dragState.nodeId) {
      e.preventDefault();
      this.nodeInteractionHandler.updateDrag(e.clientX, e.clientY);
    } else if (dragState.isDragging && !dragState.nodeId) {
      this.interactionController.updatePan(e.clientX, e.clientY);
    } else if (connectionDrag.isConnecting) {
      this.connectionInteractionHandler.updateDrag(e.clientX, e.clientY);
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    const connectionDrag = this.stateManager.getConnectionDrag();
    const dragState = this.stateManager.getDragState();

    if (connectionDrag.isConnecting) {
      this.connectionInteractionHandler.endDrag(e.clientX, e.clientY);
    }

    if (dragState.nodeId) {
      this.nodeInteractionHandler.endDrag();
      document.removeEventListener('mousemove', this.boundMouseMoveHandler);
      document.removeEventListener('mouseup', this.boundMouseUpHandler);
    }

    this.interactionController.endPan();
  }

  private handleWheel(e: WheelEvent): void {
    if (this.menuManager.containsElement(e.target as HTMLElement)) {
      return;
    }
    
    e.preventDefault();
    this.interactionController.zoom(e.deltaY, e.clientX, e.clientY);
  }

  private handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    this.menuManager.showAddNodeMenu(e.clientX, e.clientY);
  }

  /**
   * ソケットクリック処理（NodeRendererから呼ばれる）
   */
  handleSocketClick(socket: Socket, e: MouseEvent): void {
    e.stopPropagation();
    
    if (socket.direction === 'input' && this.isSocketConnected(socket.id.value)) {
      this.connectionInteractionHandler.disconnect(socket.id.value);
      return;
    }
    
    if (e.type === 'mousedown') {
      this.connectionInteractionHandler.startDrag(socket);
    } else if (e.type === 'mouseup') {
      this.connectionInteractionHandler.endDrag(e.clientX, e.clientY);
    }
  }

  /**
   * ノードドラッグ開始処理（NodeRendererから呼ばれる）
   */
  handleNodeDragStart(e: MouseEvent, node: Node): void {
    e.stopPropagation();
    this.nodeInteractionHandler.startDrag(node, e.clientX, e.clientY);
    document.addEventListener('mousemove', this.boundMouseMoveHandler);
    document.addEventListener('mouseup', this.boundMouseUpHandler);
  }

  /**
   * ノードクリック処理（NodeRendererから呼ばれる）
   */
  handleNodeClick(node: Node, e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest('.socket')) {
      this.nodeInteractionHandler.click(node, e.shiftKey);
      this.eventBus.emit(EditorEventType.NODE_SELECTED, {
        nodeIds: this.stateManager.getSelectedNodes()
      });
    }
  }

  private isSocketConnected(socketId: string): boolean {
    return this.nodeEditorService.isSocketConnected(socketId);
  }
}

