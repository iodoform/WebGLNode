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
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isChrome = /CriOS|Chrome/.test(navigator.userAgent);
      const userAgent = navigator.userAgent;
      const hasGpu = typeof navigator.gpu !== 'undefined';
      
      // 詳細なデバッグ情報を収集
      let debugInfo = `\n\nデバッグ情報:\n`;
      debugInfo += `- User Agent: ${userAgent}\n`;
      debugInfo += `- navigator.gpu: ${hasGpu ? '存在' : '未定義'}\n`;
      
      // プロトコルの確認（WebGPUはHTTPSまたはlocalhostでのみ利用可能）
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
      const isSecure = protocol === 'https:' || isLocalhost;
      debugInfo += `- プロトコル: ${protocol}\n`;
      debugInfo += `- ホスト名: ${hostname}\n`;
      debugInfo += `- セキュア接続: ${isSecure ? 'はい' : 'いいえ'}\n`;
      if (!isSecure) {
        debugInfo += `  ⚠️ WebGPUはHTTPS接続またはlocalhostでのみ利用可能です\n`;
        debugInfo += `  ⚠️ HTTP接続ではnavigator.gpuが未定義になります\n`;
      }
      
      // iOSバージョンの検出を試みる
      const iosVersionMatch = userAgent.match(/OS (\d+)_(\d+)/);
      if (iosVersionMatch) {
        const major = parseInt(iosVersionMatch[1]);
        const minor = parseInt(iosVersionMatch[2]);
        debugInfo += `- iOS バージョン: ${major}.${minor}\n`;
        if (major < 17) {
          debugInfo += `  ⚠️ iOS 17.0以降が必要です\n`;
        } else {
          debugInfo += `  ✓ iOS 17.0以降の要件を満たしています\n`;
        }
      }
      
      // Safariバージョンの確認
      const safariVersionMatch = userAgent.match(/Version\/(\d+)\.(\d+)/);
      if (safariVersionMatch) {
        const safariMajor = parseInt(safariVersionMatch[1]);
        debugInfo += `- Safari バージョン: ${safariVersionMatch[0]}\n`;
        if (safariMajor < 17) {
          debugInfo += `  ⚠️ Safari 17.0以降が必要です\n`;
        }
      }
      
      if (hasGpu) {
        try {
          const adapter = await navigator.gpu!.requestAdapter();
          debugInfo += `- requestAdapter(): ${adapter ? '成功' : 'nullを返却'}\n`;
          if (adapter) {
            try {
              const device = await adapter.requestDevice();
              debugInfo += `- requestDevice(): 成功\n`;
              device.destroy(); // クリーンアップ
            } catch (e) {
              debugInfo += `- requestDevice(): エラー - ${e}\n`;
            }
          } else {
            debugInfo += `  ⚠️ アダプターが取得できませんでした。WebGPUが無効化されている可能性があります。\n`;
          }
        } catch (e) {
          debugInfo += `- requestAdapter(): エラー - ${e}\n`;
        }
        
        const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
        if (canvas) {
          const context = canvas.getContext('webgpu');
          debugInfo += `- getContext('webgpu'): ${context ? '成功' : 'nullを返却'}\n`;
          if (!context) {
            debugInfo += `  ⚠️ WebGPUコンテキストが取得できませんでした。\n`;
            // 代替として2dコンテキストが取得できるか確認
            const test2d = canvas.getContext('2d');
            debugInfo += `- getContext('2d'): ${test2d ? '成功' : '失敗'} (キャンバス自体は有効)\n`;
          }
        } else {
          debugInfo += `- キャンバス要素が見つかりません\n`;
        }
      }
      
      let errorMessage = 'WebGPU is not supported in this browser.';
      if (isIOS && isChrome) {
        errorMessage += ' iOSのChromeでWebGPUを使用するには、iOS 17.0以降が必要です。';
        errorMessage += '\n\n注意: iOSのChromeはSafariのWebKitを使用するため、SafariでWebGPUが有効になっている必要があります。';
      } else if (isIOS) {
        errorMessage += ' iOSでWebGPUを使用するには、iOS 17.0以降のSafariが必要です。';
        if (!isSecure) {
          errorMessage += '\n\n⚠️ 重要: WebGPUはHTTPS接続またはlocalhostでのみ利用可能です。';
          errorMessage += '\n現在HTTP接続のため、navigator.gpuが未定義になっています。';
          errorMessage += '\nHTTPS接続に切り替えるか、localhostで実行してください。';
        } else if (!hasGpu) {
          errorMessage += '\n\n⚠️ navigator.gpuが未定義です。';
          errorMessage += '\n考えられる原因:';
          errorMessage += '\n1. Safariの設定でWebGPUが無効になっている';
          errorMessage += '\n2. 実験的機能としてWebGPUが無効になっている';
          errorMessage += '\n3. デバイスの制限（古いデバイスなど）';
          errorMessage += '\n\n対処法:';
          errorMessage += '\n- Safariの設定 > 高度な設定 > 実験的機能 でWebGPUを有効にする';
          errorMessage += '\n- Safariを再起動する';
        }
      } else {
        errorMessage += ' Please use Chrome 113+ or Edge 113+.';
        if (!isSecure) {
          errorMessage += '\n\n⚠️ WebGPUはHTTPS接続またはlocalhostでのみ利用可能です。';
        }
      }
      
      errorMessage += debugInfo;
      
      console.error('WebGPU初期化失敗:', errorMessage);
      this.showError(errorMessage);
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

