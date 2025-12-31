import { CommandDependencies } from './CommandDependencies';

/**
 * コマンド用DIコンテナ
 */
export class CommandDIContainer {
  private dependencies: CommandDependencies | null = null;

  /**
   * 依存関係を登録
   */
  register(dependencies: CommandDependencies): void {
    this.dependencies = dependencies;
  }

  /**
   * 依存関係を取得
   */
  get(): CommandDependencies {
    if (!this.dependencies) {
      throw new Error('CommandDependencies not registered. Call register() first.');
    }
    return this.dependencies;
  }

  /**
   * 依存関係が登録されているか確認
   */
  isRegistered(): boolean {
    return this.dependencies !== null;
  }
}

// シングルトンインスタンス
export const commandDIContainer = new CommandDIContainer();

