import { ICommand } from './ICommand';

/**
 * コマンド履歴管理クラス
 * 
 * undo/redo機能を提供します。
 */
export class CommandHistory {
  private history: ICommand[] = [];
  private currentIndex: number = -1;
  private readonly maxHistorySize: number = 100;

  /**
   * コマンドを実行して履歴に追加
   */
  execute(command: ICommand): void {
    // 現在位置より後ろの履歴を削除（新しい操作が行われた場合）
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // コマンドを実行
    command.execute();

    // 履歴に追加
    this.history.push(command);
    this.currentIndex++;

    // 履歴サイズを制限
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  /**
   * 直前の操作を取り消し
   */
  undo(): boolean {
    if (this.currentIndex < 0) {
      return false;
    }

    const command = this.history[this.currentIndex];
    command.undo();
    this.currentIndex--;

    return true;
  }

  /**
   * 取り消した操作を再実行
   */
  redo(): boolean {
    if (this.currentIndex >= this.history.length - 1) {
      return false;
    }

    this.currentIndex++;
    const command = this.history[this.currentIndex];
    command.execute();

    return true;
  }

  /**
   * 履歴をクリア
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * undo可能かどうか
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * redo可能かどうか
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }
}

