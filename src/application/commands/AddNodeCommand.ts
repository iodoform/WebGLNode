import { Node } from '../../domain/entities/Node';
import { ICommand } from './ICommand';
import type { NodeDefinition } from '../../infrastructure/types';
import { commandDIContainer } from '../../infrastructure/di/CommandDIContainer';

/**
 * ノード追加コマンド
 */
export class AddNodeCommand implements ICommand {
  public addedNode: Node | null = null;

  constructor(
    private definition: NodeDefinition,
    private x: number,
    private y: number
  ) {}

  execute(): void {
    const deps = commandDIContainer.get();
    this.addedNode = deps.nodeEditorService.addNode(this.definition, this.x, this.y);
    
    // DOM更新
    deps.syncNodeCacheToState();
    deps.nodeRenderer.renderNode(this.addedNode);
    deps.triggerShaderUpdate();
  }

  undo(): void {
    if (!this.addedNode) return;
    
    const deps = commandDIContainer.get();
    deps.nodeEditorService.deleteNode(this.addedNode.id.value);
    
    // DOM更新
    deps.syncNodeCacheToState();
    const nodeEl = deps.nodeContainer.querySelector(`[data-node-id="${this.addedNode.id.value}"]`);
    if (nodeEl) nodeEl.remove();
    const connections = deps.nodeEditorService.getAllConnections();
    deps.connectionRenderer.updateConnections(connections);
    deps.triggerShaderUpdate();
    
    this.addedNode = null;
  }
}

