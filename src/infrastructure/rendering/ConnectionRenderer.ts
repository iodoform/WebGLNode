import type { Connection, Node, SocketType } from '../../types';

/**
 * 接続線のレンダリングを担当するクラス
 * 
 * ノード間の接続をSVGパスとして描画し、接続の選択状態やプレビュー表示を管理します。
 * 接続のクリックや削除などの操作も処理します。
 */
export class ConnectionRenderer {
  constructor(
    private svgContainer: SVGSVGElement,
    private nodeContainer: HTMLElement,
    private nodes: Map<string, Node>,
    private getZoom: () => number,
    private onConnectionClick: (connectionId: string) => void,
    private onConnectionDelete: (connectionId: string) => void
  ) {}

  renderConnection(connection: Connection): void {
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
    const zoom = this.getZoom();
    const x1 = (fromRect.left + fromRect.width / 2 - svgRect.left) / zoom;
    const y1 = (fromRect.top + fromRect.height / 2 - svgRect.top) / zoom;
    const x2 = (toRect.left + toRect.width / 2 - svgRect.left) / zoom;
    const y2 = (toRect.top + toRect.height / 2 - svgRect.top) / zoom;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const dx = Math.abs(x2 - x1) * 0.5;
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
    path.classList.add('connection');
    path.setAttribute('data-connection-id', connection.id);
    
    // Color based on socket type
    const fromNode = this.nodes.get(connection.fromNodeId);
    const fromSocket = fromNode?.outputs.find(s => s.id === connection.fromSocketId);
    const color = this.getSocketColor(fromSocket?.type || 'float');
    path.style.stroke = color;
    
    // Allow selection and deletion
    path.style.pointerEvents = 'stroke';
    path.style.cursor = 'pointer';
    
    // Click to select
    path.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onConnectionClick(connection.id);
    });
    
    // Double-click to delete
    path.addEventListener('dblclick', () => {
      this.onConnectionDelete(connection.id);
    });
    
    // Right-click to delete
    path.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onConnectionDelete(connection.id);
    });

    this.svgContainer.appendChild(path);
  }

  updateConnections(connections: Map<string, Connection>): void {
    // Clear existing paths
    while (this.svgContainer.firstChild) {
      this.svgContainer.removeChild(this.svgContainer.firstChild);
    }

    for (const connection of connections.values()) {
      this.renderConnection(connection);
    }
  }

  updateConnectionPreview(
    fromSocketId: string,
    currentX: number,
    currentY: number
  ): void {
    this.removeConnectionPreview();

    const fromEl = this.nodeContainer.querySelector(
      `[data-socket-id="${fromSocketId}"]`
    );
    if (!fromEl) return;

    const fromRect = fromEl.getBoundingClientRect();
    const svgRect = this.svgContainer.getBoundingClientRect();

    // Convert screen coordinates to SVG local coordinates
    const zoom = this.getZoom();
    const x1 = (fromRect.left + fromRect.width / 2 - svgRect.left) / zoom;
    const y1 = (fromRect.top + fromRect.height / 2 - svgRect.top) / zoom;
    const x2 = currentX;
    const y2 = currentY;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const dx = Math.abs(x2 - x1) * 0.5;
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
    path.classList.add('connection', 'connection-preview');
    
    const fromNode = Array.from(this.nodes.values()).find(n => 
      n.outputs.some(s => s.id === fromSocketId) || n.inputs.some(s => s.id === fromSocketId)
    );
    const fromSocket = fromNode?.outputs.find(s => s.id === fromSocketId) || 
                       fromNode?.inputs.find(s => s.id === fromSocketId);
    path.style.stroke = this.getSocketColor(fromSocket?.type || 'float');

    this.svgContainer.appendChild(path);
  }

  removeConnectionPreview(): void {
    const preview = this.svgContainer.querySelector('.connection-preview');
    if (preview) {
      preview.remove();
    }
  }

  updateConnectionSelection(selectedConnectionId: string | null): void {
    const paths = this.svgContainer.querySelectorAll('.connection');
    paths.forEach((path) => {
      const connectionId = path.getAttribute('data-connection-id');
      path.classList.toggle('selected', connectionId === selectedConnectionId);
    });
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
}

