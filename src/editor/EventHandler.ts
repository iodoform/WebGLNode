import { NodeEditorService } from '../application/services/NodeEditorService';
import { EditorStateManager } from './EditorStateManager';
import { CommandExecutor } from './CommandExecutor';
import { EditorEventBus } from './EditorEventBus';
import { INodeRenderer } from '../infrastructure/rendering/INodeRenderer';
import { IConnectionRenderer } from '../infrastructure/rendering/IConnectionRenderer';
import { IMenuManager } from '../infrastructure/rendering/IMenuManager';
import { InteractionController } from './interactions/InteractionController';
import { NodeInteractionHandler } from './interactions/NodeInteractionHandler';
import { ConnectionInteractionHandler } from './interactions/ConnectionInteractionHandler';
import { MouseEventHandler } from './handlers/MouseEventHandler';
import { TouchEventHandler } from './handlers/TouchEventHandler';
import { KeyboardEventHandler } from './handlers/KeyboardEventHandler';
import { DOMUtils } from './utils/DOMUtils';
import { Node } from '../domain/entities/Node';
import { Socket } from '../domain/entities/Socket';

/**
 * イベント処理を統合するFacadeクラス
 * 
 * 各種イベントハンドラーとインタラクションコントローラーを統合し、
 * 外部へのインターフェースを提供します。
 */
export class EventHandler {
  private interactionController: InteractionController;
  private nodeInteractionHandler: NodeInteractionHandler;
  private connectionInteractionHandler: ConnectionInteractionHandler;
  private mouseEventHandler: MouseEventHandler;
  private touchEventHandler: TouchEventHandler;
  private keyboardEventHandler: KeyboardEventHandler;

  constructor(
    private container: HTMLElement,
    private svgContainer: SVGSVGElement,
    private nodeEditorService: NodeEditorService,
    private stateManager: EditorStateManager,
    private nodeRenderer: INodeRenderer,
    private connectionRenderer: IConnectionRenderer,
    private menuManager: IMenuManager,
    private commandExecutor: CommandExecutor,
    private eventBus: EditorEventBus,
    private updateTransform: () => void
  ) {
    // コールバック関数を作成
    const updateNodePosition = (node: Node) => 
      this.nodeRenderer.updateNodePosition(node);
    const updateConnections = (connections: any[]) => 
      this.connectionRenderer.updateConnections(connections);
    const updateConnectionPreview = (socketId: string, x: number, y: number) =>
      this.connectionRenderer.updateConnectionPreview(socketId, x, y);
    const removeConnectionPreview = () =>
      this.connectionRenderer.removeConnectionPreview();
    const getSocketAtPosition = (x: number, y: number) =>
      DOMUtils.getSocketAtPosition(x, y, this.nodeEditorService);

    // インタラクションコントローラーとハンドラーを初期化
    this.interactionController = new InteractionController(
      this.container,
      this.stateManager,
      updateTransform
    );

    this.nodeInteractionHandler = new NodeInteractionHandler(
      this.nodeEditorService,
      this.stateManager,
      this.commandExecutor,
      updateNodePosition,
      updateConnections
    );

    this.connectionInteractionHandler = new ConnectionInteractionHandler(
      this.container,
      this.svgContainer,
      this.nodeEditorService,
      this.stateManager,
      this.commandExecutor,
      updateConnectionPreview,
      removeConnectionPreview,
      getSocketAtPosition
    );

    // イベントハンドラーを初期化
    this.mouseEventHandler = new MouseEventHandler(
      this.container,
      this.nodeEditorService,
      this.stateManager,
      this.eventBus,
      this.interactionController,
      this.nodeInteractionHandler,
      this.connectionInteractionHandler,
      menuManager
    );

    this.touchEventHandler = new TouchEventHandler(
      this.container,
      this.nodeEditorService,
      this.stateManager,
      this.eventBus,
      this.interactionController,
      this.nodeInteractionHandler,
      this.connectionInteractionHandler,
      menuManager,
      getSocketAtPosition
    );

    this.keyboardEventHandler = new KeyboardEventHandler(
      this.container,
      this.stateManager,
      this.commandExecutor,
      this.connectionInteractionHandler,
      menuManager
    );
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners(): void {
    this.mouseEventHandler.setupListeners();
    this.touchEventHandler.setupListeners();
    this.keyboardEventHandler.setupListeners();

    // メニュー関連のイベントリスナー
    document.addEventListener('click', (e) => {
      if (this.menuManager.containsElement(e.target as HTMLElement)) {
        return;
      }
      this.menuManager.closeAddNodeMenu();
    });

    document.addEventListener('touchstart', (e) => {
      if (this.menuManager.containsElement(e.target as HTMLElement)) {
        return;
      }
      this.menuManager.closeAddNodeMenu();
    }, { passive: true });
  }

  /**
   * マウス移動ハンドラーを取得（NodeRenderer用）
   */
  getBoundMouseMoveHandler(): (e: MouseEvent) => void {
    return this.mouseEventHandler.getBoundMouseMoveHandler();
  }

  /**
   * マウスアップハンドラーを取得（NodeRenderer用）
   */
  getBoundMouseUpHandler(): (e: MouseEvent) => void {
    return this.mouseEventHandler.getBoundMouseUpHandler();
  }

  /**
   * ソケットクリック処理（NodeRendererから呼ばれる）
   */
  handleSocketClick(socket: Socket, e: MouseEvent): void {
    this.mouseEventHandler.handleSocketClick(socket, e);
  }

  /**
   * ノードドラッグ開始処理（NodeRendererから呼ばれる）
   */
  handleNodeDragStart(e: MouseEvent, node: Node): void {
    this.mouseEventHandler.handleNodeDragStart(e, node);
  }

  /**
   * ノードクリック処理（NodeRendererから呼ばれる）
   */
  handleNodeClick(node: Node, e: MouseEvent): void {
    this.mouseEventHandler.handleNodeClick(node, e);
  }

  /**
   * 接続を削除（外部から呼び出し可能）
   */
  deleteConnection(connectionId: string): void {
    this.connectionInteractionHandler.delete(connectionId);
  }
}
