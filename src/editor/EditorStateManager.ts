import type { EditorState, DragState, ConnectionDragState } from './types';

/**
 * タッチ操作の状態を管理するインターフェース
 */
export interface TouchState {
  initialDistance: number;
  initialZoom: number;
  longPressTimer: number | null;
  longPressX: number;
  longPressY: number;
  isTwoFingerTouch: boolean;
  pinchCenterX: number;
  pinchCenterY: number;
}

/**
 * エディターの状態を管理するクラス
 * 
 * EditorState、DragState、ConnectionDragState、TouchStateの管理を担当します。
 */
export class EditorStateManager {
  private state: EditorState;
  private dragState: DragState;
  private connectionDrag: ConnectionDragState;
  private touchState: TouchState;
  private selectedConnectionId: string | null = null;
  private nodeDragStartPosition: { nodeId: string; x: number; y: number } | null = null;

  constructor() {
    this.state = {
      nodes: new Map(),
      selectedNodes: new Set(),
      pan: { x: 0, y: 0 },
      zoom: 1,
    };

    this.dragState = {
      isDragging: false,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
    };

    this.connectionDrag = {
      isConnecting: false,
      currentX: 0,
      currentY: 0,
    };

    this.touchState = {
      initialDistance: 0,
      initialZoom: 1,
      longPressTimer: null,
      longPressX: 0,
      longPressY: 0,
      isTwoFingerTouch: false,
      pinchCenterX: 0,
      pinchCenterY: 0,
    };
  }

  getState(): EditorState {
    return this.state;
  }

  getDragState(): DragState {
    return this.dragState;
  }

  getConnectionDrag(): ConnectionDragState {
    return this.connectionDrag;
  }

  getTouchState(): TouchState {
    return this.touchState;
  }

  getSelectedConnectionId(): string | null {
    return this.selectedConnectionId;
  }

  getNodeDragStartPosition(): { nodeId: string; x: number; y: number } | null {
    return this.nodeDragStartPosition;
  }

  setDragState(state: DragState): void {
    this.dragState = state;
  }

  setConnectionDrag(state: ConnectionDragState): void {
    this.connectionDrag = state;
  }

  setTouchState(state: TouchState): void {
    this.touchState = state;
  }

  setSelectedConnectionId(id: string | null): void {
    this.selectedConnectionId = id;
  }

  setNodeDragStartPosition(position: { nodeId: string; x: number; y: number } | null): void {
    this.nodeDragStartPosition = position;
  }

  updatePan(x: number, y: number): void {
    this.state.pan.x = x;
    this.state.pan.y = y;
  }

  updateZoom(zoom: number): void {
    this.state.zoom = zoom;
  }

  clearSelectedNodes(): void {
    this.state.selectedNodes.clear();
  }

  addSelectedNode(nodeId: string): void {
    this.state.selectedNodes.add(nodeId);
  }

  getSelectedNodes(): Set<string> {
    return this.state.selectedNodes;
  }

  syncNodeCache(nodes: Array<{ id: string; definitionId: string; x: number; y: number }>): void {
    this.state.nodes.clear();
    for (const node of nodes) {
      this.state.nodes.set(node.id, {
        id: node.id,
        definitionId: node.definitionId,
        x: node.x,
        y: node.y,
        inputs: [],
        outputs: [],
        values: {},
      });
    }
  }
}

