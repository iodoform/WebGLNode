import { Node } from '../../domain/entities/Node';
import { Connection } from '../../domain/entities/Connection';
import { NodeEditorService } from '../services/NodeEditorService';
import { ICommand } from './ICommand';
import { nodeDefinitionLoader } from '../../infrastructure/node-definitions/loader/NodeDefinitionLoader';

/**
 * ノード削除コマンド
 */
export class DeleteNodeCommand implements ICommand {
  private deletedNode: Node | null = null;
  private deletedConnections: Connection[] = [];
  private restoredNodeId: string | null = null;

  constructor(
    private nodeEditorService: NodeEditorService,
    private nodeId: string,
    private onNodeRemoved?: (nodeId: string) => void,
    private onNodeAdded?: (node: Node) => void,
    private onConnectionsUpdated?: (connections: Connection[]) => void
  ) {}

  execute(): void {
    // 削除前にノードと接続の情報を保存
    const nodeToDelete = this.nodeEditorService.getNode(
      this.restoredNodeId || this.nodeId
    );
    
    if (!nodeToDelete) {
      // undoで復元されたノードがない場合、元のノード情報を使用
      if (!this.deletedNode) {
        const node = this.nodeEditorService.getNode(this.nodeId);
        if (!node) return;
        this.deletedNode = node;
      }
    } else {
      // 復元されたノードを削除する場合
      this.deletedNode = nodeToDelete;
    }

    const targetNodeId = this.restoredNodeId || this.nodeId;
    const allConnections = this.nodeEditorService.getAllConnections();
    this.deletedConnections = allConnections.filter(conn =>
      conn.fromNodeId.value === targetNodeId || conn.toNodeId.value === targetNodeId
    );

    // ノードを削除（関連接続も自動的に削除される）
    this.nodeEditorService.deleteNode(targetNodeId);
    this.onNodeRemoved?.(targetNodeId);
    
    const updatedConnections = this.nodeEditorService.getAllConnections();
    this.onConnectionsUpdated?.(updatedConnections);
  }

  undo(): void {
    if (!this.deletedNode) return;

    // ノードを再作成（元の位置と値で）
    const definition = nodeDefinitionLoader.getDefinition(this.deletedNode.definitionId);
    if (!definition) return;

    const restoredNode = this.nodeEditorService.addNode(
      definition,
      this.deletedNode.position.x,
      this.deletedNode.position.y
    );

    // 復元されたノードのIDを保存（redo時に使用）
    this.restoredNodeId = restoredNode.id.value;

    // ノードの値を復元
    const allValues = this.deletedNode.getAllValues();
    for (const [name, value] of Object.entries(allValues)) {
      restoredNode.setValue(name, value);
    }
    this.nodeEditorService.saveNode(restoredNode.id.value);

    // 接続を復元
    for (const conn of this.deletedConnections) {
      try {
        this.nodeEditorService.createConnection(
          conn.fromSocketId.value,
          conn.toSocketId.value
        );
      } catch (error) {
        console.warn('Failed to restore connection:', error);
      }
    }

    this.onNodeAdded?.(restoredNode);
    const updatedConnections = this.nodeEditorService.getAllConnections();
    this.onConnectionsUpdated?.(updatedConnections);
  }
}

