import { EditorStateManager } from '../EditorStateManager';
import { CoordinateCalculator } from '../utils/CoordinateCalculator';

/**
 * インタラクション操作を担当するクラス
 * 
 * ドラッグ、パン、ズームなどの操作ロジックを担当します。
 */
export class InteractionController {
  constructor(
    private container: HTMLElement,
    private stateManager: EditorStateManager,
    private updateTransform: () => void
  ) {}

  /**
   * パン操作を開始
   */
  startPan(clientX: number, clientY: number): void {
    const state = this.stateManager.getState();
    this.stateManager.setDragState({
      isDragging: true,
      startX: clientX,
      startY: clientY,
      offsetX: state.pan.x,
      offsetY: state.pan.y,
    });
    this.container.style.cursor = 'grabbing';
  }

  /**
   * パン操作を更新
   */
  updatePan(clientX: number, clientY: number): void {
    const dragState = this.stateManager.getDragState();
    if (!dragState.isDragging || dragState.nodeId) return;

    const newPos = CoordinateCalculator.calculatePanPosition(
      dragState.startX,
      dragState.startY,
      clientX,
      clientY,
      dragState.offsetX,
      dragState.offsetY
    );
    this.stateManager.updatePan(newPos.x, newPos.y);
    this.updateTransform();
  }

  /**
   * パン操作を終了
   */
  endPan(): void {
    const dragState = this.stateManager.getDragState();
    this.stateManager.setDragState({
      ...dragState,
      isDragging: false,
      nodeId: undefined,
    });
    this.container.style.cursor = 'grab';
  }

  /**
   * ズーム操作を実行
   */
  zoom(deltaY: number, clientX: number, clientY: number): void {
    const state = this.stateManager.getState();
    const delta = deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(2, state.zoom * delta));
    
    const rect = this.container.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    
    const newPan = CoordinateCalculator.calculatePanForZoom(
      mouseX,
      mouseY,
      state.pan.x,
      state.pan.y,
      state.zoom,
      newZoom
    );
    
    this.stateManager.updatePan(newPan.x, newPan.y);
    this.stateManager.updateZoom(newZoom);
    this.updateTransform();
  }

  /**
   * ピンチズーム操作を開始
   */
  startPinchZoom(touches: TouchList): void {
    const state = this.stateManager.getState();
    const distance = CoordinateCalculator.getTouchDistance(touches);
    const center = CoordinateCalculator.getTouchCenter(touches);
    
    const touchState = this.stateManager.getTouchState();
    this.stateManager.setTouchState({
      ...touchState,
      isTwoFingerTouch: true,
      initialDistance: distance,
      initialZoom: state.zoom,
      pinchCenterX: center.x,
      pinchCenterY: center.y,
    });
  }

  /**
   * ピンチズーム操作を更新
   */
  updatePinchZoom(touches: TouchList): void {
    const touchState = this.stateManager.getTouchState();
    if (!touchState.isTwoFingerTouch) return;

    const currentDistance = CoordinateCalculator.getTouchDistance(touches);
    const scale = currentDistance / touchState.initialDistance;
    const newZoom = Math.max(0.25, Math.min(2, touchState.initialZoom * scale));

    const rect = this.container.getBoundingClientRect();
    const centerX = touchState.pinchCenterX - rect.left;
    const centerY = touchState.pinchCenterY - rect.top;

    const state = this.stateManager.getState();
    const newPan = CoordinateCalculator.calculatePanForPinchZoom(
      centerX,
      centerY,
      state.pan.x,
      state.pan.y,
      state.zoom,
      newZoom
    );

    this.stateManager.updatePan(newPan.x, newPan.y);
    this.stateManager.updateZoom(newZoom);
    this.updateTransform();
  }

  /**
   * ピンチズーム操作を終了
   */
  endPinchZoom(): void {
    const touchState = this.stateManager.getTouchState();
    this.stateManager.setTouchState({
      ...touchState,
      isTwoFingerTouch: false,
    });
  }
}

