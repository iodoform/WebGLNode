// Socket types for WGSL (used in JSON definitions)
export type SocketType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'color' | 'sampler' | 'texture2d';

// Socket direction (used in JSON definitions)
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

