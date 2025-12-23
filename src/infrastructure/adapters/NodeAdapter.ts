import { Node } from '../../domain/entities/Node';
import { Socket } from '../../domain/entities/Socket';
import { Position } from '../../domain/value-objects/Position';
import { NodeId } from '../../domain/value-objects/Id';
import { SocketId } from '../../domain/value-objects/Id';
import type { Node as LegacyNode, Socket as LegacySocket } from '../../types';

/**
 * ノードアダプター
 * 
 * 古い型（src/types/index.ts）と新しいドメインエンティティの変換を行います。
 * レガシーコードとの互換性を保つためのアダプター層です。
 */
export class NodeAdapter {
  /**
   * ドメインエンティティからレガシー型に変換
   */
  static toLegacyNode(domainNode: Node): LegacyNode {
    return {
      id: domainNode.id.value,
      definitionId: domainNode.definitionId,
      x: domainNode.position.x,
      y: domainNode.position.y,
      inputs: domainNode.inputs.map(s => this.toLegacySocket(s)),
      outputs: domainNode.outputs.map(s => this.toLegacySocket(s)),
      values: domainNode.getAllValues(),
    };
  }

  /**
   * レガシー型からドメインエンティティに変換
   */
  static toDomainNode(legacyNode: LegacyNode): Node {
    const nodeId = new NodeId(legacyNode.id);
    const position = new Position(legacyNode.x, legacyNode.y);
    
    const inputs = legacyNode.inputs.map(s => this.toDomainSocket(s, nodeId));
    const outputs = legacyNode.outputs.map(s => this.toDomainSocket(s, nodeId));

    return new Node(
      nodeId,
      legacyNode.definitionId,
      position,
      inputs,
      outputs,
      { ...legacyNode.values }
    );
  }

  /**
   * ドメインソケットからレガシー型に変換
   */
  static toLegacySocket(domainSocket: Socket): LegacySocket {
    return {
      id: domainSocket.id.value,
      nodeId: domainSocket.nodeId.value,
      name: domainSocket.name,
      type: domainSocket.type,
      direction: domainSocket.direction,
      value: domainSocket.defaultValue,
    };
  }

  /**
   * レガシー型からドメインソケットに変換
   */
  static toDomainSocket(legacySocket: LegacySocket, nodeId: NodeId): Socket {
    const socketId = new SocketId(legacySocket.id);
    return new Socket(
      socketId,
      nodeId,
      legacySocket.name,
      legacySocket.type,
      legacySocket.direction,
      legacySocket.value
    );
  }
}

