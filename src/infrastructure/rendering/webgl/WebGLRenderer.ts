import { IRenderer } from '../IRenderer';
import { RendererType } from '../../types';

export class WebGLRenderer implements IRenderer {
  readonly rendererType: RendererType = 'webgl';
  
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  
  private startTime: number = performance.now();
  private mouseX: number = 0.5;
  private mouseY: number = 0.5;
  private animationId: number = 0;
  private isRunning: boolean = false;
  
  private currentVertexShader: string = '';
  private currentFragmentShader: string = '';
  private onError?: (error: string) => void;

  // Uniform locations
  private timeLocation: WebGLUniformLocation | null = null;
  private resolutionLocation: WebGLUniformLocation | null = null;
  private mouseLocation: WebGLUniformLocation | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupMouseTracking();
  }

  private setupMouseTracking(): void {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) / rect.width;
      this.mouseY = 1.0 - (e.clientY - rect.top) / rect.height;
    });
  }

  async initialize(): Promise<boolean> {
    // Get WebGL2 context
    const gl = this.canvas.getContext('webgl2');
    if (!gl) {
      console.error('WebGL2 is not supported');
      return false;
    }
    this.gl = gl;

    // Create VAO for full-screen quad
    this.vao = gl.createVertexArray();
    if (!this.vao) {
      console.error('Failed to create VAO');
      return false;
    }

    return true;
  }

  setErrorCallback(callback: (error: string) => void): void {
    this.onError = callback;
  }

  updateShader(shaderCode: string): boolean {
    // Parse JSON string containing vertex and fragment shaders
    let shaders: { vertex: string; fragment: string };
    try {
      shaders = JSON.parse(shaderCode);
    } catch {
      // If not JSON, assume it's just fragment shader code (for backwards compatibility)
      this.onError?.('Invalid shader format: expected JSON with vertex and fragment shaders');
      return false;
    }

    return this.updateShaders(shaders.vertex, shaders.fragment);
  }

  updateShaders(vertexSource: string, fragmentSource: string): boolean {
    if (!this.gl) return false;
    const gl = this.gl;

    if (vertexSource === this.currentVertexShader && 
        fragmentSource === this.currentFragmentShader) {
      return true;
    }

    // Compile vertex shader
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    if (!vertexShader) {
      return false;
    }

    // Compile fragment shader
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!fragmentShader) {
      gl.deleteShader(vertexShader);
      return false;
    }

    // Create program
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      this.onError?.('Failed to create program');
      return false;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // Check link status
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program) || 'Unknown link error';
      console.error('Program link error:', error);
      this.onError?.(error);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteProgram(program);
      return false;
    }

    // Clean up old program
    if (this.program) {
      gl.deleteProgram(this.program);
    }

    this.program = program;
    this.currentVertexShader = vertexSource;
    this.currentFragmentShader = fragmentSource;

    // Get uniform locations
    this.timeLocation = gl.getUniformLocation(program, 'u_time');
    this.resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    this.mouseLocation = gl.getUniformLocation(program, 'u_mouse');

    // Clean up shaders (they're linked to program now)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return true;
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const gl = this.gl;

    const shader = gl.createShader(type);
    if (!shader) {
      this.onError?.('Failed to create shader');
      return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader) || 'Unknown compile error';
      const shaderType = type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment';
      console.error(`${shaderType} shader compile error:`, error);
      this.onError?.(`${shaderType} shader: ${error}`);
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private render = (): void => {
    if (!this.isRunning || !this.gl || !this.program) return;
    const gl = this.gl;

    const time = (performance.now() - this.startTime) / 1000;

    // Clear
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use program
    gl.useProgram(this.program);

    // Set uniforms
    if (this.timeLocation) {
      gl.uniform1f(this.timeLocation, time);
    }
    if (this.resolutionLocation) {
      gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
    }
    if (this.mouseLocation) {
      gl.uniform2f(this.mouseLocation, this.mouseX, this.mouseY);
    }

    // Bind VAO and draw
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    this.animationId = requestAnimationFrame(this.render);
  };

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = performance.now();
    this.render();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  getTime(): number {
    return (performance.now() - this.startTime) / 1000;
  }

  resetTime(): void {
    this.startTime = performance.now();
  }

  destroy(): void {
    this.stop();
    if (this.gl) {
      if (this.program) {
        this.gl.deleteProgram(this.program);
      }
      if (this.vao) {
        this.gl.deleteVertexArray(this.vao);
      }
    }
  }
}

