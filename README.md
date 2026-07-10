# English Marker Trainer

英語の冠詞・単複・時制・助動詞などの**判別感度**を、4択10問で診断するトレーナーアプリ。

- **本番 URL**: https://nkhippo.github.io/English-Marker-Trainer/
- **スタック**: React + Vite / GitHub Pages / Google Apps Script プロキシ / Claude API (`claude-sonnet-4-6`)

## 開発

```bash
npm install
npm run dev
```

`.env.local` に GAS エンドポイントを設定:

```
VITE_GAS_ENDPOINT=https://script.google.com/macros/s/.../exec
```

API 未設定時はデモ用モックデータで全画面を操作できます（UI に明示表示）。

## スクリプト

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run dump-prompts` | プロンプトを `prompt-dumps/` に出力 |
| `npm test` | 抽選・バリデータのユニットテスト |

## GAS プロキシ

1. `gas/code.gs` を新規 GAS プロジェクトに貼り付け
2. Script Properties に `ANTHROPIC_API_KEY` を登録
3. Web アプリとしてデプロイ（アクセス: 全員）
4. URL を `VITE_GAS_ENDPOINT` / GitHub Secrets に設定

## 設計ドキュメント

- `marker-trainer-requirements-v0.4.md` — 要件正本
- `marker-trainer-prototype.html` — UI 視覚正本
