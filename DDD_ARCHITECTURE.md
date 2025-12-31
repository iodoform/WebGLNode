# DDDアーキテクチャ設計書

このプロジェクトはDDD（Domain-Driven Design）の原則に基づいて設計されています。

## ディレクトリ構造

```
src/
├── domain/                    # ドメイン層（ビジネスロジック）
│   ├── entities/              # エンティティ
│   │   ├── Node.ts           # ノードエンティティ
│   │   ├── Socket.ts         # ソケットエンティティ
│   │   ├── Connection.ts     # 接続エンティティ
│   │   └── NodeGraph.ts      # ノードグラフエンティティ
│   ├── value-objects/         # 値オブジェクト
│   │   ├── SocketType.ts     # ソケット型
│   │   ├── Position.ts       # 位置情報
│   │   └── Id.ts             # ID（NodeId, SocketId, ConnectionId）
│   ├── repositories/          # リポジトリインターフェース
│   │   ├── INodeRepository.ts
│   │   └── IConnectionRepository.ts
│   ├── services/              # ドメインサービス
│   │   └── NodeFactory.ts    # ノードファクトリ
│   └── index.ts               # ドメイン層のエクスポート
│
├── application/               # アプリケーション層（ユースケース）
│   ├── use-cases/             # ユースケース
│   │   ├── AddNodeUseCase.ts
│   │   ├── CreateConnectionUseCase.ts
│   │   ├── DeleteNodeUseCase.ts
│   │   └── DeleteConnectionUseCase.ts
│   ├── services/              # アプリケーションサービス
│   │   └── NodeEditorService.ts
│   └── index.ts               # アプリケーション層のエクスポート
│
├── infrastructure/            # インフラストラクチャ層（実装詳細）
│   ├── repositories/          # リポジトリ実装
│   │   ├── InMemoryNodeRepository.ts
│   │   └── InMemoryConnectionRepository.ts
│   ├── rendering/            # レンダリング（UI実装）
│   │   ├── webgl/           # WebGL実装
│   │   │   └── WebGLRenderer.ts
│   │   ├── webgpu/          # WebGPU実装
│   │   │   └── WebGPURenderer.ts
│   │   ├── IRenderer.ts      # レンダラーインターフェース
│   │   ├── RendererCapability.ts # レンダラー機能定義
│   │   ├── InputFieldRenderer.ts
│   │   ├── NodeRenderer.ts
│   │   ├── ConnectionRenderer.ts
│   │   └── MenuManager.ts
│   ├── shader/               # シェーダー生成
│   │   ├── IShaderGenerator.ts # シェーダー生成インターフェース
│   │   ├── WGSLGenerator.ts  # WGSLシェーダー生成
│   │   └── GLSLGenerator.ts  # GLSLシェーダー生成
│   ├── node-definitions/     # ノード定義
│   │   ├── loader/          # ノード定義ローダー
│   │   │   └── NodeDefinitionLoader.ts
│   │   ├── color.json       # ノード定義ファイル（JSON）
│   │   ├── input.json
│   │   ├── math.json
│   │   ├── output.json
│   │   ├── pattern.json
│   │   └── vector.json
│   ├── types/               # 型定義（設定データ）
│   │   └── index.ts         # NodeDefinition, SocketDefinition等
│   └── index.ts              # インフラストラクチャ層のエクスポート
│
├── editor/                    # プレゼンテーション層（UI調整）
│   ├── NodeEditor.ts          # メインエディタークラス
│   └── types.ts               # エディター状態管理の型定義
│
├── styles/                    # スタイルシート
│   └── main.css
│
└── main.ts                    # エントリーポイント
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
- **レンダリング**: DOM操作とUI描画、WebGL/WebGPU実装
- **シェーダー生成**: WGSL/GLSLシェーダーコードの生成
- **ノード定義**: ノード定義ファイル（JSON）の読み込みと管理
- **型定義**: 設定データの型定義（NodeDefinition, SocketDefinition等）

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
3. **不変性**: 値オブジェクトは不変です．エンティティはライフサイクルを持ち可変ですが，識別子(ID)については不変です
4. **ドメインロジックの分離**: ビジネスロジックはUIや技術的詳細から分離されています

## 主要なコンポーネント

### ドメインエンティティ

- **Node**: ノードグラフ内のノードを表すエンティティ。位置、定義ID、入力/出力ソケット、値を持つ
- **Socket**: ノードの入力または出力ソケットを表すエンティティ
- **Connection**: 2つのソケット間の接続を表すエンティティ

### 値オブジェクト

- **Position**: ノードの位置（x, y座標）を表す不変オブジェクト
- **SocketType**: ソケットの型（float, vec2, vec3, vec4, color等）を表す値オブジェクト
- **Id**: NodeId, SocketId, ConnectionIdの基底となる値オブジェクト

### リポジトリ

- **INodeRepository**: ノードの永続化と取得のインターフェース
- **IConnectionRepository**: 接続の永続化と取得のインターフェース
- **InMemoryNodeRepository**: インメモリ実装
- **InMemoryConnectionRepository**: インメモリ実装

### ドメインサービス

- **NodeFactory**: ノードの作成とクローンを行うドメインサービス

### ユースケース

- **AddNodeUseCase**: ノードを追加するユースケース
- **CreateConnectionUseCase**: 接続を作成するユースケース
- **DeleteNodeUseCase**: ノードを削除するユースケース
- **DeleteConnectionUseCase**: 接続を削除するユースケース

### アプリケーションサービス

- **NodeEditorService**: ノードエディターの主要操作を統合的に管理するサービス

### レンダラー

- **InputFieldRenderer**: 入力フィールド（数値、ベクトル、カラー）のレンダリング
- **NodeRenderer**: ノードのDOM要素の作成と更新
- **ConnectionRenderer**: 接続線のSVG描画
- **MenuManager**: ノード追加メニューの管理

### シェーダー生成

- **WGSLGenerator**: ドメインエンティティからWGSLシェーダーコードを生成

## データフロー

1. **ノード追加**: `NodeEditor` → `NodeEditorService` → `AddNodeUseCase` → `NodeFactory` → `INodeRepository`
2. **接続作成**: `NodeEditor` → `NodeEditorService` → `CreateConnectionUseCase` → `IConnectionRepository`
3. **シェーダー生成**: `NodeEditor` → `WGSLGenerator`（リポジトリからエンティティを取得）
4. **UI更新**: `NodeEditor` → `NodeRenderer` / `ConnectionRenderer`（ドメインエンティティを直接使用）

