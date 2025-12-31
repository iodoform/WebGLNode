import { Node } from '../../domain/entities/Node';
import { Socket } from '../../domain/entities/Socket';
import { nodeDefinitionLoader } from '../node-definitions/loader/NodeDefinitionLoader';
import { InputFieldRenderer } from './InputFieldRenderer';
import { INodeRenderer } from './INodeRenderer';

/**
 * ノードのDOMレンダリングを担当するクラス
 * 
 * ノードのHTML要素の作成、更新、削除を管理します。ノードのヘッダー、ソケット、入力フィールドなどを
 * 適切に配置し、ノードの選択状態や位置の更新を行います。
 */
export class NodeRenderer implements INodeRenderer {
  constructor(
    private nodeContainer: HTMLElement,
    private inputFieldRenderer: InputFieldRenderer,
    private isSocketConnected: (socketId: string) => boolean,
    private onSocketClick: (socket: Socket, e: MouseEvent) => void,
    private onNodeDragStart: (node: Node, e: MouseEvent) => void,
    private onNodeClick: (node: Node, e: MouseEvent) => void
  ) {}

  renderNode(node: Node): void {
    const definition = nodeDefinitionLoader.getDefinition(node.definitionId);
    if (!definition) return;

    const nodeEl = document.createElement('div');
    nodeEl.className = 'node';
    nodeEl.dataset.nodeId = node.id.value;
    nodeEl.style.left = `${node.position.x}px`;
    nodeEl.style.top = `${node.position.y}px`;

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
    
    header.addEventListener('mousedown', (e) => this.onNodeDragStart(node, e));
    nodeEl.appendChild(header);

    // Content
    const content = document.createElement('div');
    content.className = 'node-content';

    // Special UI for color picker nodes
    if (definition.customUI === 'colorPicker') {
      const colorRow = document.createElement('div');
      colorRow.className = 'node-row node-color-picker-row';
      
      const colorPicker = this.inputFieldRenderer.createNodeColorPicker(node);
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
        if (!this.isSocketConnected(input.id.value)) {
          rightSide.appendChild(this.inputFieldRenderer.createInputField(input, node));
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

    // Drag handling on entire node (except sockets and input fields)
    nodeEl.addEventListener('mousedown', (e) => {
      // Don't start drag if clicking on socket, input field, or color picker
      const target = e.target as HTMLElement;
      if (target.closest('.socket') || 
          target.closest('.node-input-field') || 
          target.closest('.node-vector-input-field') ||
          target.closest('.node-color-picker') ||
          target.closest('.node-large-color-picker')) {
        return;
      }
      this.onNodeDragStart(node, e);
    });

    // Selection handling
    nodeEl.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.socket')) {
        this.onNodeClick(node, e);
      }
    });

    this.nodeContainer.appendChild(nodeEl);
  }

  createSocket(socket: Socket, node: Node): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'socket-wrapper';
    
    const socketEl = document.createElement('div');
    socketEl.className = `socket socket-${socket.direction}`;
    socketEl.dataset.socketId = socket.id.value;
    socketEl.dataset.nodeId = node.id.value;
    socketEl.dataset.type = socket.type;
    socketEl.title = `${socket.name} (${socket.type})`;

    if (this.isSocketConnected(socket.id.value)) {
      socketEl.classList.add('connected');
    }

    socketEl.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.onSocketClick(socket, e);
    });

    socketEl.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      this.onSocketClick(socket, e);
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

  updateNodePosition(node: Node): void {
    const nodeEl = this.nodeContainer.querySelector(`[data-node-id="${node.id.value}"]`) as HTMLElement;
    if (nodeEl) {
      nodeEl.style.left = `${node.position.x}px`;
      nodeEl.style.top = `${node.position.y}px`;
    }
  }

  updateSelectionDisplay(selectedNodes: Set<string>): void {
    const nodes = this.nodeContainer.querySelectorAll('.node');
    nodes.forEach(nodeEl => {
      const nodeId = (nodeEl as HTMLElement).dataset.nodeId;
      if (nodeId) {
        nodeEl.classList.toggle('selected', selectedNodes.has(nodeId));
      }
    });
  }

  updateSocketDisplay(socketId: string, connected: boolean): void {
    const socketEl = this.nodeContainer.querySelector(`[data-socket-id="${socketId}"]`);
    if (socketEl) {
      socketEl.classList.toggle('connected', connected);
    }
  }

  updateNodeInputFields(node: Node): void {
    const nodeEl = this.nodeContainer.querySelector(`[data-node-id="${node.id.value}"]`) as HTMLElement;
    if (!nodeEl) return;
    this.inputFieldRenderer.updateNodeInputFields(node.id.value, node, nodeEl);
  }
}

