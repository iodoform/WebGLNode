# DDDアーキテクチャ設計書

このプロジェクトはDDD（Domain-Driven Design）の原則に基づいて設計されています。

## ディレクトリ構造

```
src/
├── domain/                    # ドメイン層（ビジネスロジック）
│   ├── entities/              # エンティティ
│   │   ├── Node.ts           # ノードエンティティ
│   │   ├── Socket.ts         # ソケットエンティティ
│   │   └── Connection.ts     # 接続エンティティ
│   ├── value-objects/         # 値オブジェクト
│   │   ├── SocketType.ts     # ソケット型
│   │   ├── Position.ts       # 位置情報
│   │   └── Id.ts             # ID（NodeId, SocketId, ConnectionId）
│   ├── repositories/          # リポジトリインターフェース
│   │   ├── INodeRepository.ts
│   │   └── IConnectionRepository.ts
│   └── services/              # ドメインサービス
│       └── NodeFactory.ts    # ノードファクトリ
│
├── application/               # アプリケーション層（ユースケース）
│   ├── use-cases/             # ユースケース
│   │   ├── AddNodeUseCase.ts
│   │   ├── CreateConnectionUseCase.ts
│   │   ├── DeleteNodeUseCase.ts
│   │   └── DeleteConnectionUseCase.ts
│   └── services/              # アプリケーションサービス
│       └── NodeEditorService.ts
│
├── infrastructure/            # インフラストラクチャ層（実装詳細）
│   ├── repositories/          # リポジトリ実装
│   │   ├── InMemoryNodeRepository.ts
│   │   └── InMemoryConnectionRepository.ts
│   └── rendering/            # レンダリング（UI実装）
│       ├── InputFieldRenderer.ts
│       ├── NodeRenderer.ts
│       ├── ConnectionRenderer.ts
│       └── MenuManager.ts
│
└── editor/                    # プレゼンテーション層（UI調整）
    └── NodeEditor.ts          # メインエディタークラス
```

## レイヤーの責務

### ドメイン層（domain/）

ビジネスロジックの中核を担います。

- **エンティティ**: 識別子を持つオブジェクト（Node, Socket, Connection）
- **値オブジェクト**: 不変の値（Position, SocketType, ID）
- **リポジトリインターフェース**: データ永続化の抽象化
- **ドメインサービス**: エンティティに属さないビジネスロジック（NodeFactory）

### アプリケーション層（application/）

ユースケースを実装します。

- **ユースケース**: 特定のビジネス操作（ノード追加、接続作成など）
- **アプリケーションサービス**: 複数のユースケースを統合

### インフラストラクチャ層（infrastructure/）

技術的な実装詳細を担当します。

- **リポジトリ実装**: データ永続化の実装（現在はインメモリ）
- **レンダリング**: DOM操作とUI描画

### プレゼンテーション層（editor/）

UIの調整とイベント処理を担当します。

- **NodeEditor**: エディター全体の調整と状態管理

## 依存関係の方向

```
プレゼンテーション層
    ↓
アプリケーション層
    ↓
ドメイン層
    ↑
インフラストラクチャ層
```

- 各層は下位層にのみ依存します
- ドメイン層は他の層に依存しません（純粋なビジネスロジック）
- インフラストラクチャ層はドメイン層のインターフェースを実装します

## 主な設計原則

1. **単一責任の原則**: 各クラスは1つの責務のみを持ちます
2. **依存性逆転の原則**: 抽象（インターフェース）に依存し、具象に依存しません
3. **不変性**: 値オブジェクトとエンティティの重要な属性は不変です
4. **ドメインロジックの分離**: ビジネスロジックはUIや技術的詳細から分離されています

## 移行計画

### 完了した移行

1. ✅ **レンダラーの移動**: `src/editor/`のレンダラークラスを`src/infrastructure/rendering/`に移動
   - `InputFieldRenderer`
   - `NodeRenderer`
   - `ConnectionRenderer`
   - `MenuManager`

2. ✅ **アダプター層の作成**: 古い型と新しいドメインエンティティの変換を行うアダプターを追加
   - `NodeAdapter`: ノードとソケットの変換
   - `ConnectionAdapter`: 接続の変換

3. ✅ **NodeEditorの移行**: `NodeEditor`を新しいDDD構造（`NodeEditorService`、リポジトリ）を使用するように変更
   - ノードの追加・削除・移動をドメインサービス経由で実行
   - 接続の作成・削除をドメインサービス経由で実行

### 残りの作業

1. ⏳ **WGSLGeneratorの移行**: `WGSLGenerator`を新しいドメインエンティティに対応させる
   - 現在はレガシー型を使用しているため、アダプター経由で変換が必要

2. ⏳ **古いコードの削除**: 完全に移行が完了したら、以下のファイルを削除
   - `src/nodes/NodeFactory.ts`（古い実装）
   - `src/types/index.ts`（完全に置き換え可能になった場合）

### 現在の状態

- 新しいDDD構造が主要な操作で使用されている
- レガシー型（`src/types/index.ts`）はレンダリングとWGSL生成でまだ使用されている
- アダプター層により、両方の構造が共存可能

