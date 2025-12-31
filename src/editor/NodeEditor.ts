import type { EditorState } from './types';
import { Node } from '../domain/entities/Node';
import { IShaderGenerator } from '../infrastructure/shader/IShaderGenerator';
import { WGSLGenerator } from '../infrastructure/shader/WGSLGenerator';
import { NodeEditorService } from '../application/services/NodeEditorService';
import { InMemoryNodeRepository } from '../infrastructure/repositories/InMemoryNodeRepository';
import { InMemoryConnectionRepository } from '../infrastructure/repositories/InMemoryConnectionRepository';
import { NodeGraph } from '../domain/entities/NodeGraph';
import { nodeDefinitionLoader } from '../infrastructure/node-definitions/loader/NodeDefinitionLoader';
import { commandDIContainer } from '../infrastructure/di/CommandDIContainer';
import { EditorStateManager } from './EditorStateManager';
import { CommandExecutor } from './CommandExecutor';
import { EventHandler } from './EventHandler';
import { EditorEventBus, EditorEventType } from './EditorEventBus';
import { NodeRenderer } from '../infrastructure/rendering/NodeRenderer';
import { ConnectionRenderer } from '../infrastructure/rendering/ConnectionRenderer';
import { InputFieldRenderer } from '../infrastructure/rendering/InputFieldRenderer';
import { MenuManager } from '../infrastructure/rendering/MenuManager';
import { INodeRenderer } from '../infrastructure/rendering/INodeRenderer';
import { IConnectionRenderer } from '../infrastructure/rendering/IConnectionRenderer';

/**
 * ノードエディターのメインクラス（Facade）
 * 
 * 各責務を持つクラス（EditorStateManager、EventHandler、CommandExecutor）を
 * 統合し、外部へのインターフェースを提供します。
 */
export class NodeEditor {
  private container: HTMLElement;
  private nodeContainer: HTMLElement;
  private svgContainer: SVGSVGElement;
  
  private onShaderUpdate?: (code: string) => void;

  // DDD Services
  private nodeGraph: NodeGraph;
  private nodeRepository: InMemoryNodeRepository;
  private connectionRepository: InMemoryConnectionRepository;
  private nodeEditorService: NodeEditorService;
  
  // Shader generator
  private shaderGenerator: IShaderGenerator;

  // 責務分割されたクラス
  private stateManager: EditorStateManager;
  private commandExecutor: CommandExecutor;
  private eventHandler: EventHandler;
  private eventBus: EditorEventBus;

  // レンダリング関連
  private inputFieldRenderer: InputFieldRenderer;
  private nodeRenderer: NodeRenderer;
  private connectionRenderer: ConnectionRenderer;
  private menuManager: MenuManager;

  constructor(containerId: string, shaderGenerator?: IShaderGenerator) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;

    // Initialize shader generator
    this.shaderGenerator = shaderGenerator || new WGSLGenerator();

    // Initialize DDD repositories and services
    this.nodeGraph = new NodeGraph();
    this.nodeRepository = new InMemoryNodeRepository();
    this.connectionRepository = new InMemoryConnectionRepository();
    this.nodeEditorService = new NodeEditorService(
      this.nodeGraph,
      this.nodeRepository,
      this.connectionRepository
    );

    // Create DOM elements
    this.nodeContainer = document.createElement('div');
    this.nodeContainer.className = 'node-container';
    this.container.appendChild(this.nodeContainer);

    this.svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgContainer.id = 'connections-svg';
    this.container.insertBefore(this.svgContainer, this.nodeContainer);

    // Initialize event bus
    this.eventBus = new EditorEventBus();

    // Initialize state manager
    this.stateManager = new EditorStateManager();

    // Initialize command executor (temporary renderers)
    const tempNodeRendererForCommand = {} as NodeRenderer;
    const tempConnectionRendererForCommand = {} as ConnectionRenderer;
    this.commandExecutor = new CommandExecutor(
      this.nodeEditorService,
      this.stateManager,
      tempNodeRendererForCommand,
      tempConnectionRendererForCommand,
      this.nodeContainer,
      this.eventBus
    );

    // Initialize renderers
    this.inputFieldRenderer = new InputFieldRenderer(
      (socketId) => this.nodeEditorService.isSocketConnected(socketId),
      () => this.eventBus.emit(EditorEventType.SHADER_UPDATE_NEEDED, {}),
      (nodeId, name, value) => {
        const node = this.nodeEditorService.getNode(nodeId);
        const oldValue = node?.getValue(name);
        this.commandExecutor.updateNodeValue(nodeId, name, oldValue, value);
      }
    );

    this.menuManager = new MenuManager(
      this.container,
      (definitionId, x, y) => this.addNode(definitionId, x, y),
      () => this.stateManager.getState().pan,
      () => this.stateManager.getState().zoom
    );

    // Initialize event handler with temporary renderers (will be replaced)
    const tempNodeRendererForHandler = {} as INodeRenderer;
    const tempConnectionRendererForHandler = {} as IConnectionRenderer;
    this.eventHandler = new EventHandler(
      this.container,
      this.svgContainer,
      this.nodeEditorService,
      this.stateManager,
      tempNodeRendererForHandler,
      tempConnectionRendererForHandler,
      this.menuManager,
      this.commandExecutor,
      this.eventBus,
      () => this.updateTransform()
    );

    // Create renderers with event handler callbacks
    this.nodeRenderer = new NodeRenderer(
      this.nodeContainer,
      this.inputFieldRenderer,
      (socketId) => this.nodeEditorService.isSocketConnected(socketId),
      (socket, e) => this.eventHandler.handleSocketClick(socket, e),
      (node, e) => this.eventHandler.handleNodeDragStart(e, node),
      (node, e) => this.eventHandler.handleNodeClick(node, e)
    );

    this.connectionRenderer = new ConnectionRenderer(
      this.svgContainer,
      this.nodeContainer,
      (nodeId: string) => this.nodeEditorService.getNode(nodeId),
      () => this.nodeEditorService.getAllNodes(),
      () => this.stateManager.getState().zoom,
      (connectionId) => this.eventBus.emit(EditorEventType.CONNECTION_SELECTED, { connectionId }),
      (connectionId) => this.eventHandler.deleteConnection(connectionId)
    );

    // Update event handler with actual renderers
    (this.eventHandler as any).nodeRenderer = this.nodeRenderer;
    (this.eventHandler as any).connectionRenderer = this.connectionRenderer;

    // Update command executor with actual renderers
    this.commandExecutor.setRenderers(
      this.nodeRenderer,
      this.connectionRenderer
    );

    // Setup event subscriptions
    this.setupEventSubscriptions();

    // Register command dependencies in DI container
    commandDIContainer.register({
      nodeEditorService: this.nodeEditorService,
      nodeRenderer: this.nodeRenderer,
      connectionRenderer: this.connectionRenderer,
      isSocketConnected: (socketId: string) => this.nodeEditorService.isSocketConnected(socketId),
      triggerShaderUpdate: () => this.eventBus.emit(EditorEventType.SHADER_UPDATE_NEEDED, {}),
      syncNodeCacheToState: () => this.syncNodeCacheToState(),
      nodeContainer: this.nodeContainer,
    });

    // Setup event listeners
    this.eventHandler.setupEventListeners();

    // Setup node drag handlers
    this.setupNodeDragHandlers();

    // Create default nodes
    this.createDefaultNodes();
  }

  setShaderUpdateCallback(callback: (code: string) => void): void {
    this.onShaderUpdate = callback;
  }

  private setupEventSubscriptions(): void {
    // シェーダー更新イベントを購読
    this.eventBus.subscribe(EditorEventType.SHADER_UPDATE_NEEDED, () => {
      this.triggerShaderUpdate();
    });

    // ノード選択イベントを購読
    this.eventBus.subscribe(EditorEventType.NODE_SELECTED, (data) => {
      this.nodeRenderer.updateSelectionDisplay(data.nodeIds);
    });

    // 接続選択イベントを購読
    this.eventBus.subscribe(EditorEventType.CONNECTION_SELECTED, (data) => {
      this.connectionRenderer.updateConnectionSelection(data.connectionId);
    });

    // 接続選択イベントを購読（StateManagerの状態も更新）
    this.eventBus.subscribe(EditorEventType.CONNECTION_SELECTED, (data) => {
      this.stateManager.setSelectedConnectionId(data.connectionId);
    });
  }

  private setupNodeDragHandlers(): void {
    // NodeRendererから呼ばれるドラッグ開始時にdocumentにイベントリスナーを追加するため、
    // EventHandlerのhandleNodeDragStartをラップ
    const originalHandleNodeDragStart = this.eventHandler.handleNodeDragStart.bind(this.eventHandler);
    this.eventHandler.handleNodeDragStart = (e: MouseEvent, node: Node) => {
      originalHandleNodeDragStart(e, node);
      document.addEventListener('mousemove', this.eventHandler.getBoundMouseMoveHandler());
      document.addEventListener('mouseup', this.eventHandler.getBoundMouseUpHandler());
    };
  }

  addNode(definitionId: string, x: number, y: number): Node | null {
    const definition = nodeDefinitionLoader.getDefinition(definitionId);
    if (!definition) return null;

    return this.commandExecutor.addNode(definition, x, y);
  }
  
  private syncNodeCacheToState(): void {
    const allNodes = this.nodeEditorService.getAllNodes();
    this.stateManager.syncNodeCache(
      allNodes.map(n => ({
        id: n.id.value,
        definitionId: n.definitionId,
        x: n.position.x,
        y: n.position.y,
      }))
    );
  }

  private triggerShaderUpdate(): void {
    const domainNodes = this.nodeEditorService.getAllNodes();
    const domainConnections = this.nodeEditorService.getAllConnections();
    const code = this.shaderGenerator.generate(domainNodes, domainConnections);
    this.onShaderUpdate?.(code);
  }

  /**
   * トランスフォームを更新
   */
  private updateTransform(): void {
    const state = this.stateManager.getState();
    this.nodeContainer.style.transform = 
      `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
    this.svgContainer.style.transform = 
      `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
    const connections = this.nodeEditorService.getAllConnections();
    this.connectionRenderer.updateConnections(connections);
  }

  private createDefaultNodes(): void {
    this.addNode('input_uv', 50, 100);
    this.addNode('input_time', 50, 250);
    this.addNode('output_color', 500, 150);
  }

  getState(): EditorState {
    return this.stateManager.getState();
  }

  generateShader(): string {
    const domainNodes = this.nodeEditorService.getAllNodes();
    const domainConnections = this.nodeEditorService.getAllConnections();
    return this.shaderGenerator.generate(domainNodes, domainConnections);
  }

  setShaderGenerator(generator: IShaderGenerator): void {
    this.shaderGenerator = generator;
    this.triggerShaderUpdate();
  }
}
