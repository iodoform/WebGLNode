import type { EditorState, DragState, ConnectionDragState } from './types';
import { Node } from '../domain/entities/Node';
import { Socket } from '../domain/entities/Socket';
import { IShaderGenerator } from '../infrastructure/shader/IShaderGenerator';
import { WGSLGenerator } from '../infrastructure/shader/WGSLGenerator';
import { InputFieldRenderer } from '../infrastructure/rendering/InputFieldRenderer';
import { NodeRenderer } from '../infrastructure/rendering/NodeRenderer';
import { ConnectionRenderer } from '../infrastructure/rendering/ConnectionRenderer';
import { MenuManager } from '../infrastructure/rendering/MenuManager';
import { NodeEditorService } from '../application/services/NodeEditorService';
import { InMemoryNodeRepository } from '../infrastructure/repositories/InMemoryNodeRepository';
import { InMemoryConnectionRepository } from '../infrastructure/repositories/InMemoryConnectionRepository';
import { Position } from '../domain/value-objects/Position';
import { NodeId } from '../domain/value-objects/Id';
import { ConnectionId } from '../domain/value-objects/Id';
import { nodeDefinitionLoader } from '../nodes/NodeDefinitionLoader';

/**
 * タッチ操作の状態を管理するインターフェース
 */
interface TouchState {
  // ピンチズーム用
  initialDistance: number;
  initialZoom: number;
  // 長押し検出用
  longPressTimer: number | null;
  longPressX: number;
  longPressY: number;
  // マルチタッチ判定
  isTwoFingerTouch: boolean;
  // ピンチ中心点
  pinchCenterX: number;
  pinchCenterY: number;
}

/**
 * ノードエディターのメインクラス
 * 
 * ノードエディター全体の状態管理と、各レンダラー（NodeRenderer、ConnectionRenderer、InputFieldRenderer、
 * MenuManager）の調整を行います。マウスやキーボードのイベント処理、ノードや接続の追加・削除、
 * パン・ズーム操作などを統合的に管理します。
 */
export class NodeEditor {
  private container: HTMLElement;
  private nodeContainer: HTMLElement;
  private svgContainer: SVGSVGElement;
  
  private state: EditorState;
  private dragState: DragState;
  private connectionDrag: ConnectionDragState;
  private selectedConnectionId: string | null = null;
  
  private onShaderUpdate?: (code: string) => void;

  // タッチ操作の状態
  private touchState: TouchState = {
    initialDistance: 0,
    initialZoom: 1,
    longPressTimer: null,
    longPressX: 0,
    longPressY: 0,
    isTwoFingerTouch: false,
    pinchCenterX: 0,
    pinchCenterY: 0,
  };

  // 長押し判定時間（ミリ秒）
  private readonly LONG_PRESS_DURATION = 500;

  // DDD Services
  private nodeRepository: InMemoryNodeRepository;
  private connectionRepository: InMemoryConnectionRepository;
  private nodeEditorService: NodeEditorService;
  
  // Cache for rendering (maps node IDs to domain entities)
  private nodeCache: Map<string, Node> = new Map();

  // Renderers
  private inputFieldRenderer: InputFieldRenderer;
  private nodeRenderer: NodeRenderer;
  private connectionRenderer: ConnectionRenderer;
  private menuManager: MenuManager;

  // Shader generator (injectable for WebGPU/WebGL support)
  private shaderGenerator: IShaderGenerator;

  constructor(containerId: string, shaderGenerator?: IShaderGenerator) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;

    // Initialize shader generator (use provided or default to WGSL)
    this.shaderGenerator = shaderGenerator || new WGSLGenerator();

    // Initialize DDD repositories and services
    this.nodeRepository = new InMemoryNodeRepository();
    this.connectionRepository = new InMemoryConnectionRepository();
    this.nodeEditorService = new NodeEditorService(
      this.nodeRepository,
      this.connectionRepository
    );

    this.state = {
      nodes: new Map(),
      selectedNodes: new Set(),
      pan: { x: 0, y: 0 },
      zoom: 1,
    };

    this.dragState = {
      isDragging: false,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
    };

    this.connectionDrag = {
      isConnecting: false,
      currentX: 0,
      currentY: 0,
    };

    this.nodeContainer = document.createElement('div');
    this.nodeContainer.className = 'node-container';
    this.container.appendChild(this.nodeContainer);

    this.svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgContainer.id = 'connections-svg';
    this.container.insertBefore(this.svgContainer, this.nodeContainer);

    // Initialize renderers
    this.inputFieldRenderer = new InputFieldRenderer(
      (socketId) => this.isSocketConnected(socketId),
      () => this.triggerShaderUpdate(),
      (nodeId, name, value) => {
        const nodeIdObj = new NodeId(nodeId);
        this.nodeEditorService.updateNodeValue(nodeIdObj, name, value);
      }
    );

    this.nodeRenderer = new NodeRenderer(
      this.nodeContainer,
      this.inputFieldRenderer,
      (socketId) => this.isSocketConnected(socketId),
      (socket, e) => this.handleSocketClick(socket, e),
      (node, e) => this.handleNodeDragStart(e, node),
      (node, e) => this.handleNodeClick(node, e)
    );

    this.connectionRenderer = new ConnectionRenderer(
      this.svgContainer,
      this.nodeContainer,
      this.nodeCache,
      () => this.state.zoom,
      (connectionId) => this.handleConnectionClick(connectionId),
      (connectionId) => this.deleteConnection(connectionId)
    );

    this.menuManager = new MenuManager(
      this.container,
      (definitionId, x, y) => this.addNode(definitionId, x, y),
      () => this.state.pan,
      () => this.state.zoom
    );

    this.setupEventListeners();
    this.createDefaultNodes();
  }

  setShaderUpdateCallback(callback: (code: string) => void): void {
    this.onShaderUpdate = callback;
  }

  private setupEventListeners(): void {
    // Pan handling (mouse)
    this.container.addEventListener('mousedown', this.handlePanStart.bind(this));
    this.container.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.container.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.container.addEventListener('wheel', this.handleZoom.bind(this));

    // Touch handling
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.container.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });

    // Context menu for adding nodes
    this.container.addEventListener('contextmenu', this.handleContextMenu.bind(this));
    
    // Close menu on click outside
    document.addEventListener('click', (e) => {
      if (this.menuManager.containsElement(e.target as HTMLElement)) {
        return;
      }
      this.menuManager.closeAddNodeMenu();
    });

    // Close menu on touch outside
    document.addEventListener('touchstart', (e) => {
      if (this.menuManager.containsElement(e.target as HTMLElement)) {
        return;
      }
      this.menuManager.closeAddNodeMenu();
    }, { passive: true });

    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handlePanStart(e: MouseEvent): void {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.node')) return;
    if ((e.target as HTMLElement).closest('.connection')) return;

    // Clear connection selection when clicking on background
    if (this.selectedConnectionId) {
      this.selectedConnectionId = null;
      this.connectionRenderer.updateConnectionSelection(null);
    }

    this.dragState = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: this.state.pan.x,
      offsetY: this.state.pan.y,
    };
    this.container.style.cursor = 'grabbing';
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.dragState.isDragging && !this.dragState.nodeId) {
      // Panning
      const dx = e.clientX - this.dragState.startX;
      const dy = e.clientY - this.dragState.startY;
      this.state.pan.x = this.dragState.offsetX + dx;
      this.state.pan.y = this.dragState.offsetY + dy;
      this.updateTransform();
    } else if (this.dragState.isDragging && this.dragState.nodeId) {
      // Moving node
      const node = this.state.nodes.get(this.dragState.nodeId);
      if (node) {
        const dx = (e.clientX - this.dragState.startX) / this.state.zoom;
        const dy = (e.clientY - this.dragState.startY) / this.state.zoom;
        const newX = this.dragState.offsetX + dx;
        const newY = this.dragState.offsetY + dy;
        const nodeIdStr = node.id;
        this.handleNodeMove(nodeIdStr, newX, newY);
        const domainNode = this.nodeCache.get(nodeIdStr);
        if (domainNode) {
          this.nodeRenderer.updateNodePosition(domainNode);
        }
        const connections = this.nodeEditorService.getAllConnections();
        this.connectionRenderer.updateConnections(connections);
      }
    } else if (this.connectionDrag.isConnecting) {
      const svgRect = this.svgContainer.getBoundingClientRect();
      this.connectionDrag.currentX = (e.clientX - svgRect.left) / this.state.zoom;
      this.connectionDrag.currentY = (e.clientY - svgRect.top) / this.state.zoom;
      if (this.connectionDrag.fromSocket) {
        const socketId = this.connectionDrag.fromSocket.id;
        this.connectionRenderer.updateConnectionPreview(
          socketId,
          this.connectionDrag.currentX,
          this.connectionDrag.currentY
        );
      }
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (this.connectionDrag.isConnecting) {
      // Check if dropped on a valid socket
      const targetSocket = this.getSocketAtPosition(e.clientX, e.clientY);
      if (targetSocket && this.connectionDrag.fromSocket) {
      // Reconstruct Socket from connectionDrag state
      const fromNode = this.nodeCache.get(this.connectionDrag.fromSocket.nodeId);
      if (fromNode) {
        const fromSocket = fromNode.getSocket(this.connectionDrag.fromSocket.id);
        if (fromSocket) {
          this.createConnection(fromSocket, targetSocket);
        }
      }
      }
      this.connectionDrag.isConnecting = false;
      this.connectionRenderer.removeConnectionPreview();
      this.container.classList.remove('connecting');
    }

    this.dragState.isDragging = false;
    this.dragState.nodeId = undefined;
    this.container.style.cursor = 'grab';
  }

  private handleZoom(e: WheelEvent): void {
    // Don't zoom if scrolling in add-node menu
    if (this.menuManager.containsElement(e.target as HTMLElement)) {
      return;
    }
    
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(2, this.state.zoom * delta));
    
    // Zoom toward cursor
    const rect = this.container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    this.state.pan.x = mouseX - (mouseX - this.state.pan.x) * (newZoom / this.state.zoom);
    this.state.pan.y = mouseY - (mouseY - this.state.pan.y) * (newZoom / this.state.zoom);
    this.state.zoom = newZoom;
    
    this.updateTransform();
  }

  private handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    this.menuManager.showAddNodeMenu(e.clientX, e.clientY);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Delete selected connection if one is selected
      if (this.selectedConnectionId) {
        this.deleteConnection(this.selectedConnectionId);
        this.selectedConnectionId = null;
      } else {
        this.deleteSelectedNodes();
      }
    } else if (e.key === 'a' && e.shiftKey) {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      this.menuManager.showAddNodeMenu(rect.width / 2, rect.height / 2);
    }
  }

  // ======== タッチイベントハンドラー ========

  /**
   * 2点間の距離を計算
   */
  private getTouchDistance(touches: TouchList): number {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 2点の中心座標を計算
   */
  private getTouchCenter(touches: TouchList): { x: number; y: number } {
    if (touches.length < 2) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  /**
   * 長押しタイマーをクリア
   */
  private clearLongPressTimer(): void {
    if (this.touchState.longPressTimer !== null) {
      clearTimeout(this.touchState.longPressTimer);
      this.touchState.longPressTimer = null;
    }
  }

  /**
   * タッチ開始
   */
  private handleTouchStart(e: TouchEvent): void {
    // メニュー内のタッチは通常処理
    if (this.menuManager.containsElement(e.target as HTMLElement)) {
      return;
    }

    // 2本指タッチ（ピンチズーム）
    if (e.touches.length === 2) {
      e.preventDefault();
      this.clearLongPressTimer();
      this.touchState.isTwoFingerTouch = true;
      this.touchState.initialDistance = this.getTouchDistance(e.touches);
      this.touchState.initialZoom = this.state.zoom;
      const center = this.getTouchCenter(e.touches);
      this.touchState.pinchCenterX = center.x;
      this.touchState.pinchCenterY = center.y;
      return;
    }

    // 1本指タッチ
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const target = touch.target as HTMLElement;

      // ソケットをタッチした場合
      if (target.classList.contains('socket')) {
        e.preventDefault();
        const socketId = target.dataset.socketId;
        const nodeId = target.dataset.nodeId;
        if (socketId && nodeId) {
          const node = this.nodeCache.get(nodeId);
          if (node) {
            const socket = node.getSocket(socketId);
            if (socket) {
              this.handleSocketTouch(socket, touch);
            }
          }
        }
        return;
      }

      // ノードヘッダーをタッチした場合（ドラッグ開始）
      const nodeHeader = target.closest('.node-header');
      if (nodeHeader) {
        e.preventDefault();
        const nodeEl = nodeHeader.closest('.node') as HTMLElement;
        const nodeId = nodeEl?.dataset.nodeId;
        if (nodeId) {
          const node = this.nodeCache.get(nodeId);
          if (node) {
            this.handleNodeTouchStart(touch, node);
          }
        }
        return;
      }

      // ノード内の入力フィールドはデフォルト動作を許可
      if (target.closest('.node-input-field') || target.closest('.node-vector-input-field') || 
          target.closest('.node-color-picker') || target.closest('.node-large-color-picker')) {
        return;
      }

      // 背景をタッチした場合（パン開始 + 長押し検出）
      if (!target.closest('.node')) {
        e.preventDefault();
        
        // 接続選択をクリア
        if (this.selectedConnectionId) {
          this.selectedConnectionId = null;
          this.connectionRenderer.updateConnectionSelection(null);
        }

        // パン開始
        this.dragState = {
          isDragging: true,
          startX: touch.clientX,
          startY: touch.clientY,
          offsetX: this.state.pan.x,
          offsetY: this.state.pan.y,
        };

        // 長押し検出（ノード追加メニュー表示用）
        this.touchState.longPressX = touch.clientX;
        this.touchState.longPressY = touch.clientY;
        this.touchState.longPressTimer = window.setTimeout(() => {
          // 長押し成立時、ドラッグ中でなければメニュー表示
          if (this.dragState.isDragging && !this.dragState.nodeId) {
            const dx = Math.abs(touch.clientX - this.touchState.longPressX);
            const dy = Math.abs(touch.clientY - this.touchState.longPressY);
            // 移動が少なければ長押しとして認識
            if (dx < 10 && dy < 10) {
              this.dragState.isDragging = false;
              this.menuManager.showAddNodeMenu(this.touchState.longPressX, this.touchState.longPressY);
            }
          }
          this.touchState.longPressTimer = null;
        }, this.LONG_PRESS_DURATION);
      }
    }
  }

  /**
   * タッチ移動
   */
  private handleTouchMove(e: TouchEvent): void {
    // メニュー内のタッチは通常処理
    if (this.menuManager.containsElement(e.target as HTMLElement)) {
      return;
    }

    // ピンチズーム
    if (e.touches.length === 2 && this.touchState.isTwoFingerTouch) {
      e.preventDefault();
      this.clearLongPressTimer();

      const currentDistance = this.getTouchDistance(e.touches);
      const scale = currentDistance / this.touchState.initialDistance;
      const newZoom = Math.max(0.25, Math.min(2, this.touchState.initialZoom * scale));

      // ピンチの中心に向かってズーム
      const rect = this.container.getBoundingClientRect();
      const centerX = this.touchState.pinchCenterX - rect.left;
      const centerY = this.touchState.pinchCenterY - rect.top;

      this.state.pan.x = centerX - (centerX - this.state.pan.x) * (newZoom / this.state.zoom);
      this.state.pan.y = centerY - (centerY - this.state.pan.y) * (newZoom / this.state.zoom);
      this.state.zoom = newZoom;

      this.updateTransform();
      return;
    }

    // 1本指の移動
    if (e.touches.length === 1) {
      const touch = e.touches[0];

      // 移動があったら長押しをキャンセル
      const dx = Math.abs(touch.clientX - this.touchState.longPressX);
      const dy = Math.abs(touch.clientY - this.touchState.longPressY);
      if (dx > 10 || dy > 10) {
        this.clearLongPressTimer();
      }

      // ノードドラッグ
      if (this.dragState.isDragging && this.dragState.nodeId) {
        e.preventDefault();
        const node = this.state.nodes.get(this.dragState.nodeId);
        if (node) {
          const dx = (touch.clientX - this.dragState.startX) / this.state.zoom;
          const dy = (touch.clientY - this.dragState.startY) / this.state.zoom;
          const newX = this.dragState.offsetX + dx;
          const newY = this.dragState.offsetY + dy;
          const nodeIdStr = node.id;
          this.handleNodeMove(nodeIdStr, newX, newY);
          const domainNode = this.nodeCache.get(nodeIdStr);
          if (domainNode) {
            this.nodeRenderer.updateNodePosition(domainNode);
          }
          const connections = this.nodeEditorService.getAllConnections();
          this.connectionRenderer.updateConnections(connections);
        }
        return;
      }

      // パン
      if (this.dragState.isDragging && !this.dragState.nodeId) {
        e.preventDefault();
        const dx = touch.clientX - this.dragState.startX;
        const dy = touch.clientY - this.dragState.startY;
        this.state.pan.x = this.dragState.offsetX + dx;
        this.state.pan.y = this.dragState.offsetY + dy;
        this.updateTransform();
        return;
      }

      // 接続ドラッグ
      if (this.connectionDrag.isConnecting) {
        e.preventDefault();
        const svgRect = this.svgContainer.getBoundingClientRect();
        this.connectionDrag.currentX = (touch.clientX - svgRect.left) / this.state.zoom;
        this.connectionDrag.currentY = (touch.clientY - svgRect.top) / this.state.zoom;
        if (this.connectionDrag.fromSocket) {
          const socketId = this.connectionDrag.fromSocket.id;
          this.connectionRenderer.updateConnectionPreview(
            socketId,
            this.connectionDrag.currentX,
            this.connectionDrag.currentY
          );
        }
      }
    }
  }

  /**
   * タッチ終了
   */
  private handleTouchEnd(e: TouchEvent): void {
    this.clearLongPressTimer();

    // ピンチ終了
    if (this.touchState.isTwoFingerTouch && e.touches.length < 2) {
      this.touchState.isTwoFingerTouch = false;
      // 1本指が残っている場合は新しいパン開始点として設定
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.dragState = {
          isDragging: true,
          startX: touch.clientX,
          startY: touch.clientY,
          offsetX: this.state.pan.x,
          offsetY: this.state.pan.y,
        };
      }
      return;
    }

    // 接続ドラッグ終了
    if (this.connectionDrag.isConnecting && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const targetSocket = this.getSocketAtPosition(touch.clientX, touch.clientY);
      if (targetSocket && this.connectionDrag.fromSocket) {
        const fromNode = this.nodeCache.get(this.connectionDrag.fromSocket.nodeId);
        if (fromNode) {
          const fromSocket = fromNode.getSocket(this.connectionDrag.fromSocket.id);
          if (fromSocket) {
            this.createConnection(fromSocket, targetSocket);
          }
        }
      }
      this.connectionDrag.isConnecting = false;
      this.connectionRenderer.removeConnectionPreview();
      this.container.classList.remove('connecting');
    }

    // ドラッグ終了
    if (e.touches.length === 0) {
      this.dragState.isDragging = false;
      this.dragState.nodeId = undefined;
    }
  }

  /**
   * ソケットのタッチ処理
   */
  private handleSocketTouch(socket: Socket, _touch: Touch): void {
    // 既に接続されている入力ソケットの場合は切断
    if (socket.direction === 'input' && this.isSocketConnected(socket.id.value)) {
      this.disconnectSocket(socket.id.value);
      return;
    }

    // 接続ドラッグ開始
    this.startConnectionDrag(socket);
  }

  /**
   * ノードのタッチドラッグ開始
   */
  private handleNodeTouchStart(touch: Touch, node: Node): void {
    this.dragState = {
      isDragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      nodeId: node.id.value,
      offsetX: node.position.x,
      offsetY: node.position.y,
    };
  }

  private updateTransform(): void {
    this.nodeContainer.style.transform = 
      `translate(${this.state.pan.x}px, ${this.state.pan.y}px) scale(${this.state.zoom})`;
    this.svgContainer.style.transform = 
      `translate(${this.state.pan.x}px, ${this.state.pan.y}px) scale(${this.state.zoom})`;
    const connections = this.nodeEditorService.getAllConnections();
    this.connectionRenderer.updateConnections(connections);
  }

  addNode(definitionId: string, x: number, y: number): Node | null {
    const definition = nodeDefinitionLoader.getDefinition(definitionId);
    if (!definition) return null;

    const position = new Position(x, y);
    const domainNode = this.nodeEditorService.addNode(definition, position);
    
    // Update cache and render
    this.nodeCache.set(domainNode.id.value, domainNode);
    this.syncNodeCacheToState();
    this.nodeRenderer.renderNode(domainNode);
    this.updateConnectionRendererNodes();
    this.triggerShaderUpdate();
    
    return domainNode;
  }
  
  private syncNodeCacheToState(): void {
    // Keep state.nodes in sync for EditorState compatibility
    // This is temporary until EditorState is fully migrated
    this.state.nodes.clear();
    for (const node of this.nodeCache.values()) {
      // Create minimal state entry (for compatibility)
      this.state.nodes.set(node.id.value, {
        id: node.id.value,
        definitionId: node.definitionId,
        x: node.position.x,
        y: node.position.y,
        inputs: [],
        outputs: [],
        values: {},
      });
    }
  }
  
  private updateConnectionRendererNodes(): void {
    // Update ConnectionRenderer's node map
    (this.connectionRenderer as any).nodes = this.nodeCache;
  }

  private handleSocketClick(socket: Socket, e: MouseEvent): void {
    e.stopPropagation();
    
    // If clicking on an input socket that already has a connection, disconnect it
    if (socket.direction === 'input' && this.isSocketConnected(socket.id.value)) {
      this.disconnectSocket(socket.id.value);
      return;
    }
    
    if (e.type === 'mousedown') {
      this.startConnectionDrag(socket);
    } else if (e.type === 'mouseup') {
      // Only create connection if we're actually connecting (not just disconnecting)
      if (this.connectionDrag.isConnecting && this.connectionDrag.fromSocket) {
        // Don't create connection if clicking on the same socket we started from
        if (this.connectionDrag.fromSocket.id !== socket.id.value) {
          // Reconstruct Socket from connectionDrag state
          const fromNode = this.nodeCache.get(this.connectionDrag.fromSocket.nodeId);
          if (fromNode) {
            const fromSocket = fromNode.getSocket(this.connectionDrag.fromSocket.id);
            if (fromSocket) {
              this.createConnection(fromSocket, socket);
            }
          }
        }
        this.connectionDrag.isConnecting = false;
        this.connectionRenderer.removeConnectionPreview();
        this.container.classList.remove('connecting');
      }
    }
  }

  private handleNodeDragStart(e: MouseEvent, node: Node): void {
    e.stopPropagation();
    
    this.dragState = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      nodeId: node.id.value,
      offsetX: node.position.x,
      offsetY: node.position.y,
    };
  }

  private handleNodeClick(node: Node, e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest('.socket')) {
      if (!e.shiftKey) {
        this.state.selectedNodes.clear();
      }
      this.state.selectedNodes.add(node.id.value);
      this.nodeRenderer.updateSelectionDisplay(this.state.selectedNodes);
    }
  }

  private handleNodeMove(nodeId: string, newX: number, newY: number): void {
    try {
      const nodeIdObj = new NodeId(nodeId);
      const newPosition = new Position(newX, newY);
      this.nodeEditorService.moveNode(nodeIdObj, newPosition);
      
      // Update legacy state
      const node = this.state.nodes.get(nodeId);
      if (node) {
        node.x = newX;
        node.y = newY;
      }
    } catch (error) {
      console.warn('Failed to move node:', error);
    }
  }

  private startConnectionDrag(socket: Socket): void {
    this.connectionDrag = {
      isConnecting: true,
      fromSocket: {
        id: socket.id.value,
        nodeId: socket.nodeId.value,
        name: socket.name,
        type: socket.type,
        direction: socket.direction,
      },
      currentX: 0,
      currentY: 0,
    };
    this.container.classList.add('connecting');
  }

  private createConnection(from: Socket, to: Socket): void {
    try {
      // Use domain service to create connection
      this.nodeEditorService.createConnection(
        from.id,
        to.id
      );

      // Update rendering
      const connections = this.nodeEditorService.getAllConnections();
      this.connectionRenderer.updateConnections(connections);
      this.nodeRenderer.updateSocketDisplay(from.id.value, true);
      this.nodeRenderer.updateSocketDisplay(to.id.value, true);
      
      const toNode = this.nodeCache.get(to.nodeId.value);
      if (toNode) {
        this.nodeRenderer.updateNodeInputFields(toNode);
      }
      
      this.triggerShaderUpdate();
    } catch (error) {
      console.warn('Failed to create connection:', error);
    }
  }

  private isSocketConnected(socketId: string): boolean {
    const connections = this.nodeEditorService.getAllConnections();
    return connections.some(conn => 
      conn.fromSocketId.value === socketId || conn.toSocketId.value === socketId
    );
  }

  private handleConnectionClick(connectionId: string): void {
    this.selectedConnectionId = connectionId;
    this.connectionRenderer.updateConnectionSelection(connectionId);
  }

  private disconnectSocket(socketId: string): void {
    const connections = this.nodeEditorService.getAllConnections();
    const connection = connections.find(conn => 
      conn.fromSocketId.value === socketId || conn.toSocketId.value === socketId
    );
    if (connection) {
      this.deleteConnection(connection.id.value);
    }
  }
  
  private deleteConnection(connectionId: string): void {
    const connections = this.nodeEditorService.getAllConnections();
    const connection = connections.find(c => c.id.value === connectionId);
    if (!connection) return;
    
    try {
      // Use domain service to delete connection
      const domainConnectionId = new ConnectionId(connectionId);
      this.nodeEditorService.deleteConnection(domainConnectionId);
      
      // Update rendering
      const updatedConnections = this.nodeEditorService.getAllConnections();
      this.connectionRenderer.updateConnections(updatedConnections);
      this.nodeRenderer.updateSocketDisplay(
        connection.fromSocketId.value,
        this.isSocketConnected(connection.fromSocketId.value)
      );
      this.nodeRenderer.updateSocketDisplay(
        connection.toSocketId.value,
        this.isSocketConnected(connection.toSocketId.value)
      );
      
      // Update input fields for the node that had the input connection
      const toNode = this.nodeCache.get(connection.toNodeId.value);
      if (toNode) {
        this.nodeRenderer.updateNodeInputFields(toNode);
      }
      
      this.triggerShaderUpdate();
      
      if (this.selectedConnectionId === connectionId) {
        this.selectedConnectionId = null;
      }
    } catch (error) {
      console.warn('Failed to delete connection:', error);
    }
  }

  private getSocketAtPosition(x: number, y: number): Socket | undefined {
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      if (el.classList.contains('socket')) {
        const socketId = (el as HTMLElement).dataset.socketId;
        const nodeId = (el as HTMLElement).dataset.nodeId;
        if (socketId && nodeId) {
          const node = this.nodeCache.get(nodeId);
          if (node) {
            return [...node.inputs, ...node.outputs].find(s => s.id.value === socketId);
          }
        }
      }
    }
    return undefined;
  }

  private deleteSelectedNodes(): void {
    for (const nodeIdStr of this.state.selectedNodes) {
      // Don't delete output node
      const node = this.nodeCache.get(nodeIdStr);
      if (node?.definitionId === 'output_color') continue;

      try {
        // Use domain service to delete node
        const nodeId = new NodeId(nodeIdStr);
        this.nodeEditorService.deleteNode(nodeId);
        
        // Remove from cache
        this.nodeCache.delete(nodeIdStr);
        this.syncNodeCacheToState();

        // Remove node DOM element
        const nodeEl = this.nodeContainer.querySelector(`[data-node-id="${nodeIdStr}"]`);
        if (nodeEl) nodeEl.remove();
      } catch (error) {
        console.warn('Failed to delete node:', error);
      }
    }

    this.state.selectedNodes.clear();
    const connections = this.nodeEditorService.getAllConnections();
    this.connectionRenderer.updateConnections(connections);
    this.triggerShaderUpdate();
  }

  private triggerShaderUpdate(): void {
    // Get domain entities from repository and generate shader
    const domainNodes = this.nodeEditorService.getAllNodes();
    const domainConnections = this.nodeEditorService.getAllConnections();
    const code = this.shaderGenerator.generate(domainNodes, domainConnections);
    this.onShaderUpdate?.(code);
  }

  private createDefaultNodes(): void {
    // Create UV input node
    this.addNode('input_uv', 50, 100);
    
    // Create time node
    this.addNode('input_time', 50, 250);
    
    // Create output node
    this.addNode('output_color', 500, 150);
  }

  getState(): EditorState {
    return this.state;
  }

  generateShader(): string {
    // Get domain entities from repository and generate shader
    const domainNodes = this.nodeEditorService.getAllNodes();
    const domainConnections = this.nodeEditorService.getAllConnections();
    return this.shaderGenerator.generate(domainNodes, domainConnections);
  }

  /**
   * シェーダージェネレーターを設定
   */
  setShaderGenerator(generator: IShaderGenerator): void {
    this.shaderGenerator = generator;
    this.triggerShaderUpdate();
  }
}
