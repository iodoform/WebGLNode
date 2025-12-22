import { NodeEditor } from './editor/NodeEditor';
import { WebGPURenderer } from './webgpu/WebGPURenderer';
import './styles/main.css';

class App {
  private editor: NodeEditor;
  private renderer: WebGPURenderer;
  private codePreview: HTMLElement;
  private fpsDisplay: HTMLElement;
  private timeDisplay: HTMLElement;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;

  constructor() {
    // Setup preview panel
    this.setupPreviewPanel();
    
    // Initialize node editor
    this.editor = new NodeEditor('node-editor');
    
    // Initialize WebGPU renderer
    const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
    this.renderer = new WebGPURenderer(canvas);
    
    // Get elements for display
    this.codePreview = document.getElementById('code-preview')!;
    this.fpsDisplay = document.getElementById('fps-value')!;
    this.timeDisplay = document.getElementById('time-value')!;
    
    this.initialize();
  }

  private setupPreviewPanel(): void {
    const previewPanel = document.getElementById('preview-panel')!;
    
    previewPanel.innerHTML = `
      <div class="preview-header">Preview</div>
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
      <div class="preview-header">Generated WGSL</div>
      <div id="code-preview" class="code-preview"></div>
    `;
  }

  private async initialize(): Promise<void> {
    // Initialize WebGPU
    const success = await this.renderer.initialize();
    if (!success) {
      this.showError('WebGPU is not supported in this browser. Please use Chrome 113+ or Edge 113+.');
      return;
    }

    // Set error callback
    this.renderer.setErrorCallback((error) => {
      console.error('Shader Error:', error);
    });

    // Connect editor to renderer
    this.editor.setShaderUpdateCallback((code) => {
      this.renderer.updateShader(code);
      this.updateCodePreview(code);
    });

    // Generate initial shader
    const initialShader = this.editor.generateShader();
    this.renderer.updateShader(initialShader);
    this.updateCodePreview(initialShader);

    // Resize canvas
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Start rendering
    this.renderer.start();
    
    // Start stats update loop
    this.updateStats();
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
    const highlighted = code
      .replace(/\b(fn|let|var|return|if|else|for|struct|@\w+)\b/g, '<span class="keyword">$1</span>')
      .replace(/\b(\d+\.?\d*f?)\b/g, '<span class="number">$1</span>')
      .replace(/(\/\/.*)/g, '<span class="comment">$1</span>')
      .replace(/\b(vec2f|vec3f|vec4f|f32|u32|i32)\b/g, '<span class="function">$1</span>');

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
      max-width: 400px;
    `;
    errorDiv.innerHTML = `
      <div style="color: #ef4444; font-size: 24px; margin-bottom: 12px;">⚠️ WebGPU Error</div>
      <div>${message}</div>
    `;
    document.body.appendChild(errorDiv);
  }
}

// Start app
new App();

