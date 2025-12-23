import { NodeId } from '../value-objects/Id';
import { Position } from '../value-objects/Position';
import { Socket } from './Socket';

/**
 * ノードエンティティ
 * 
 * シェーダーノードエディターの基本単位。ノード定義に基づいて作成され、
 * 位置情報と入力値を持ちます。
 */
export class Node {
  constructor(
    public readonly id: NodeId,
    public readonly definitionId: string,
    public readonly position: Position,
    public readonly inputs: Socket[],
    public readonly outputs: Socket[],
    private _values: Record<string, number | number[]>
  ) {
    if (!definitionId || definitionId.trim() === '') {
      throw new Error('Node definitionId cannot be empty');
    }
  }

  /**
   * ノードの値を取得
   */
  getValue(name: string): number | number[] | undefined {
    return this._values[name];
  }

  /**
   * ノードの値を設定
   */
  setValue(name: string, value: number | number[]): void {
    this._values[name] = value;
  }

  /**
   * すべての値を取得（クローン用）
   */
  getAllValues(): Record<string, number | number[]> {
    return { ...this._values };
  }

  /**
   * ノードの位置を更新（新しいインスタンスを返す）
   */
  moveTo(position: Position): Node {
    return new Node(
      this.id,
      this.definitionId,
      position,
      this.inputs,
      this.outputs,
      { ...this._values }
    );
  }

  /**
   * 指定されたIDのソケットを取得
   */
  getSocket(socketId: string): Socket | undefined {
    return [...this.inputs, ...this.outputs].find(s => s.id.value === socketId);
  }

  /**
   * 入力ソケットを取得
   */
  getInputSocket(name: string): Socket | undefined {
    return this.inputs.find(s => s.name === name);
  }

  /**
   * 出力ソケットを取得
   */
  getOutputSocket(name: string): Socket | undefined {
    return this.outputs.find(s => s.name === name);
  }

  equals(other: Node): boolean {
    return this.id.equals(other.id);
  }
}

