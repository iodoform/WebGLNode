import type { SocketType, SocketDirection } from '../value-objects/SocketType';
import { SocketId } from '../value-objects/Id';
import { NodeId } from '../value-objects/Id';

/**
 * ソケットエンティティ
 * 
 * ノードの入力または出力を表します。接続の端点として機能します。
 */
export class Socket {
  constructor(
    public readonly id: SocketId,
    public readonly nodeId: NodeId,
    public readonly name: string,
    public readonly type: SocketType,
    public readonly direction: SocketDirection,
    public readonly defaultValue?: number | number[]
  ) {
    if (!name || name.trim() === '') {
      throw new Error('Socket name cannot be empty');
    }
  }

  /**
   * このソケットが指定されたソケットと接続可能かどうかを判定
   */
  canConnectTo(other: Socket): boolean {
    // 同じノードのソケットには接続できない
    if (this.nodeId.equals(other.nodeId)) {
      return false;
    }

    // 同じ方向のソケットには接続できない
    if (this.direction === other.direction) {
      return false;
    }

    // 型の互換性をチェック
    return this.isTypeCompatible(this.type, other.type);
  }

  /**
   * 型の互換性をチェック
   */
  private isTypeCompatible(from: SocketType, to: SocketType): boolean {
    if (from === to) return true;
    if (from === 'color' && to === 'vec3') return true;
    if (from === 'vec3' && to === 'color') return true;
    return false;
  }

  equals(other: Socket): boolean {
    return this.id.equals(other.id);
  }
}

