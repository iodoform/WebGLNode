import type { Node, Socket, EditorState, DragState, ConnectionDragState } from '../types';
import { WGSLGenerator } from '../nodes/WGSLGenerator';
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
import { NodeAdapter } from '../infrastructure/adapters/NodeAdapter';
import { ConnectionAdapter } from '../infrastructure/adapters/ConnectionAdapter';
import { nodeDefinitionLoader } from '../nodes/NodeDefinitionLoader';

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

  // DDD Services
  private nodeRepository: InMemoryNodeRepository;
  private connectionRepository: InMemoryConnectionRepository;
  private nodeEditorService: NodeEditorService;

  // Renderers
  private inputFieldRenderer: InputFieldRenderer;
  private nodeRenderer: NodeRenderer;
  private connectionRenderer: ConnectionRenderer;
  private menuManager: MenuManager;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;

    // Initialize DDD repositories and services
    this.nodeRepository = new InMemoryNodeRepository();
    this.connectionRepository = new InMemoryConnectionRepository();
    this.nodeEditorService = new NodeEditorService(
      this.nodeRepository,
      this.connectionRepository
    );

    this.state = {
      nodes: new Map(),
      connections: new Map(),
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
      () => this.triggerShaderUpdate()
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
      this.state.nodes,
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
    // Pan handling
    this.container.addEventListener('mousedown', this.handlePanStart.bind(this));
    this.container.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.container.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.container.addEventListener('wheel', this.handleZoom.bind(this));

    // Context menu for adding nodes
    this.container.addEventListener('contextmenu', this.handleContextMenu.bind(this));
    
    // Close menu on click outside
    document.addEventListener('click', (e) => {
      if (this.menuManager.containsElement(e.target as HTMLElement)) {
        return;
      }
      this.menuManager.closeAddNodeMenu();
    });

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
        this.handleNodeMove(node.id, newX, newY);
        this.nodeRenderer.updateNodePosition(node);
        this.connectionRenderer.updateConnections(this.state.connections);
      }
    } else if (this.connectionDrag.isConnecting) {
      const svgRect = this.svgContainer.getBoundingClientRect();
      this.connectionDrag.currentX = (e.clientX - svgRect.left) / this.state.zoom;
      this.connectionDrag.currentY = (e.clientY - svgRect.top) / this.state.zoom;
      if (this.connectionDrag.fromSocket) {
        this.connectionRenderer.updateConnectionPreview(
          this.connectionDrag.fromSocket.id,
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
        this.createConnection(this.connectionDrag.fromSocket, targetSocket);
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

  private updateTransform(): void {
    this.nodeContainer.style.transform = 
      `translate(${this.state.pan.x}px, ${this.state.pan.y}px) scale(${this.state.zoom})`;
    this.svgContainer.style.transform = 
      `translate(${this.state.pan.x}px, ${this.state.pan.y}px) scale(${this.state.zoom})`;
    this.connectionRenderer.updateConnections(this.state.connections);
  }

  addNode(definitionId: string, x: number, y: number): Node | null {
    const definition = nodeDefinitionLoader.getDefinition(definitionId);
    if (!definition) return null;

    const position = new Position(x, y);
    const domainNode = this.nodeEditorService.addNode(definition, position);
    
    // Convert to legacy format for rendering
    const legacyNode = NodeAdapter.toLegacyNode(domainNode);
    this.state.nodes.set(legacyNode.id, legacyNode);
    this.nodeRenderer.renderNode(legacyNode);
    this.triggerShaderUpdate();
    
    return legacyNode;
  }

  private handleSocketClick(socket: Socket, e: MouseEvent): void {
    e.stopPropagation();
    
    // If clicking on an input socket that already has a connection, disconnect it
    if (socket.direction === 'input' && this.isSocketConnected(socket.id)) {
      this.disconnectSocket(socket.id);
      return;
    }
    
    if (e.type === 'mousedown') {
      this.startConnectionDrag(socket);
    } else if (e.type === 'mouseup') {
      // Only create connection if we're actually connecting (not just disconnecting)
      if (this.connectionDrag.isConnecting && this.connectionDrag.fromSocket) {
        // Don't create connection if clicking on the same socket we started from
        if (this.connectionDrag.fromSocket.id !== socket.id) {
          this.createConnection(this.connectionDrag.fromSocket, socket);
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
      nodeId: node.id,
      offsetX: node.x,
      offsetY: node.y,
    };
  }

  private handleNodeClick(node: Node, e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest('.socket')) {
      if (!e.shiftKey) {
        this.state.selectedNodes.clear();
      }
      this.state.selectedNodes.add(node.id);
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
      fromSocket: socket,
      currentX: 0,
      currentY: 0,
    };
    this.container.classList.add('connecting');
  }

  private createConnection(from: Socket, to: Socket): void {
    try {
      // Convert legacy sockets to domain entities
      const fromNode = this.state.nodes.get(from.nodeId);
      const toNode = this.state.nodes.get(to.nodeId);
      if (!fromNode || !toNode) return;

      const domainFromNode = NodeAdapter.toDomainNode(fromNode);
      const domainToNode = NodeAdapter.toDomainNode(toNode);
      
      const domainFromSocket = domainFromNode.getSocket(from.id);
      const domainToSocket = domainToNode.getSocket(to.id);
      
      if (!domainFromSocket || !domainToSocket) return;

      // Use domain service to create connection
      const domainConnection = this.nodeEditorService.createConnection(
        domainFromSocket.id,
        domainToSocket.id
      );

      // Convert to legacy format for rendering
      const legacyConnection = ConnectionAdapter.toLegacyConnection(domainConnection);
      this.state.connections.set(legacyConnection.id, legacyConnection);
      
      // Sync connections from repository
      this.syncConnectionsFromRepository();
      this.connectionRenderer.updateConnections(this.state.connections);
      this.nodeRenderer.updateSocketDisplay(from.id, true);
      this.nodeRenderer.updateSocketDisplay(to.id, true);
      
      if (toNode) {
        this.nodeRenderer.updateNodeInputFields(toNode);
      }
      
      this.triggerShaderUpdate();
    } catch (error) {
      console.warn('Failed to create connection:', error);
    }
  }

  private syncConnectionsFromRepository(): void {
    // Sync connections from repository to legacy state
    const domainConnections = this.nodeEditorService.getAllConnections();
    this.state.connections.clear();
    for (const domainConn of domainConnections) {
      const legacyConn = ConnectionAdapter.toLegacyConnection(domainConn);
      this.state.connections.set(legacyConn.id, legacyConn);
    }
  }

  private isSocketConnected(socketId: string): boolean {
    for (const conn of this.state.connections.values()) {
      if (conn.fromSocketId === socketId || conn.toSocketId === socketId) {
        return true;
      }
    }
    return false;
  }

  private handleConnectionClick(connectionId: string): void {
    this.selectedConnectionId = connectionId;
    this.connectionRenderer.updateConnectionSelection(connectionId);
  }

  private disconnectSocket(socketId: string): void {
    for (const [id, conn] of this.state.connections) {
      if (conn.fromSocketId === socketId || conn.toSocketId === socketId) {
        this.deleteConnection(id);
        break; // Only disconnect one connection per socket
      }
    }
  }
  
  private deleteConnection(connectionId: string): void {
    const connection = this.state.connections.get(connectionId);
    if (!connection) return;
    
    try {
      // Use domain service to delete connection
      const domainConnectionId = new ConnectionId(connectionId);
      this.nodeEditorService.deleteConnection(domainConnectionId);
      
      this.state.connections.delete(connectionId);
      this.connectionRenderer.updateConnections(this.state.connections);
      this.nodeRenderer.updateSocketDisplay(
        connection.fromSocketId,
        this.isSocketConnected(connection.fromSocketId)
      );
      this.nodeRenderer.updateSocketDisplay(
        connection.toSocketId,
        this.isSocketConnected(connection.toSocketId)
      );
      
      // Update input fields for the node that had the input connection
      const toNode = this.state.nodes.get(connection.toNodeId);
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
          const node = this.state.nodes.get(nodeId);
          if (node) {
            return [...node.inputs, ...node.outputs].find(s => s.id === socketId);
          }
        }
      }
    }
    return undefined;
  }

  private deleteSelectedNodes(): void {
    for (const nodeIdStr of this.state.selectedNodes) {
      // Don't delete output node
      const node = this.state.nodes.get(nodeIdStr);
      if (node?.definitionId === 'output_color') continue;

      try {
        // Use domain service to delete node
        const nodeId = new NodeId(nodeIdStr);
        this.nodeEditorService.deleteNode(nodeId);
        
        // Remove related connections
        for (const [connId, conn] of this.state.connections) {
          if (conn.fromNodeId === nodeIdStr || conn.toNodeId === nodeIdStr) {
            this.state.connections.delete(connId);
          }
        }

        // Remove node
        this.state.nodes.delete(nodeIdStr);
        const nodeEl = this.nodeContainer.querySelector(`[data-node-id="${nodeIdStr}"]`);
        if (nodeEl) nodeEl.remove();
      } catch (error) {
        console.warn('Failed to delete node:', error);
      }
    }

    this.state.selectedNodes.clear();
    this.connectionRenderer.updateConnections(this.state.connections);
    this.triggerShaderUpdate();
  }

  private triggerShaderUpdate(): void {
    // Convert domain entities to legacy format for WGSLGenerator
    // (WGSLGenerator still uses legacy types)
    const code = WGSLGenerator.generate(this.state.nodes, this.state.connections);
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
    return WGSLGenerator.generate(this.state.nodes, this.state.connections);
  }
}
