import { Node } from '../../domain/entities/Node';
import { Connection } from '../../domain/entities/Connection';
import { RendererType } from '../types';

/**
 * 抽象シェーダージェネレーターインターフェース
 * 
 * WebGPU (WGSL) と WebGL (GLSL) の両方のシェーダー生成をサポート
 */
export interface IShaderGenerator {
  /**
   * レンダラータイプを取得
   */
  readonly rendererType: RendererType;

  /**
   * ノードグラフからシェーダーコードを生成
   */
  generate(nodes: Node[], connections: Connection[]): string;

  /**
   * デフォルトシェーダーを生成
   */
  generateDefault(): string;
}
