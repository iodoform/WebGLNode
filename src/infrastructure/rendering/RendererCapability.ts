import { RendererType } from '../../types';

/**
 * レンダリング機能の検出
 * 
 * 利用可能なレンダリングバックエンド（WebGPU/WebGL）を検出します。
 * WebGPUが利用可能な場合は常にWebGPUを優先します。
 */
export class RendererCapability {
  private static _preferredRenderer: RendererType | null = null;
  private static _webgpuAvailable: boolean | null = null;
  private static _webglAvailable: boolean | null = null;

  /**
   * WebGPUが利用可能かどうかを非同期でチェック
   */
  static async checkWebGPUSupport(): Promise<boolean> {
    if (this._webgpuAvailable !== null) {
      return this._webgpuAvailable;
    }

    // Check navigator.gpu
    if (!navigator.gpu) {
      console.log('WebGPU: navigator.gpu is not available');
      this._webgpuAvailable = false;
      return false;
    }

    try {
      // Try to get adapter
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.log('WebGPU: No adapter available');
        this._webgpuAvailable = false;
        return false;
      }

      // Try to get device
      const device = await adapter.requestDevice();
      if (!device) {
        console.log('WebGPU: No device available');
        this._webgpuAvailable = false;
        return false;
      }

      // Clean up
      device.destroy();

      console.log('WebGPU: Available');
      this._webgpuAvailable = true;
      return true;
    } catch (error) {
      console.log('WebGPU: Error checking support:', error);
      this._webgpuAvailable = false;
      return false;
    }
  }

  /**
   * WebGL2が利用可能かどうかをチェック
   */
  static checkWebGLSupport(): boolean {
    if (this._webglAvailable !== null) {
      return this._webglAvailable;
    }

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      
      if (!gl) {
        console.log('WebGL2: Not available');
        this._webglAvailable = false;
        return false;
      }

      console.log('WebGL2: Available');
      this._webglAvailable = true;
      return true;
    } catch (error) {
      console.log('WebGL2: Error checking support:', error);
      this._webglAvailable = false;
      return false;
    }
  }

  /**
   * 推奨されるレンダラータイプを取得
   * WebGPUが利用可能な場合は常にWebGPUを優先
   */
  static async getPreferredRenderer(): Promise<RendererType | null> {
    if (this._preferredRenderer !== null) {
      return this._preferredRenderer;
    }

    // Check WebGPU first (preferred)
    const webgpuAvailable = await this.checkWebGPUSupport();
    if (webgpuAvailable) {
      this._preferredRenderer = 'webgpu';
      console.log('Preferred renderer: WebGPU');
      return 'webgpu';
    }

    // Fall back to WebGL
    const webglAvailable = this.checkWebGLSupport();
    if (webglAvailable) {
      this._preferredRenderer = 'webgl';
      console.log('Preferred renderer: WebGL (fallback)');
      return 'webgl';
    }

    console.error('No supported renderer found');
    return null;
  }

  /**
   * キャッシュをリセット（テスト用）
   */
  static resetCache(): void {
    this._preferredRenderer = null;
    this._webgpuAvailable = null;
    this._webglAvailable = null;
  }

  /**
   * 詳細なサポート情報を取得
   */
  static async getDetailedInfo(): Promise<{
    webgpu: boolean;
    webgl: boolean;
    preferred: RendererType | null;
    userAgent: string;
  }> {
    const webgpu = await this.checkWebGPUSupport();
    const webgl = this.checkWebGLSupport();
    const preferred = await this.getPreferredRenderer();

    return {
      webgpu,
      webgl,
      preferred,
      userAgent: navigator.userAgent,
    };
  }
}
