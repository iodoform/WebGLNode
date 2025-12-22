// Socket types for WGSL
export type SocketType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'color' | 'sampler' | 'texture2d';

// Socket direction
export type SocketDirection = 'input' | 'output';

// Socket definition from JSON
export interface SocketDefinition {
  name: string;
  type: SocketType;
  default?: number | number[];
  description?: string;
}

// Node definition loaded from JSON
export interface NodeDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  color: string;
  inputs: SocketDefinition[];
  outputs: SocketDefinition[];
  code: string; // WGSL function template
  customUI?: 'colorPicker'; // Special UI type
}

// Runtime socket instance
export interface Socket {
  id: string;
  nodeId: string;
  name: string;
  type: SocketType;
  direction: SocketDirection;
  value?: number | number[];
  connectedTo?: string; // socket id
}

// Runtime node instance
export interface Node {
  id: string;
  definitionId: string;
  x: number;
  y: number;
  inputs: Socket[];
  outputs: Socket[];
  values: Record<string, number | number[]>;
}

// Connection between sockets
export interface Connection {
  id: string;
  fromNodeId: string;
  fromSocketId: string;
  toNodeId: string;
  toSocketId: string;
}

// Editor state
export interface EditorState {
  nodes: Map<string, Node>;
  connections: Map<string, Connection>;
  selectedNodes: Set<string>;
  pan: { x: number; y: number };
  zoom: number;
}

// WGSL generation context
export interface WGSLContext {
  uniforms: string[];
  functions: string[];
  mainBody: string[];
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
  fromSocket?: Socket;
  currentX: number;
  currentY: number;
}

