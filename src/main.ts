import { NodeEditor } from './editor/NodeEditor';
import { WebGPURenderer } from './webgpu/WebGPURenderer';
import { WebGLRenderer } from './webgl/WebGLRenderer';
import { WGSLGenerator } from './infrastructure/shader/WGSLGenerator';
import { GLSLGenerator } from './infrastructure/shader/GLSLGenerator';
import { RendererCapability } from './infrastructure/rendering/RendererCapability';
import { IRenderer } from './infrastructure/rendering/IRenderer';
import { IShaderGenerator } from './infrastructure/shader/IShaderGenerator';
import { RendererType } from './types';
import './styles/main.css';

class App {
  private editor!: NodeEditor;
  private renderer!: IRenderer;
  private shaderGenerator!: IShaderGenerator;
  private codePreview!: HTMLElement;
  private fpsDisplay!: HTMLElement;
  private timeDisplay!: HTMLElement;
  private rendererTypeDisplay!: HTMLElement;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;
  private rendererType: RendererType = 'webgpu';

  constructor() {
    // Setup preview panel
    this.setupPreviewPanel();
    this.initialize();
  }

  private setupPreviewPanel(): void {
    const previewPanel = document.getElementById('preview-panel')!;
    
    previewPanel.innerHTML = `
      <div class="preview-header">Preview <span id="renderer-type" class="renderer-badge"></span></div>
      <canvas id="preview-canvas"></canvas>
      <div class="preview-controls">
        <div class="preview-stat">
          <span>FPS</span>
          <span id="fps-value" class="preview-stat-value">0</span>
        </div>
        <div class="preview-stat">
          <span>Time</span>
          <span id="time-value" class="preview-stat-value">0.00s</span>
        </div>
      </div>
      <div class="preview-header">Generated Shader</div>
      <div id="code-preview" class="code-preview"></div>
    `;
  }

  private async initialize(): Promise<void> {
    // Get elements for display
    this.codePreview = document.getElementById('code-preview')!;
    this.fpsDisplay = document.getElementById('fps-value')!;
    this.timeDisplay = document.getElementById('time-value')!;
    this.rendererTypeDisplay = document.getElementById('renderer-type')!;

    // Detect preferred renderer
    const preferredRenderer = await RendererCapability.getPreferredRenderer();
    
    if (!preferredRenderer) {
      this.showError('No supported graphics API found. This application requires WebGPU or WebGL2.');
      return;
    }

    this.rendererType = preferredRenderer;
    const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;

    // Initialize appropriate renderer and shader generator
    if (preferredRenderer === 'webgpu') {
      this.renderer = new WebGPURenderer(canvas);
      this.shaderGenerator = new WGSLGenerator();
      this.rendererTypeDisplay.textContent = 'WebGPU';
      this.rendererTypeDisplay.className = 'renderer-badge webgpu';
    } else {
      this.renderer = new WebGLRenderer(canvas);
      this.shaderGenerator = new GLSLGenerator();
      this.rendererTypeDisplay.textContent = 'WebGL';
      this.rendererTypeDisplay.className = 'renderer-badge webgl';
    }

    // Initialize renderer
    const success = await this.renderer.initialize();
    if (!success) {
      // Try fallback to WebGL if WebGPU failed
      if (preferredRenderer === 'webgpu') {
        console.log('WebGPU initialization failed, trying WebGL fallback...');
        const webglAvailable = RendererCapability.checkWebGLSupport();
        if (webglAvailable) {
          this.renderer = new WebGLRenderer(canvas);
          this.shaderGenerator = new GLSLGenerator();
          this.rendererType = 'webgl';
          this.rendererTypeDisplay.textContent = 'WebGL';
          this.rendererTypeDisplay.className = 'renderer-badge webgl';
          
          const fallbackSuccess = await this.renderer.initialize();
          if (!fallbackSuccess) {
            this.showError('Failed to initialize graphics. Both WebGPU and WebGL initialization failed.');
            return;
          }
        } else {
          this.showError('WebGPU initialization failed and WebGL is not available.');
          return;
        }
      } else {
        this.showError('Failed to initialize WebGL renderer.');
        return;
      }
    }

    // Initialize node editor with appropriate shader generator
    this.editor = new NodeEditor('node-editor', this.shaderGenerator);

    // Set error callback
    this.renderer.setErrorCallback((error) => {
      console.error('Shader Error:', error);
    });

    // Connect editor to renderer
    this.editor.setShaderUpdateCallback((code) => {
      console.log('[ShaderUpdate] Renderer type:', this.rendererType);
      console.log('[ShaderUpdate] Generated code:', code);
      
      if (this.rendererType === 'webgl') {
        // For WebGL, code is already JSON-stringified from GLSLGenerator.generate()
        const success = this.renderer.updateShader(code);
        console.log('[ShaderUpdate] WebGL shader update success:', success);
        const shaders = JSON.parse(code) as { vertex: string; fragment: string };
        this.updateCodePreview(shaders.fragment);
      } else {
        const success = this.renderer.updateShader(code);
        console.log('[ShaderUpdate] WebGPU shader update success:', success);
        this.updateCodePreview(code);
      }
    });

    // Generate initial shader
    const initialShader = this.editor.generateShader();
    if (this.rendererType === 'webgl') {
      // initialShader is already JSON-stringified from GLSLGenerator.generate()
      this.renderer.updateShader(initialShader);
      const shaders = JSON.parse(initialShader) as { vertex: string; fragment: string };
      this.updateCodePreview(shaders.fragment);
    } else {
      this.renderer.updateShader(initialShader);
      this.updateCodePreview(initialShader);
    }

    // Resize canvas
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Start rendering
    this.renderer.start();
    
    // Start stats update loop
    this.updateStats();

    // Log renderer info
    const info = await RendererCapability.getDetailedInfo();
    console.log('Renderer capability info:', info);
  }

  private resizeCanvas(): void {
    const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
  }

  private updateStats = (): void => {
    this.frameCount++;
    const now = performance.now();
    
    if (now - this.lastFrameTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }

    if (this.fpsDisplay) {
      this.fpsDisplay.textContent = String(this.fps);
    }
    
    if (this.timeDisplay) {
      this.timeDisplay.textContent = `${this.renderer.getTime().toFixed(2)}s`;
    }

    requestAnimationFrame(this.updateStats);
  };

  private updateCodePreview(code: string): void {
    if (!this.codePreview) return;

    // Simple syntax highlighting
    let highlighted: string;
    
    if (this.rendererType === 'webgpu') {
      // WGSL highlighting
      highlighted = code
        .replace(/\b(fn|let|var|return|if|else|for|struct|@\w+)\b/g, '<span class="keyword">$1</span>')
        .replace(/\b(\d+\.?\d*f?)\b/g, '<span class="number">$1</span>')
        .replace(/(\/\/.*)/g, '<span class="comment">$1</span>')
        .replace(/\b(vec2f|vec3f|vec4f|f32|u32|i32)\b/g, '<span class="function">$1</span>');
    } else {
      // GLSL highlighting
      highlighted = code
        .replace(/\b(void|float|vec2|vec3|vec4|int|bool|uniform|in|out|return|if|else|for)\b/g, '<span class="keyword">$1</span>')
        .replace(/\b(\d+\.?\d*f?)\b/g, '<span class="number">$1</span>')
        .replace(/(\/\/.*)/g, '<span class="comment">$1</span>')
        .replace(/(#version.*)/g, '<span class="comment">$1</span>')
        .replace(/\b(precision|highp|mediump|lowp)\b/g, '<span class="function">$1</span>');
    }

    this.codePreview.innerHTML = highlighted;
  }

  private showError(message: string): void {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #1a1a2e;
      border: 2px solid #ef4444;
      border-radius: 12px;
      padding: 24px 32px;
      color: #e0e0e0;
      font-size: 16px;
      text-align: center;
      z-index: 10000;
      max-width: 500px;
      white-space: pre-wrap;
    `;
    errorDiv.innerHTML = `
      <div style="color: #ef4444; font-size: 24px; margin-bottom: 12px;">⚠️ Graphics Error</div>
      <div>${message}</div>
    `;
    document.body.appendChild(errorDiv);
  }
}

// Start app
new App();
