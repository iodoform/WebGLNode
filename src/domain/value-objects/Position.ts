/**
 * 2D座標を表す値オブジェクト
 */
export class Position {
  constructor(
    public readonly x: number,
    public readonly y: number
  ) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('Position coordinates must be finite numbers');
    }
  }

  /**
   * 新しい位置を返す（不変性を保つ）
   */
  move(dx: number, dy: number): Position {
    return new Position(this.x + dx, this.y + dy);
  }

  /**
   * 別の位置との距離を計算
   */
  distanceTo(other: Position): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  equals(other: Position): boolean {
    return this.x === other.x && this.y === other.y;
  }
}

