import { Node } from '../../domain/entities/Node';
import { NodeEditorService } from '../services/NodeEditorService';
import { ICommand } from './ICommand';
import type { NodeDefinition } from '../../infrastructure/types';

/**
 * ノード追加コマンド
 */
export class AddNodeCommand implements ICommand {
  public addedNode: Node | null = null;

  constructor(
    private nodeEditorService: NodeEditorService,
    private definition: NodeDefinition,
    private x: number,
    private y: number,
    private onNodeAdded?: (node: Node) => void,
    private onNodeRemoved?: (nodeId: string) => void
  ) {}

  execute(): void {
    this.addedNode = this.nodeEditorService.addNode(this.definition, this.x, this.y);
    this.onNodeAdded?.(this.addedNode);
  }

  undo(): void {
    if (this.addedNode) {
      this.nodeEditorService.deleteNode(this.addedNode.id.value);
      this.onNodeRemoved?.(this.addedNode.id.value);
      this.addedNode = null;
    }
  }
}

