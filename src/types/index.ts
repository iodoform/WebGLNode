// Socket types for WGSL (used in JSON definitions)
export type SocketType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'color' | 'sampler' | 'texture2d';

// Socket direction (used in JSON definitions)
export type SocketDirection = 'input' | 'output';

// Renderer type
export type RendererType = 'webgpu' | 'webgl';

// Socket definition from JSON
export interface SocketDefinition {
  name: string;
  type: SocketType;
  default?: number | number[];
  description?: string;
}

// Shader code definition for both backends
export interface ShaderCodeDefinition {
  webgpu: string; // WGSL code
  webgl: string;  // GLSL code
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
  code: ShaderCodeDefinition; // Shader code for both backends
  customUI?: 'colorPicker'; // Special UI type
}

