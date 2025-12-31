import { ICommand } from './ICommand';
import { commandDIContainer } from '../../infrastructure/di/CommandDIContainer';

/**
 * ノード移動コマンド
 */
export class MoveNodeCommand implements ICommand {
  constructor(
    private nodeId: string,
    private oldX: number,
    private oldY: number,
    private newX: number,
    private newY: number
  ) {}

  execute(): void {
    const deps = commandDIContainer.get();
    deps.nodeEditorService.moveNodeAndGetUpdated(this.nodeId, this.newX, this.newY);
    deps.nodeEditorService.saveNode(this.nodeId);
    
    // DOM更新
    const updatedNode = deps.nodeEditorService.getNode(this.nodeId);
    if (updatedNode) {
      deps.nodeRenderer.updateNodePosition(updatedNode);
      const connections = deps.nodeEditorService.getAllConnections();
      deps.connectionRenderer.updateConnections(connections);
    }
  }

  undo(): void {
    const deps = commandDIContainer.get();
    deps.nodeEditorService.moveNodeAndGetUpdated(this.nodeId, this.oldX, this.oldY);
    deps.nodeEditorService.saveNode(this.nodeId);
    
    // DOM更新
    const updatedNode = deps.nodeEditorService.getNode(this.nodeId);
    if (updatedNode) {
      deps.nodeRenderer.updateNodePosition(updatedNode);
      const connections = deps.nodeEditorService.getAllConnections();
      deps.connectionRenderer.updateConnections(connections);
    }
  }
}

