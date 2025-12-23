/**
 * エンティティのIDを表す値オブジェクト
 */
export class NodeId {
  constructor(public readonly value: string) {
    if (!value || value.trim() === '') {
      throw new Error('NodeId cannot be empty');
    }
  }

  equals(other: NodeId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * ソケットのIDを表す値オブジェクト
 */
export class SocketId {
  constructor(public readonly value: string) {
    if (!value || value.trim() === '') {
      throw new Error('SocketId cannot be empty');
    }
  }

  equals(other: SocketId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * 接続のIDを表す値オブジェクト
 */
export class ConnectionId {
  constructor(public readonly value: string) {
    if (!value || value.trim() === '') {
      throw new Error('ConnectionId cannot be empty');
    }
  }

  equals(other: ConnectionId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

