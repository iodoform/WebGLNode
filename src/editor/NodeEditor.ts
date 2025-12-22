import type { Node, Connection, Socket, EditorState, DragState, ConnectionDragState, SocketType } from '../types';
import { NodeFactory } from '../nodes/NodeFactory';
import { nodeDefinitionLoader } from '../nodes/NodeDefinitionLoader';
import { WGSLGenerator } from '../nodes/WGSLGenerator';

export class NodeEditor {
  private container: HTMLElement;
  private nodeContainer: HTMLElement;
  private svgContainer: SVGSVGElement;
  
  private state: EditorState;
  private dragState: DragState;
  private connectionDrag: ConnectionDragState;
  private selectedConnectionId: string | null = null;
  
  private addNodeMenu: HTMLElement | null = null;
  private onShaderUpdate?: (code: string) => void;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;

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
      if (this.addNodeMenu && !this.addNodeMenu.contains(e.target as HTMLElement)) {
        this.closeAddNodeMenu();
      }
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
      this.updateConnectionSelection();
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
        node.x = this.dragState.offsetX + dx;
        node.y = this.dragState.offsetY + dy;
        this.updateNodePosition(node);
        this.updateConnections();
      }
    } else if (this.connectionDrag.isConnecting) {
      const svgRect = this.svgContainer.getBoundingClientRect();
      this.connectionDrag.currentX = (e.clientX - svgRect.left) / this.state.zoom;
      this.connectionDrag.currentY = (e.clientY - svgRect.top) / this.state.zoom;
      this.updateConnectionPreview();
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
      this.removeConnectionPreview();
    }

    this.dragState.isDragging = false;
    this.dragState.nodeId = undefined;
    this.container.style.cursor = 'grab';
  }

  private handleZoom(e: WheelEvent): void {
    // Don't zoom if scrolling in add-node menu
    if (this.addNodeMenu && this.addNodeMenu.contains(e.target as HTMLElement)) {
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
    this.showAddNodeMenu(e.clientX, e.clientY);
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
      this.showAddNodeMenu(rect.width / 2, rect.height / 2);
    }
  }

  private updateTransform(): void {
    this.nodeContainer.style.transform = 
      `translate(${this.state.pan.x}px, ${this.state.pan.y}px) scale(${this.state.zoom})`;
    this.svgContainer.style.transform = 
      `translate(${this.state.pan.x}px, ${this.state.pan.y}px) scale(${this.state.zoom})`;
    this.updateConnections();
  }

  private showAddNodeMenu(x: number, y: number): void {
    this.closeAddNodeMenu();

    const menu = document.createElement('div');
    menu.className = 'add-node-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Search box
    const searchDiv = document.createElement('div');
    searchDiv.className = 'add-node-menu-search';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search nodes...';
    searchInput.addEventListener('input', () => {
      this.updateNodeMenuList(menu, searchInput.value, x, y);
    });
    searchDiv.appendChild(searchInput);
    menu.appendChild(searchDiv);

    this.updateNodeMenuList(menu, '', x, y);

    // Prevent wheel events from propagating to background (zoom)
    menu.addEventListener('wheel', (e) => {
      e.stopPropagation();
    });

    this.container.appendChild(menu);
    this.addNodeMenu = menu;
    
    setTimeout(() => searchInput.focus(), 0);
  }

  private updateNodeMenuList(menu: HTMLElement, filter: string, menuX: number, menuY: number): void {
    // Remove existing items (keep search box)
    const items = menu.querySelectorAll('.add-node-category, .add-node-item');
    items.forEach(item => item.remove());

    const definitions = filter 
      ? nodeDefinitionLoader.searchDefinitions(filter)
      : nodeDefinitionLoader.getAllDefinitions();

    const byCategory = new Map<string, typeof definitions>();
    for (const def of definitions) {
      const list = byCategory.get(def.category) || [];
      list.push(def);
      byCategory.set(def.category, list);
    }

    for (const [category, defs] of byCategory) {
      const categoryEl = document.createElement('div');
      categoryEl.className = 'add-node-category';
      categoryEl.textContent = category;
      menu.appendChild(categoryEl);

      for (const def of defs) {
        const itemEl = document.createElement('div');
        itemEl.className = 'add-node-item';
        
        const colorIndicator = document.createElement('div');
        colorIndicator.className = 'node-color-indicator';
        colorIndicator.style.backgroundColor = def.color;
        itemEl.appendChild(colorIndicator);
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = def.name;
        itemEl.appendChild(nameSpan);

        itemEl.addEventListener('click', () => {
          const rect = this.container.getBoundingClientRect();
          const x = (menuX - rect.left - this.state.pan.x) / this.state.zoom;
          const y = (menuY - rect.top - this.state.pan.y) / this.state.zoom;
          this.addNode(def.id, x, y);
          this.closeAddNodeMenu();
        });

        menu.appendChild(itemEl);
      }
    }
  }

  private closeAddNodeMenu(): void {
    if (this.addNodeMenu) {
      this.addNodeMenu.remove();
      this.addNodeMenu = null;
    }
  }

  addNode(definitionId: string, x: number, y: number): Node | null {
    const node = NodeFactory.createNode(definitionId, x, y);
    if (!node) return null;

    this.state.nodes.set(node.id, node);
    this.renderNode(node);
    this.triggerShaderUpdate();
    
    return node;
  }

  private renderNode(node: Node): void {
    const definition = nodeDefinitionLoader.getDefinition(node.definitionId);
    if (!definition) return;

    const nodeEl = document.createElement('div');
    nodeEl.className = 'node';
    nodeEl.dataset.nodeId = node.id;
    nodeEl.style.left = `${node.x}px`;
    nodeEl.style.top = `${node.y}px`;

    // Header
    const header = document.createElement('div');
    header.className = 'node-header';
    header.style.borderTop = `3px solid ${definition.color}`;
    
    const icon = document.createElement('div');
    icon.className = 'node-icon';
    icon.style.backgroundColor = definition.color;
    header.appendChild(icon);
    
    const title = document.createElement('span');
    title.textContent = definition.name;
    header.appendChild(title);
    
    header.addEventListener('mousedown', (e) => this.handleNodeDragStart(e, node));
    nodeEl.appendChild(header);

    // Content
    const content = document.createElement('div');
    content.className = 'node-content';

    // Special UI for color picker nodes
    if (definition.customUI === 'colorPicker') {
      const colorRow = document.createElement('div');
      colorRow.className = 'node-row node-color-picker-row';
      
      const colorPicker = this.createNodeColorPicker(node);
      colorRow.appendChild(colorPicker);
      
      // Add output socket
      if (node.outputs[0]) {
        colorRow.appendChild(this.createSocket(node.outputs[0], node));
      }
      
      content.appendChild(colorRow);
    } else {
      // Create two-column layout: inputs (left) and outputs (right)
      const columnsContainer = document.createElement('div');
      columnsContainer.className = 'node-columns-container';
      
      // Left column: inputs
      const inputColumn = document.createElement('div');
      inputColumn.className = 'node-input-column';
      
      for (const input of node.inputs) {
        const inputRow = document.createElement('div');
        inputRow.className = 'node-input-row';
        
        // Socket + label
        const socketWrapper = this.createSocket(input, node);
        inputRow.appendChild(socketWrapper);
        
        // Input field or spacer (always present for alignment)
        const rightSide = document.createElement('div');
        rightSide.className = 'node-input-right-side';
        if (!this.isSocketConnected(input.id)) {
          rightSide.appendChild(this.createInputField(input, node));
        }
        inputRow.appendChild(rightSide);
        
        inputColumn.appendChild(inputRow);
      }
      
      // Right column: outputs
      const outputColumn = document.createElement('div');
      outputColumn.className = 'node-output-column';
      
      for (const output of node.outputs) {
        const outputRow = document.createElement('div');
        outputRow.className = 'node-output-row';
        outputRow.appendChild(this.createSocket(output, node));
        outputColumn.appendChild(outputRow);
      }
      
      columnsContainer.appendChild(inputColumn);
      columnsContainer.appendChild(outputColumn);
      content.appendChild(columnsContainer);
    }

    nodeEl.appendChild(content);

    // Selection handling
    nodeEl.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.socket')) {
        if (!e.shiftKey) {
          this.state.selectedNodes.clear();
        }
        this.state.selectedNodes.add(node.id);
        this.updateSelectionDisplay();
      }
    });

    this.nodeContainer.appendChild(nodeEl);
  }

  private createSocket(socket: Socket, node: Node): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'socket-wrapper';
    
    const socketEl = document.createElement('div');
    socketEl.className = `socket socket-${socket.direction}`;
    socketEl.dataset.socketId = socket.id;
    socketEl.dataset.nodeId = node.id;
    socketEl.dataset.type = socket.type;
    socketEl.title = `${socket.name} (${socket.type})`;

    if (this.isSocketConnected(socket.id)) {
      socketEl.classList.add('connected');
    }

    socketEl.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      
      // If clicking on an input socket that already has a connection, disconnect it
      if (socket.direction === 'input' && this.isSocketConnected(socket.id)) {
        this.disconnectSocket(socket.id);
        // Prevent starting a new connection drag
        return;
      }
      
      this.startConnectionDrag(socket);
    });

    socketEl.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      // Only create connection if we're actually connecting (not just disconnecting)
      if (this.connectionDrag.isConnecting && this.connectionDrag.fromSocket) {
        // Don't create connection if clicking on the same socket we started from
        if (this.connectionDrag.fromSocket.id !== socket.id) {
          this.createConnection(this.connectionDrag.fromSocket, socket);
        }
        this.connectionDrag.isConnecting = false;
        this.removeConnectionPreview();
      }
    });

    const label = document.createElement('span');
    label.className = 'socket-label';
    label.textContent = socket.name;

    if (socket.direction === 'input') {
      wrapper.appendChild(socketEl);
      wrapper.appendChild(label);
    } else {
      wrapper.appendChild(label);
      wrapper.appendChild(socketEl);
    }

    return wrapper;
  }

  private createInputField(socket: Socket, node: Node): HTMLElement {
    // Special handling for color type - show color picker
    if (socket.type === 'color') {
      return this.createColorInput(socket, node);
    }
    
    const input = document.createElement('input');
    input.className = 'node-input-field';
    input.type = 'number';
    input.step = '0.1';
    
    const value = node.values[socket.name];
    if (Array.isArray(value)) {
      input.value = String(value[0] ?? 0);
    } else {
      input.value = String(value ?? 0);
    }

    input.addEventListener('change', () => {
      const newValue = parseFloat(input.value) || 0;
      if (Array.isArray(node.values[socket.name])) {
        (node.values[socket.name] as number[])[0] = newValue;
      } else {
        node.values[socket.name] = newValue;
      }
      this.triggerShaderUpdate();
    });

    input.addEventListener('mousedown', (e) => e.stopPropagation());

    return input;
  }

  private createColorInput(socket: Socket, node: Node): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'node-color-input-wrapper';
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'node-color-picker';
    
    // Get current color value
    const value = node.values[socket.name];
    let r = 0, g = 0, b = 0;
    if (Array.isArray(value)) {
      r = Math.round(Math.max(0, Math.min(1, value[0] ?? 0)) * 255);
      g = Math.round(Math.max(0, Math.min(1, value[1] ?? 0)) * 255);
      b = Math.round(Math.max(0, Math.min(1, value[2] ?? 0)) * 255);
    }
    colorInput.value = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    
    colorInput.addEventListener('input', () => {
      const hex = colorInput.value;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      node.values[socket.name] = [r, g, b];
      this.triggerShaderUpdate();
    });

    colorInput.addEventListener('mousedown', (e) => e.stopPropagation());
    colorInput.addEventListener('click', (e) => e.stopPropagation());

    wrapper.appendChild(colorInput);
    return wrapper;
  }

  private createNodeColorPicker(node: Node): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'node-color-picker-wrapper';
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'node-large-color-picker';
    
    // Initialize color value if not set
    if (!node.values['_color']) {
      node.values['_color'] = [1, 1, 1];
    }
    
    const value = node.values['_color'] as number[];
    const r = Math.round(Math.max(0, Math.min(1, value[0])) * 255);
    const g = Math.round(Math.max(0, Math.min(1, value[1])) * 255);
    const b = Math.round(Math.max(0, Math.min(1, value[2])) * 255);
    colorInput.value = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    
    colorInput.addEventListener('input', () => {
      const hex = colorInput.value;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      node.values['_color'] = [r, g, b];
      this.triggerShaderUpdate();
    });

    colorInput.addEventListener('mousedown', (e) => e.stopPropagation());
    colorInput.addEventListener('click', (e) => e.stopPropagation());

    wrapper.appendChild(colorInput);
    return wrapper;
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

  private updateNodePosition(node: Node): void {
    const nodeEl = this.nodeContainer.querySelector(`[data-node-id="${node.id}"]`) as HTMLElement;
    if (nodeEl) {
      nodeEl.style.left = `${node.x}px`;
      nodeEl.style.top = `${node.y}px`;
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
    // Validate connection
    if (from.direction === to.direction) return;
    if (from.nodeId === to.nodeId) return;
    
    // Ensure from is output, to is input
    let outputSocket = from;
    let inputSocket = to;
    if (from.direction === 'input') {
      outputSocket = to;
      inputSocket = from;
    }

    // Type compatibility check
    if (!this.areTypesCompatible(outputSocket.type, inputSocket.type)) {
      console.warn(`Incompatible types: ${outputSocket.type} -> ${inputSocket.type}`);
      return;
    }

    // Remove existing connection to this input
    for (const [id, conn] of this.state.connections) {
      if (conn.toSocketId === inputSocket.id) {
        this.state.connections.delete(id);
      }
    }

    const connectionId = `conn_${Date.now()}`;
    const connection: Connection = {
      id: connectionId,
      fromNodeId: outputSocket.nodeId,
      fromSocketId: outputSocket.id,
      toNodeId: inputSocket.nodeId,
      toSocketId: inputSocket.id,
    };

    this.state.connections.set(connectionId, connection);
    this.updateConnections();
    this.updateSocketDisplay(outputSocket.id, true);
    this.updateSocketDisplay(inputSocket.id, true);
    this.updateNodeInputFields(inputSocket.nodeId);
    this.triggerShaderUpdate();
  }

  private areTypesCompatible(from: SocketType, to: SocketType): boolean {
    if (from === to) return true;
    if (from === 'color' && to === 'vec3') return true;
    if (from === 'vec3' && to === 'color') return true;
    return false;
  }

  private isSocketConnected(socketId: string): boolean {
    for (const conn of this.state.connections.values()) {
      if (conn.fromSocketId === socketId || conn.toSocketId === socketId) {
        return true;
      }
    }
    return false;
  }

  private updateSocketDisplay(socketId: string, connected: boolean): void {
    const socketEl = this.nodeContainer.querySelector(`[data-socket-id="${socketId}"]`);
    if (socketEl) {
      socketEl.classList.toggle('connected', connected);
    }
  }

  private updateNodeInputFields(nodeId: string): void {
    const node = this.state.nodes.get(nodeId);
    if (!node) return;

    const nodeEl = this.nodeContainer.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeEl) return;

    // Find all input rows and update their input fields
    const inputRows = nodeEl.querySelectorAll('.node-input-row');
    inputRows.forEach((row, index) => {
      const input = node.inputs[index];
      if (!input) return;

      const rightSide = row.querySelector('.node-input-right-side');
      if (!rightSide) return;

      // Remove existing input field
      const existingInput = rightSide.querySelector('.node-input-field, .node-color-input-wrapper');
      if (existingInput) {
        existingInput.remove();
      }

      // Add input field if not connected
      if (!this.isSocketConnected(input.id)) {
        if (input.type === 'color') {
          rightSide.appendChild(this.createColorInput(input, node));
        } else {
          rightSide.appendChild(this.createInputField(input, node));
        }
      }
    });
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

  private updateConnections(): void {
    // Clear existing paths
    while (this.svgContainer.firstChild) {
      this.svgContainer.removeChild(this.svgContainer.firstChild);
    }

    for (const connection of this.state.connections.values()) {
      this.renderConnection(connection);
    }
    
    this.updateConnectionSelection();
  }
  
  private updateConnectionSelection(): void {
    const paths = this.svgContainer.querySelectorAll('.connection');
    paths.forEach((path) => {
      const connectionId = path.getAttribute('data-connection-id');
      path.classList.toggle('selected', connectionId === this.selectedConnectionId);
    });
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
    
    this.state.connections.delete(connectionId);
    this.updateConnections();
    this.updateSocketDisplay(connection.fromSocketId, this.isSocketConnected(connection.fromSocketId));
    this.updateSocketDisplay(connection.toSocketId, this.isSocketConnected(connection.toSocketId));
    
    // Update input fields for the node that had the input connection
    const toNode = this.state.nodes.get(connection.toNodeId);
    if (toNode) {
      this.updateNodeInputFields(toNode.id);
    }
    
    this.triggerShaderUpdate();
    
    if (this.selectedConnectionId === connectionId) {
      this.selectedConnectionId = null;
    }
  }

  private renderConnection(connection: Connection): void {
    const fromEl = this.nodeContainer.querySelector(
      `[data-socket-id="${connection.fromSocketId}"]`
    );
    const toEl = this.nodeContainer.querySelector(
      `[data-socket-id="${connection.toSocketId}"]`
    );

    if (!fromEl || !toEl) return;

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const svgRect = this.svgContainer.getBoundingClientRect();

    // Convert screen coordinates to SVG local coordinates
    // Both nodeContainer and svgContainer have the same transform, so we can use their relative positions
    const x1 = (fromRect.left + fromRect.width / 2 - svgRect.left) / this.state.zoom;
    const y1 = (fromRect.top + fromRect.height / 2 - svgRect.top) / this.state.zoom;
    const x2 = (toRect.left + toRect.width / 2 - svgRect.left) / this.state.zoom;
    const y2 = (toRect.top + toRect.height / 2 - svgRect.top) / this.state.zoom;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const dx = Math.abs(x2 - x1) * 0.5;
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
    path.classList.add('connection');
    path.setAttribute('data-connection-id', connection.id);
    
    // Color based on socket type
    const fromNode = this.state.nodes.get(connection.fromNodeId);
    const fromSocket = fromNode?.outputs.find(s => s.id === connection.fromSocketId);
    const color = this.getSocketColor(fromSocket?.type || 'float');
    path.style.stroke = color;
    
    // Allow selection and deletion
    path.style.pointerEvents = 'stroke';
    path.style.cursor = 'pointer';
    
    // Click to select
    path.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectedConnectionId = connection.id;
      this.updateConnectionSelection();
    });
    
    // Double-click to delete
    path.addEventListener('dblclick', () => {
      this.deleteConnection(connection.id);
    });
    
    // Right-click to delete
    path.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.deleteConnection(connection.id);
    });

    this.svgContainer.appendChild(path);
  }

  private getSocketColor(type: SocketType): string {
    const colors: Record<SocketType, string> = {
      'float': '#a1a1a1',
      'vec2': '#63c7ff',
      'vec3': '#6363ff',
      'vec4': '#cc63ff',
      'color': '#ffcc00',
      'sampler': '#ff6b6b',
      'texture2d': '#4ecdc4',
    };
    return colors[type] || '#888888';
  }

  private updateConnectionPreview(): void {
    this.removeConnectionPreview();

    if (!this.connectionDrag.fromSocket) return;

    const fromEl = this.nodeContainer.querySelector(
      `[data-socket-id="${this.connectionDrag.fromSocket.id}"]`
    );
    if (!fromEl) return;

    const fromRect = fromEl.getBoundingClientRect();
    const svgRect = this.svgContainer.getBoundingClientRect();

    // Convert screen coordinates to SVG local coordinates
    const x1 = (fromRect.left + fromRect.width / 2 - svgRect.left) / this.state.zoom;
    const y1 = (fromRect.top + fromRect.height / 2 - svgRect.top) / this.state.zoom;
    const x2 = this.connectionDrag.currentX;
    const y2 = this.connectionDrag.currentY;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const dx = Math.abs(x2 - x1) * 0.5;
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
    path.classList.add('connection', 'connection-preview');
    path.style.stroke = this.getSocketColor(this.connectionDrag.fromSocket.type);

    this.svgContainer.appendChild(path);
  }

  private removeConnectionPreview(): void {
    const preview = this.svgContainer.querySelector('.connection-preview');
    if (preview) {
      preview.remove();
    }
    this.container.classList.remove('connecting');
  }

  private updateSelectionDisplay(): void {
    const nodes = this.nodeContainer.querySelectorAll('.node');
    nodes.forEach(nodeEl => {
      const nodeId = (nodeEl as HTMLElement).dataset.nodeId;
      if (nodeId) {
        nodeEl.classList.toggle('selected', this.state.selectedNodes.has(nodeId));
      }
    });
  }

  private deleteSelectedNodes(): void {
    for (const nodeId of this.state.selectedNodes) {
      // Don't delete output node
      const node = this.state.nodes.get(nodeId);
      if (node?.definitionId === 'output_color') continue;

      // Remove related connections
      for (const [connId, conn] of this.state.connections) {
        if (conn.fromNodeId === nodeId || conn.toNodeId === nodeId) {
          this.state.connections.delete(connId);
        }
      }

      // Remove node
      this.state.nodes.delete(nodeId);
      const nodeEl = this.nodeContainer.querySelector(`[data-node-id="${nodeId}"]`);
      if (nodeEl) nodeEl.remove();
    }

    this.state.selectedNodes.clear();
    this.updateConnections();
    this.triggerShaderUpdate();
  }

  private triggerShaderUpdate(): void {
    const code = WGSLGenerator.generate(this.state.nodes, this.state.connections);
    this.onShaderUpdate?.(code);
  }

  private createDefaultNodes(): void {
    // Create UV input node
    const uvNode = this.addNode('input_uv', 50, 100);
    
    // Create time node
    this.addNode('input_time', 50, 250);
    
    // Create output node
    const outputNode = this.addNode('output_color', 500, 150);

    // Simple default connection: UV.x -> Output color (as grayscale)
    if (uvNode && outputNode) {
      // We'll let users make their own connections
    }
  }

  getState(): EditorState {
    return this.state;
  }

  generateShader(): string {
    return WGSLGenerator.generate(this.state.nodes, this.state.connections);
  }
}

