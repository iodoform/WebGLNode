# WebGPU Node Shader Editor

ブラウザ上でノードベースのシェーダープログラミングができるWebアプリケーションです。BlenderのシェーダーノードエディターにインスパイアされたUIで、WebGPU/WGSLを使用してリアルタイムレンダリングを行います。

## 特徴

- **WebGPU対応**: 最新のWebGPU APIを使用した高性能レンダリング
- **Blenderライクなノードエディター**: 直感的なドラッグ&ドロップ操作
- **リアルタイムプレビュー**: ノードの変更が即座にプレビューに反映
- **WGSLコード生成**: ノードグラフから自動的にWGSLシェーダーコードを生成
- **拡張可能なノードシステム**: JSONファイルで新しいノードを簡単に追加可能

## 技術スタック

- **Vite** + **TypeScript**: 高速な開発環境
- **WebGPU**: 次世代グラフィックスAPI
- **WGSL**: WebGPU Shading Language

## ノードカテゴリ

### Input
- UV Coordinates - テクスチャ座標
- Time - 経過時間
- Resolution - キャンバス解像度
- Mouse Position - マウス位置
- Value - 定数値
- PI / TAU - 数学定数

### Math
- Add, Subtract, Multiply, Divide
- Sin, Cos, Atan2
- Abs, Floor, Ceil, Fract
- Pow, Sqrt
- Mix, Clamp, Smoothstep, Step
- Modulo

### Vector
- Combine XY/XYZ/XYZW
- Separate XY/XYZ
- Length, Normalize, Dot, Distance
- Reflect
- Vector Math

### Color
- RGB Color
- HSV to RGB
- Mix Colors
- Brightness, Contrast, Gamma
- Invert

### Pattern
- Checker
- Gradient / Radial Gradient
- Circle, Box
- Stripe
- Simple Noise
- Voronoi
- FBM Noise

## 操作方法

- **右クリック**: ノード追加メニューを開く
- **ノードヘッダーをドラッグ**: ノードを移動
- **ソケットをドラッグ**: 接続を作成
- **接続線をダブルクリック**: 接続を削除
- **マウスホイール**: ズーム
- **背景をドラッグ**: パン
- **Delete/Backspace**: 選択したノードを削除
- **Shift+A**: ノード追加メニュー

## 開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build
```

## ノードの追加方法（メタプログラミング）

新しいノードは`src/node-definitions/`にJSONファイルとして定義できます。

```json
{
  "id": "custom_node",
  "name": "Custom Node",
  "category": "Custom",
  "description": "説明文",
  "color": "#ff6b6b",
  "inputs": [
    { "name": "Input", "type": "float", "default": 0 }
  ],
  "outputs": [
    { "name": "Output", "type": "float" }
  ],
  "code": "fn node_{{id}}(input: f32) -> f32 { return input * 2.0; }"
}
```

### サポートされる型

- `float` - 32bit浮動小数点
- `vec2` - 2Dベクトル
- `vec3` - 3Dベクトル
- `vec4` - 4Dベクトル
- `color` - RGB色（vec3として扱われる）

## ブラウザ対応

WebGPUをサポートするブラウザが必要です：
- Chrome 113+
- Edge 113+
- その他WebGPU対応ブラウザ

## ライセンス

MIT

