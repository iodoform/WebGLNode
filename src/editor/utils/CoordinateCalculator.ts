/**
 * 座標計算ユーティリティクラス
 * 
 * タッチイベントやマウスイベントの座標計算を担当します。
 */
export class CoordinateCalculator {
  /**
   * 2つのタッチ間の距離を計算
   */
  static getTouchDistance(touches: TouchList): number {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * タッチの中心点を計算
   */
  static getTouchCenter(touches: TouchList): { x: number; y: number } {
    if (touches.length < 2) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  /**
   * ズーム時のパン調整を計算
   */
  static calculatePanForZoom(
    mouseX: number,
    mouseY: number,
    currentPanX: number,
    currentPanY: number,
    currentZoom: number,
    newZoom: number
  ): { x: number; y: number } {
    const newPanX = mouseX - (mouseX - currentPanX) * (newZoom / currentZoom);
    const newPanY = mouseY - (mouseY - currentPanY) * (newZoom / currentZoom);
    return { x: newPanX, y: newPanY };
  }

  /**
   * ピンチズーム時のパン調整を計算
   */
  static calculatePanForPinchZoom(
    centerX: number,
    centerY: number,
    currentPanX: number,
    currentPanY: number,
    currentZoom: number,
    newZoom: number
  ): { x: number; y: number } {
    const newPanX = centerX - (centerX - currentPanX) * (newZoom / currentZoom);
    const newPanY = centerY - (centerY - currentPanY) * (newZoom / currentZoom);
    return { x: newPanX, y: newPanY };
  }

  /**
   * ドラッグ時の新しい座標を計算（ズーム考慮）
   */
  static calculateDragPosition(
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
    offsetX: number,
    offsetY: number,
    zoom: number
  ): { x: number; y: number } {
    const dx = (currentX - startX) / zoom;
    const dy = (currentY - startY) / zoom;
    return {
      x: offsetX + dx,
      y: offsetY + dy,
    };
  }

  /**
   * パン時の新しい座標を計算
   */
  static calculatePanPosition(
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
    offsetX: number,
    offsetY: number
  ): { x: number; y: number } {
    const dx = currentX - startX;
    const dy = currentY - startY;
    return {
      x: offsetX + dx,
      y: offsetY + dy,
    };
  }

  /**
   * スクリーン座標をローカル座標に変換（ズーム考慮）
   */
  static screenToLocal(
    screenX: number,
    screenY: number,
    containerRect: DOMRect,
    zoom: number
  ): { x: number; y: number } {
    return {
      x: (screenX - containerRect.left) / zoom,
      y: (screenY - containerRect.top) / zoom,
    };
  }
}

