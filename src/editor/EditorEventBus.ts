/**
 * エディターイベントのタイプ
 */
export enum EditorEventType {
  NODE_ADDED = 'node_added',
  NODE_MOVED = 'node_moved',
  NODE_DELETED = 'node_deleted',
  NODE_SELECTED = 'node_selected',
  CONNECTION_CREATED = 'connection_created',
  CONNECTION_DELETED = 'connection_deleted',
  CONNECTION_SELECTED = 'connection_selected',
  NODE_VALUE_CHANGED = 'node_value_changed',
  SHADER_UPDATE_NEEDED = 'shader_update_needed',
  TRANSFORM_CHANGED = 'transform_changed',
}

/**
 * イベントデータの型定義
 */
export interface EditorEventData {
  [EditorEventType.NODE_ADDED]: { nodeId: string };
  [EditorEventType.NODE_MOVED]: { nodeId: string; x: number; y: number };
  [EditorEventType.NODE_DELETED]: { nodeId: string };
  [EditorEventType.NODE_SELECTED]: { nodeIds: Set<string> };
  [EditorEventType.CONNECTION_CREATED]: { connectionId: string };
  [EditorEventType.CONNECTION_DELETED]: { connectionId: string };
  [EditorEventType.CONNECTION_SELECTED]: { connectionId: string | null };
  [EditorEventType.NODE_VALUE_CHANGED]: { nodeId: string; name: string; value: any };
  [EditorEventType.SHADER_UPDATE_NEEDED]: {};
  [EditorEventType.TRANSFORM_CHANGED]: { pan: { x: number; y: number }; zoom: number };
}

/**
 * イベントリスナーの型定義
 */
export type EventListener<T extends EditorEventType> = (data: EditorEventData[T]) => void;

/**
 * エディターイベントバス
 * 
 * Observerパターンを実装し、イベントの発行と購読を管理します。
 */
export class EditorEventBus {
  private listeners: Map<EditorEventType, Array<EventListener<any>>> = new Map();

  /**
   * イベントを購読
   */
  subscribe<T extends EditorEventType>(
    eventType: T,
    listener: EventListener<T>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    const listeners = this.listeners.get(eventType)!;
    listeners.push(listener);

    // 購読解除関数を返す
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * イベントを発行
   */
  emit<T extends EditorEventType>(
    eventType: T,
    data: EditorEventData[T]
  ): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  /**
   * すべてのリスナーをクリア
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * 特定のイベントタイプのリスナーをクリア
   */
  clearEvent(eventType: EditorEventType): void {
    this.listeners.delete(eventType);
  }
}

