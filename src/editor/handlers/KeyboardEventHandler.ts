import { EditorStateManager } from '../EditorStateManager';
import { CommandExecutor } from '../CommandExecutor';
import { IMenuManager } from '../../infrastructure/rendering/IMenuManager';
import { ConnectionInteractionHandler } from '../interactions/ConnectionInteractionHandler';

/**
 * キーボードイベントを処理するクラス
 * 
 * キーボードイベントのルーティングと基本的な検証を担当します。
 */
export class KeyboardEventHandler {
  constructor(
    private container: HTMLElement,
    private stateManager: EditorStateManager,
    private commandExecutor: CommandExecutor,
    private connectionInteractionHandler: ConnectionInteractionHandler,
    private menuManager: IMenuManager
  ) {}

  /**
   * キーボードイベントリスナーを設定
   */
  setupListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const selectedConnectionId = this.stateManager.getSelectedConnectionId();
      if (selectedConnectionId) {
        this.connectionInteractionHandler.delete(selectedConnectionId);
        this.stateManager.setSelectedConnectionId(null);
      } else {
        this.commandExecutor.deleteSelectedNodes();
      }
    } else if (e.key === 'a' && e.shiftKey) {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      this.menuManager.showAddNodeMenu(rect.width / 2, rect.height / 2);
    } else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      this.commandExecutor.undo();
    } else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      this.commandExecutor.redo();
    } else if ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.commandExecutor.redo();
    }
  }
}

