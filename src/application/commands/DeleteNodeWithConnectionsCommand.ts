import { ICommand } from './ICommand';
import { DeleteNodeCommand } from './DeleteNodeCommand';
import { DeleteConnectionCommand } from './DeleteConnectionCommand';
import { commandDIContainer } from '../../infrastructure/di/CommandDIContainer';

/**
 * 接続の削除作業を含むノード削除コマンド
 * 
 * ノード削除とそのノードに関連する接続の削除を統合的に管理します。
 * 内部的に「ノード削除コマンド」および「接続削除コマンド」を実行します。
 */
export class DeleteNodeWithConnectionsCommand implements ICommand {
  private nodeDeleteCommand: DeleteNodeCommand;
  private connectionDeleteCommands: DeleteConnectionCommand[] = [];

  constructor(
    private nodeId: string
  ) {
    this.nodeDeleteCommand = new DeleteNodeCommand(nodeId);
  }

  execute(): void {
    const deps = commandDIContainer.get();
    
    // 削除対象のノードに関連する接続を取得
    const allConnections = deps.nodeEditorService.getAllConnections();
    const relatedConnections = allConnections.filter(conn =>
      conn.fromNodeId.value === this.nodeId || conn.toNodeId.value === this.nodeId
    );
    
    // 各接続に対して接続削除コマンドを作成
    this.connectionDeleteCommands = relatedConnections.map(conn =>
      new DeleteConnectionCommand(conn.id.value)
    );
    
    // 接続を削除（先に接続を削除してからノードを削除）
    for (const cmd of this.connectionDeleteCommands) {
      cmd.execute();
    }
    
    // ノードを削除
    this.nodeDeleteCommand.execute();
  }

  undo(): void {
    // ノードを復元（先にノードを復元してから接続を復元）
    this.nodeDeleteCommand.undo();
    
    // 接続を復元（逆順で復元）
    for (let i = this.connectionDeleteCommands.length - 1; i >= 0; i--) {
      this.connectionDeleteCommands[i].undo();
    }
  }
}

