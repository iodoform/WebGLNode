import { NodeEditorService } from '../services/NodeEditorService';
import { ICommand } from './ICommand';

/**
 * ノード値更新コマンド
 */
export class UpdateNodeValueCommand implements ICommand {
  constructor(
    private nodeEditorService: NodeEditorService,
    private nodeId: string,
    private name: string,
    private oldValue: number | number[] | undefined,
    private newValue: number | number[],
    private onValueUpdated?: (nodeId: string) => void
  ) {}

  execute(): void {
    this.nodeEditorService.updateNodeValue(this.nodeId, this.name, this.newValue);
    this.onValueUpdated?.(this.nodeId);
  }

  undo(): void {
    if (this.oldValue !== undefined) {
      this.nodeEditorService.updateNodeValue(this.nodeId, this.name, this.oldValue);
      this.onValueUpdated?.(this.nodeId);
    }
  }
}

