import { NodeEditorService } from '../services/NodeEditorService';
import { ICommand } from './ICommand';

/**
 * ノード移動コマンド
 */
export class MoveNodeCommand implements ICommand {
  constructor(
    private nodeEditorService: NodeEditorService,
    private nodeId: string,
    private oldX: number,
    private oldY: number,
    private newX: number,
    private newY: number,
    private onNodeMoved?: (nodeId: string) => void
  ) {}

  execute(): void {
    this.nodeEditorService.moveNodeAndGetUpdated(this.nodeId, this.newX, this.newY);
    this.nodeEditorService.saveNode(this.nodeId);
    this.onNodeMoved?.(this.nodeId);
  }

  undo(): void {
    this.nodeEditorService.moveNodeAndGetUpdated(this.nodeId, this.oldX, this.oldY);
    this.nodeEditorService.saveNode(this.nodeId);
    this.onNodeMoved?.(this.nodeId);
  }
}

