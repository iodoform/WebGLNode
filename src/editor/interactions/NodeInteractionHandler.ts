import { NodeEditorService } from '../../application/services/NodeEditorService';
import { EditorStateManager } from '../EditorStateManager';
import { CommandExecutor } from '../CommandExecutor';
import { CoordinateCalculator } from '../utils/CoordinateCalculator';
import { Node } from '../../domain/entities/Node';

/**
 * ノード操作を担当するクラス
 * 
 * ノードのクリック、ドラッグ、移動などの操作ロジックを担当します。
 */
export class NodeInteractionHandler {
  constructor(
    private nodeEditorService: NodeEditorService,
    private stateManager: EditorStateManager,
    private commandExecutor: CommandExecutor,
    private updateNodePosition: (node: Node) => void,
    private updateConnections: (connections: any[]) => void
  ) {}

  /**
   * ノードドラッグを開始
   */
  startDrag(node: Node, clientX: number, clientY: number): void {
    const latestNode = this.nodeEditorService.getNode(node.id.value) || node;
    
    this.stateManager.setNodeDragStartPosition({
      nodeId: latestNode.id.value,
      x: latestNode.position.x,
      y: latestNode.position.y,
    });
    
    this.stateManager.setDragState({
      isDragging: true,
      startX: clientX,
      startY: clientY,
      nodeId: latestNode.id.value,
      offsetX: latestNode.position.x,
      offsetY: latestNode.position.y,
    });
  }

  /**
   * ノードドラッグを更新
   */
  updateDrag(clientX: number, clientY: number): void {
    const dragState = this.stateManager.getDragState();
    if (!dragState.isDragging || !dragState.nodeId) return;

    const state = this.stateManager.getState();
    const node = state.nodes.get(dragState.nodeId);
    if (!node) return;

    const newPos = CoordinateCalculator.calculateDragPosition(
      dragState.startX,
      dragState.startY,
      clientX,
      clientY,
      dragState.offsetX,
      dragState.offsetY,
      state.zoom
    );

    this.moveNode(node.id, newPos.x, newPos.y);
  }

  /**
   * ノードドラッグを終了
   */
  endDrag(): void {
    const dragState = this.stateManager.getDragState();
    if (!dragState.nodeId) return;

    const nodeDragStartPosition = this.stateManager.getNodeDragStartPosition();
    if (nodeDragStartPosition) {
      const node = this.nodeEditorService.getNode(dragState.nodeId);
      if (node) {
        const newX = node.position.x;
        const newY = node.position.y;
        if (nodeDragStartPosition.x !== newX || nodeDragStartPosition.y !== newY) {
          this.commandExecutor.moveNode(
            dragState.nodeId,
            nodeDragStartPosition.x,
            nodeDragStartPosition.y,
            newX,
            newY
          );
        }
      }
      this.stateManager.setNodeDragStartPosition(null);
    } else {
      try {
        this.nodeEditorService.saveNode(dragState.nodeId);
      } catch (error) {
        console.warn('Failed to save node after drag:', error);
      }
    }
  }

  /**
   * ノードをクリック
   */
  click(node: Node, shiftKey: boolean): void {
    if (!shiftKey) {
      this.stateManager.clearSelectedNodes();
    }
    this.stateManager.addSelectedNode(node.id.value);
  }

  /**
   * ノードを移動（内部実装）
   */
  private moveNode(nodeId: string, newX: number, newY: number): void {
    try {
      this.nodeEditorService.moveNodeAndGetUpdated(nodeId, newX, newY);
      
      const editorState = this.stateManager.getState();
      const node = editorState.nodes.get(nodeId);
      if (node) {
        node.x = newX;
        node.y = newY;
      }

      const domainNode = this.nodeEditorService.getNode(nodeId);
      if (domainNode) {
        this.updateNodePosition(domainNode);
      }
      const connections = this.nodeEditorService.getAllConnections();
      this.updateConnections(connections);
    } catch (error) {
      console.warn('Failed to move node:', error);
    }
  }
}

