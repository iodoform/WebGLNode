import { RendererType } from '../types';

/**
 * 抽象レンダラーインターフェース
 * 
 * WebGPUとWebGLの両方のレンダラーが実装する共通インターフェース
 */
export interface IRenderer {
  /**
   * レンダラータイプを取得
   */
  readonly rendererType: RendererType;

  /**
   * レンダラーを初期化
   * @returns 初期化が成功したかどうか
   */
  initialize(): Promise<boolean>;

  /**
   * エラーコールバックを設定
   */
  setErrorCallback(callback: (error: string) => void): void;

  /**
   * シェーダーを更新
   * @param shaderCode シェーダーコード（WebGPUの場合はWGSL、WebGLの場合はJSON形式のGLSL）
   * @returns 更新が成功したかどうか
   */
  updateShader(shaderCode: string): boolean;

  /**
   * レンダリングを開始
   */
  start(): void;

  /**
   * レンダリングを停止
   */
  stop(): void;

  /**
   * キャンバスをリサイズ
   */
  resize(width: number, height: number): void;

  /**
   * 経過時間を取得
   */
  getTime(): number;

  /**
   * 時間をリセット
   */
  resetTime(): void;
}
