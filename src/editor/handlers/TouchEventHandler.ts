import { EditorStateManager } from '../EditorStateManager';
import { EditorEventBus, EditorEventType } from '../EditorEventBus';
import { InteractionController } from '../interactions/InteractionController';
import { NodeInteractionHandler } from '../interactions/NodeInteractionHandler';
import { ConnectionInteractionHandler } from '../interactions/ConnectionInteractionHandler';
import { IMenuManager } from '../../infrastructure/rendering/IMenuManager';
import { NodeEditorService } from '../../application/services/NodeEditorService';
import { Node } from '../../domain/entities/Node';
import { Socket } from '../../domain/entities/Socket';

/**
 * タッチイベントを処理するクラス
 * 
 * タッチイベントのルーティングと基本的な検証を担当します。
 */
export class TouchEventHandler {
  private readonly LONG_PRESS_DURATION = 500;

  constructor(
    private container: HTMLElement,
    private nodeEditorService: NodeEditorService,
    private stateManager: EditorStateManager,
    private eventBus: EditorEventBus,
    private interactionController: InteractionController,
    private nodeInteractionHandler: NodeInteractionHandler,
    private connectionInteractionHandler: ConnectionInteractionHandler,
    private menuManager: IMenuManager,
  ) {
    // getSocketAtPositionはConnectionInteractionHandlerに渡されるため、ここでは保存しない
  }

  /**
   * タッチイベントリスナーを設定
   */
  setupListeners(): void {
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.container.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
  }

  private handleTouchStart(e: TouchEvent): void {
    if (this.menuManager.containsElement(e.target as HTMLElement)) {
      return;
    }

    if (e.touches.length === 2) {
      e.preventDefault();
      this.clearLongPressTimer();
      this.interactionController.startPinchZoom(e.touches);
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const target = this.getElementAtTouch(touch);
      if (!target) return;

      const socketEl = target.closest('.socket') as HTMLElement | null;
      if (socketEl) {
        e.preventDefault();
        const socketId = socketEl.dataset.socketId;
        const nodeId = socketEl.dataset.nodeId;
        if (socketId && nodeId) {
          const node = this.nodeEditorService.getNode(nodeId);
          if (node) {
            const socket = node.getSocket(socketId);
            if (socket) {
              this.handleSocketTouch(socket, touch);
            }
          }
        }
        return;
      }

      if (target.closest('.node-input-field') || target.closest('.node-vector-input-field') || 
          target.closest('.node-color-picker') || target.closest('.node-large-color-picker')) {
        return;
      }

      const nodeEl = target.closest('.node') as HTMLElement | null;
      if (nodeEl) {
        if (!target.closest('.socket') && 
            !target.closest('.node-input-field') && 
            !target.closest('.node-vector-input-field') &&
            !target.closest('.node-color-picker') &&
            !target.closest('.node-large-color-picker')) {
          e.preventDefault();
          const nodeId = nodeEl.dataset.nodeId;
          if (nodeId) {
            const node = this.nodeEditorService.getNode(nodeId);
            if (node) {
              this.handleNodeTouchStart(touch, node);
              this.stateManager.clearSelectedNodes();
              this.stateManager.addSelectedNode(nodeId);
              this.eventBus.emit(EditorEventType.NODE_SELECTED, {
                nodeIds: this.stateManager.getSelectedNodes()
              });
            }
          }
        }
        return;
      }

      e.preventDefault();
      
      const selectedConnectionId = this.stateManager.getSelectedConnectionId();
      if (selectedConnectionId) {
        this.stateManager.setSelectedConnectionId(null);
        this.eventBus.emit(EditorEventType.CONNECTION_SELECTED, { connectionId: null });
      }

      this.interactionController.startPan(touch.clientX, touch.clientY);

      const touchState = this.stateManager.getTouchState();
      const longPressTimer = window.setTimeout(() => {
        const dragState = this.stateManager.getDragState();
        if (dragState.isDragging && !dragState.nodeId) {
          this.stateManager.setDragState({
            ...dragState,
            isDragging: false,
          });
          this.menuManager.showAddNodeMenu(touchState.longPressX, touchState.longPressY);
        }
        this.stateManager.setTouchState({
          ...touchState,
          longPressTimer: null,
        });
      }, this.LONG_PRESS_DURATION);

      this.stateManager.setTouchState({
        ...touchState,
        longPressX: touch.clientX,
        longPressY: touch.clientY,
        longPressTimer,
      });
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (this.menuManager.containsElement(e.target as HTMLElement)) {
      return;
    }

    const touchState = this.stateManager.getTouchState();

    if (e.touches.length === 2 && touchState.isTwoFingerTouch) {
      e.preventDefault();
      this.clearLongPressTimer();
      this.interactionController.updatePinchZoom(e.touches);
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const touchState = this.stateManager.getTouchState();
      const dx = Math.abs(touch.clientX - touchState.longPressX);
      const dy = Math.abs(touch.clientY - touchState.longPressY);
      if (dx > 10 || dy > 10) {
        this.clearLongPressTimer();
      }

      const dragState = this.stateManager.getDragState();
      if (dragState.isDragging && dragState.nodeId) {
        e.preventDefault();
        this.nodeInteractionHandler.updateDrag(touch.clientX, touch.clientY);
        return;
      }

      if (dragState.isDragging && !dragState.nodeId) {
        e.preventDefault();
        this.interactionController.updatePan(touch.clientX, touch.clientY);
        return;
      }

      const connectionDrag = this.stateManager.getConnectionDrag();
      if (connectionDrag.isConnecting) {
        e.preventDefault();
        this.connectionInteractionHandler.updateDrag(touch.clientX, touch.clientY);
      }
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    this.clearLongPressTimer();

    const touchState = this.stateManager.getTouchState();
    if (touchState.isTwoFingerTouch && e.touches.length < 2) {
      this.interactionController.endPinchZoom();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.interactionController.startPan(touch.clientX, touch.clientY);
      }
      return;
    }

    const connectionDrag = this.stateManager.getConnectionDrag();
    if (connectionDrag.isConnecting && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      this.connectionInteractionHandler.endDrag(touch.clientX, touch.clientY);
    }

    if (e.touches.length === 0) {
      this.nodeInteractionHandler.endDrag();
      this.interactionController.endPan();
    }
  }

  private handleSocketTouch(socket: Socket, _touch: Touch): void {
    if (socket.direction === 'input' && this.isSocketConnected(socket.id.value)) {
      this.connectionInteractionHandler.disconnect(socket.id.value);
      return;
    }
    this.connectionInteractionHandler.startDrag(socket);
  }

  private handleNodeTouchStart(touch: Touch, node: Node): void {
    this.nodeInteractionHandler.startDrag(node, touch.clientX, touch.clientY);
  }

  private clearLongPressTimer(): void {
    const touchState = this.stateManager.getTouchState();
    if (touchState.longPressTimer !== null) {
      clearTimeout(touchState.longPressTimer);
      this.stateManager.setTouchState({
        ...touchState,
        longPressTimer: null,
      });
    }
  }

  private getElementAtTouch(touch: Touch): HTMLElement | null {
    return document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
  }

  private isSocketConnected(socketId: string): boolean {
    return this.nodeEditorService.isSocketConnected(socketId);
  }
}

