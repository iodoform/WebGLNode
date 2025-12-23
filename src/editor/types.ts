/**
 * エディターの状態管理用の型定義
 */

// Editor state
export interface EditorState {
  nodes: Map<string, {
    id: string;
    definitionId: string;
    x: number;
    y: number;
    inputs: any[];
    outputs: any[];
    values: Record<string, number | number[]>;
  }>;
  selectedNodes: Set<string>;
  pan: { x: number; y: number };
  zoom: number;
}

// Event types
export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  nodeId?: string;
  offsetX: number;
  offsetY: number;
}

export interface ConnectionDragState {
  isConnecting: boolean;
  fromSocket?: {
    id: string;
    nodeId: string;
    name: string;
    type: string;
    direction: string;
  };
  currentX: number;
  currentY: number;
}

