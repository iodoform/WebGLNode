/**
 * ドメイン層のエクスポート
 * 
 * DDD（Domain-Driven Design）のドメイン層を構成する
 * エンティティ、値オブジェクト、リポジトリインターフェース、ドメインサービスをエクスポートします。
 */

// 値オブジェクト
export * from './value-objects/SocketType';
export * from './value-objects/Position';
export * from './value-objects/Id';

// エンティティ
export * from './entities/Node';
export * from './entities/Socket';
export * from './entities/Connection';

// リポジトリインターフェース
export * from './repositories/INodeRepository';
export * from './repositories/IConnectionRepository';

// ドメインサービス
export * from './services/NodeFactory';

