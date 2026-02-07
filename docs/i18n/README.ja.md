# Folio

**Folio: マルチカラムワークスペース**

> シームレスな読み書きのための連続したマルチカラムワークスペース

[![GitHub release](https://img.shields.io/github/v/release/yourusername/obsidian-folio)](https://github.com/yourusername/obsidian-folio/releases)
[![License](https://img.shields.io/github/license/yourusername/obsidian-folio)](LICENSE)

**[English](../../README.md)** | [简体中文](README.zh.md) | [繁體中文](README.zh-TW.md) | **日本語** | [한국어](README.ko.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [العربية](README.ar.md)

---

## 📖 概要

**Folio**は Obsidian で同期されたマルチカラム読書環境を作成します：

- **左ペイン**：ネイティブ Obsidian エディター/プレビュー、完全に編集可能
- **右ペイン**：自動分割表示、左の内容の続きを表示
- **双方向スクロール**：どちらかのペインをスクロールすると、もう一方が自動的に追従
- **モード適応**：編集モードとプレビューモードをシームレスに切り替え

長文書の閲覧、セクションの比較、または前文を参照しながらの編集に最適です。

---

## ✨ 機能

### 🔄 双方向同期
- 左ペインをスクロール → 右ペインが続きを表示して追従
- 右ペインをスクロール → 左ペインが前文を表示して追従
- 滑らかな 60fps スクロール性能

### 📝 完全なネイティブ編集
- 左ペインはすべての Obsidian 機能を使用して完全に編集可能
- すべてのプラグインが正常に動作（Vim モード、テーマなど）
- シンタックスハイライトとライブプレビュー

### 🎨 アダプティブモード切替
- 左ペインの編集/プレビューモード切替 → 右ペインが自動的に適応
- 同期体験が中断されることはありません

### ⚙️ カスタマイズ可能なオーバーラップ
- ペイン間の重複行数を調整（0-10 行）
- ツールバーによる内容の隠蔽を防止
- デフォルト：2 行のオーバーラップ

---

## 🚀 インストール

### Obsidian コミュニティプラグインから

1. **設定** → **コミュニティプラグイン** を開く
2. **セーフモード** をオフにする
3. **参照** をクリックし、「Folio」を検索
4. **インストール** をクリック
5. プラグインを有効化

### 手動インストール

1. [GitHub Releases](https://github.com/yourusername/obsidian-dual-pane-sync/releases) から最新版をダウンロード
2. ファイルをプラグインフォルダに解凍：`<vault>/.obsidian/plugins/obsidian-dual-pane-sync/`
3. Obsidian を再読み込み
4. **設定** → **コミュニティプラグイン** でプラグインを有効化

---

## 🎯 使い方

### クイックスタート

1. Obsidian で任意の Markdown ノートを開く
2. 左リボンの **📑 アイコン** をクリック
3. 右ペインが自動的に分割され、スクロールに追従

### ホットキー設定

1. **設定** → **ホットキー** を開く
2. 「Folio」を検索
3. 好みのキーを割り当てる

**推奨ホットキー：**
- `Page Up` / `Page Down`
- `Ctrl + ↑` / `Ctrl + ↓`
- `Cmd + ↑` / `Cmd + ↓` (Mac)

---

## ⚙️ 設定

| 設定 | 説明 | デフォルト |
|------|------|------------|
| **重複行数** | ペイン間の重複表示行数 | 2 |

---

## 🛠️ 開発者向け

### ソースからビルド

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/obsidian-dual-pane-sync.git

# 依存関係をインストール
npm install

# プラグインをビルド
npm run build

# 開発モード（ホットリロード付き）
npm run dev
```

---

## 🌍 ローカリゼーション

このプラグインは 9 言語に対応しています：

- 🇺🇸 English（デフォルト）
- 🇨🇳 简体中文
- 🇹🇼 繁體中文
- 🇯🇵 日本語
- 🇰🇷 한국어
- 🇫🇷 Français
- 🇩🇪 Deutsch
- 🇪🇸 Español
- 🇸🇦 العربية

プラグインは自動的に Obsidian の言語設定を検出します。

---

## 📄 ライセンス

[MIT ライセンス](LICENSE) © 2024 [Your Name]

---

<div align="center">

**[⬆ トップに戻る](#folio)**

Obsidian コミュニティに ❤️ を込めて作りました

</div>
