import { ICommand } from './ICommand';
import { commandDIContainer } from '../../infrastructure/di/CommandDIContainer';

/**
 * ノード値更新コマンド
 */
export class UpdateNodeValueCommand implements ICommand {
  constructor(
    private nodeId: string,
    private name: string,
    private oldValue: number | number[] | undefined,
    private newValue: number | number[]
  ) {}

  execute(): void {
    const deps = commandDIContainer.get();
    deps.nodeEditorService.updateNodeValue(this.nodeId, this.name, this.newValue);
    
    // DOM更新
    const updatedNode = deps.nodeEditorService.getNode(this.nodeId);
    if (updatedNode) {
      deps.nodeRenderer.updateNodeInputFields(updatedNode);
    }
    deps.triggerShaderUpdate();
  }

  undo(): void {
    if (this.oldValue === undefined) return;
    
    const deps = commandDIContainer.get();
    deps.nodeEditorService.updateNodeValue(this.nodeId, this.name, this.oldValue);
    
    // DOM更新
    const updatedNode = deps.nodeEditorService.getNode(this.nodeId);
    if (updatedNode) {
      deps.nodeRenderer.updateNodeInputFields(updatedNode);
    }
    deps.triggerShaderUpdate();
  }
}

