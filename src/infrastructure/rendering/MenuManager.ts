import { nodeDefinitionLoader } from '../../nodes/NodeDefinitionLoader';
import type { NodeDefinition } from '../../types';

/**
 * ノード追加メニューの管理を担当するクラス
 * 
 * 右クリックやショートカットキーで表示されるノード追加メニューの表示・非表示を管理し、
 * ノードの検索機能やカテゴリ別の表示を行います。
 */
export class MenuManager {
  private menu: HTMLElement | null = null;

  constructor(
    private container: HTMLElement,
    private onNodeAdd: (definitionId: string, x: number, y: number) => void,
    private getPan: () => { x: number; y: number },
    private getZoom: () => number
  ) {}

  showAddNodeMenu(x: number, y: number): void {
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
    this.menu = menu;
    
    setTimeout(() => searchInput.focus(), 0);
  }

  private updateNodeMenuList(menu: HTMLElement, filter: string, menuX: number, menuY: number): void {
    // Remove existing items (keep search box)
    const items = menu.querySelectorAll('.add-node-category, .add-node-item');
    items.forEach(item => item.remove());

    const definitions = filter 
      ? nodeDefinitionLoader.searchDefinitions(filter)
      : nodeDefinitionLoader.getAllDefinitions();

    const byCategory = new Map<string, NodeDefinition[]>();
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
          const pan = this.getPan();
          const zoom = this.getZoom();
          const x = (menuX - rect.left - pan.x) / zoom;
          const y = (menuY - rect.top - pan.y) / zoom;
          this.onNodeAdd(def.id, x, y);
          this.closeAddNodeMenu();
        });

        menu.appendChild(itemEl);
      }
    }
  }

  closeAddNodeMenu(): void {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
  }

  isMenuOpen(): boolean {
    return this.menu !== null;
  }

  containsElement(element: HTMLElement): boolean {
    return this.menu?.contains(element) ?? false;
  }
}

