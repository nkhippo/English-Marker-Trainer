# English Marker Trainer — 作業報告書

**作業日**: 2026-07-10  
**リポジトリ**: https://github.com/nkhippo/English-Marker-Trainer  
**公開 URL**: https://nkhippo.github.io/English-Marker-Trainer/  
**作業指示**: `marker-trainer-work-request-v2.md`

---

## 1. 作業概要

`marker-trainer-work-request-v2.md` に沿い、English Marker Trainer を新規構築した。既存の Structure / Question Trainer の規約（React + Vite、GAS プロキシ、プロンプト分離、`prompt-dumps/` 運用）を踏襲しつつ、判別（4択）・10問固定・採点 API なし・全問 MD エクスポートなど本アプリ固有の設計を実装した。

---

## 2. 実装内容

### 2.1 リポジトリ構成

work-request §4 どおりのディレクトリ構成を構築:

- `src/constants/` — tags, presets, modalPools, reasonCodes, fixedGrids, scenePool（Question Trainer からコピー）, mockSet
- `src/utils/` — tagAllocator, sceneAllocator, poolPicker, validators (V1–V16), lemmaCounter, retryLogic, exportMd
- `src/prompts/` — system.js（cache_control 1ブロック）, user.js, fewShot.js
- `src/api/claude.js` — GAS プロキシ経由の Claude API 呼び出し
- `src/components/` — Setup / Loading / Question / Result / Export 各画面
- `gas/code.gs` — 新規 GAS プロキシ（`ANTHROPIC_API_KEY`）
- `.github/workflows/deploy.yml` — GitHub Pages 自動デプロイ

### 2.2 v2 確定事項の反映

| 項目 | 対応 |
|------|------|
| GAS 新規プロジェクト | `gas/code.gs` を独立実装。キー名 `ANTHROPIC_API_KEY` |
| Prompt caching | system 全体を1つの `cache_control: { type: 'ephemeral' }` ブロック |
| V-MOD-DYN `(bare)` | template 穴を動詞句全体に変更。`baseVerb` 必須、V16 検証 |
| CEFR 機械検証なし | プロンプトソフト制約 + V10 文長 + V11 lemma のみ |
| 慣用句排除 | プロンプト指示 + V15 正規表現 + UI 注記 |

### 2.3 UI

`marker-trainer-prototype.html` の配色・画面遷移（setup → loading → question → result）・4択レビュー展開・結果画面アコーディオン・MD エクスポートモーダルを React コンポーネント化。

- 内部タグ ID（`N-NP` 等）は UI / エクスポートに出さず `TAGS[id].name` のみ表示
- 慣用句非扱いの注記を設定画面に明示
- API 未設定時はモックで動作（バナー表示）。API 失敗時はサイレントフォールバックせずエラー表示

### 2.4 生成パイプライン

1. コード側で `tagAllocation` / `sceneAllocations` / `poolAllocations` を事前抽選
2. Claude API で 10問セットを1コール生成
3. V1–V16 + セット検証。違反問のみ最大3回単問再生成
4. 3回失敗で明示エラー

---

## 3. 検証結果

| 項目 | 結果 |
|------|------|
| `npm test` | 3/3 パス（タグ抽選100回、シーン抽選100回、モック Item バリデーション） |
| `npm run build` | 成功（警告なし） |
| `npm run dump-prompts` | `prompt-dumps/system.md`, `user-sample.md` 生成 |
| UI タグ ID 露出 | `src/components/` に内部タグ ID なし（grep 確認） |

---

## 4. デプロイ

- `main` ブランチへ push
- GitHub Actions `Deploy to GitHub Pages` ワークフローでビルド・デプロイ
- 本番 API 利用には GitHub Secrets `VITE_GAS_ENDPOINT` に GAS Web App URL を登録すること

### GAS セットアップ（未実施の場合）

1. [Google Apps Script](https://script.google.com) で新規プロジェクト作成
2. `gas/code.gs` を貼り付け
3. プロジェクト設定 → Script Properties → `ANTHROPIC_API_KEY`
4. デプロイ → ウェブアプリ（アクセス: 全員）
5. 発行 URL を `VITE_GAS_ENDPOINT` に設定

---

## 5. 既知の制限・次ステップ

- **GAS デプロイ**: コードは同梱済みだが、API キー登録と Web App デプロイはリポジトリ所有者が実施する必要がある
- **デモモード**: API 未設定時はモック10問で全フロー体験可能（本番生成は GAS 設定後）
- **appliedMeaning 検証**: コード検証対象外。MD エクスポート → Claude Projects での目視検証運用

---

## 6. ファイル一覧（主要）

```
src/App.jsx                    # 状態機械
src/constants/tags.js          # 12タグ定義
src/utils/validators.js        # V1–V16
src/utils/retryLogic.js        # 生成 + 単問再生成
src/prompts/system.js          # cache 対象 system
src/prompts/user.js            # 動的 user
gas/code.gs                    # GAS プロキシ
WORK_REPORT.md                 # 本報告書
```

---

*要件正本: `marker-trainer-requirements-v0.4.md` / UI 正本: `marker-trainer-prototype.html`*
