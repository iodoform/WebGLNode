import { NodeEditorService } from '../../application/services/NodeEditorService';
import { NodeRenderer } from '../rendering/NodeRenderer';
import { ConnectionRenderer } from '../rendering/ConnectionRenderer';

/**
 * コマンド実行に必要な依存関係
 */
export interface CommandDependencies {
  nodeEditorService: NodeEditorService;
  nodeRenderer: NodeRenderer;
  connectionRenderer: ConnectionRenderer;
  /**
   * ソケットが接続されているかどうかを判定する関数
   */
  isSocketConnected: (socketId: string) => boolean;
  /**
   * シェーダー更新をトリガーする関数
   */
  triggerShaderUpdate: () => void;
  /**
   * ノードキャッシュを状態に同期する関数
   */
  syncNodeCacheToState: () => void;
  /**
   * ノードコンテナのDOM要素
   */
  nodeContainer: HTMLElement;
}

