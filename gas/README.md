# English Marker Trainer — GAS プロキシ

Claude API プロキシ（`gas/code.gs`）。**新規スタンドアロン GAS プロジェクト**として運用する。

## プロジェクト情報

| 項目 | 値 |
|------|-----|
| Script ID | `1LHomWbl5Xgjf_k4odLXSttZCG6aKOGqOiTFzdVDKcRRydM0d3c1q30tt` |
| エディタ | https://script.google.com/d/1LHomWbl5Xgjf_k4odLXSttZCG6aKOGqOiTFzdVDKcRRydM0d3c1q30tt/edit |
| Script Property | `ANTHROPIC_API_KEY` |

## ソース同期（clasp）

```bash
# リポジトリルートで
clasp push
```

`.clasp.json` は gitignore 済み（ローカルのみ）。

## 初回セットアップ（エディタで1回）

> **重要**: `clasp deploy` だけでは Web App の `entryPoints` が付かず URL が 404 になる（vocab-chunk-trainer と同じ既知事象）。**初回はエディタから「ウェブアプリ」デプロイが必須**。

### 1. API キーを Script Properties に登録

1. エディタ右上 **プロジェクトの設定**（歯車）
2. **スクリプト プロパティ** → **プロパティを追加**
3. プロパティ: `ANTHROPIC_API_KEY` / 値: Anthropic API キー

またはエディタで `setAnthropicApiKey('sk-ant-...')` を1回実行（`code.gs` 内の関数）。

### 2. ウェブアプリとしてデプロイ

1. 右上 **デプロイ** → **新しいデプロイ**
2. 種類: **ウェブアプリ**
3. 実行ユーザー: **自分**
4. アクセス: **全員**
5. **デプロイ** → 表示された **ウェブアプリ URL** をコピー

### 3. 動作確認

```bash
curl -sL "https://script.google.com/macros/s/＜デプロイID＞/exec"
# → {"ok":true,"service":"english-marker-trainer-gas","hasApiKey":true}
```

### 4. GitHub Pages に反映

```bash
gh secret set VITE_GAS_ENDPOINT --repo nkhippo/English-Marker-Trainer --body "＜ウェブアプリ URL＞"
# main に空コミット push または Actions を手動実行
```

## コード更新後の再デプロイ

1. `clasp push`
2. エディタ **デプロイ → デプロイを管理 → 鉛筆アイコン → 新バージョン** で更新  
   （`clasp redeploy` は 404 を誘発しやすいため非推奨）

## フロントからの呼び出し

- 環境変数: `VITE_GAS_ENDPOINT`
- `Content-Type: text/plain` で POST（CORS プリフライト回避）
- system プロンプトに `cache_control: { type: 'ephemeral' }` を1ブロック付与
