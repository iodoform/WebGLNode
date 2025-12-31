/**
 * メニューマネージャーのインターフェース
 */
export interface IMenuManager {
  showAddNodeMenu(x: number, y: number): void;
  closeAddNodeMenu(): void;
  containsElement(element: HTMLElement): boolean;
}

