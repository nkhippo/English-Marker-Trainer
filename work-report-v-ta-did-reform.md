# 作業報告 — V-TA `did` 問題の解消と (A) 一本化

**作業日**: 2026-07-11  
**リポジトリ**: https://github.com/nkhippo/English-Marker-Trainer  
**公開 URL**: https://nkhippo.github.io/English-Marker-Trainer/  
**作業指示**: `work-request-v-ta-did-fix.md`（Downloads/files 66）  
**根拠**: `consult-v-ta-did-options.md` の Claude 回答（パターン (B) 廃止・(A) 一本化）

---

## 1. 作業概要

V-TA で `did` / `have` などが template に残り、

1. 時制助動詞自体が選択肢の対比対象にならない  
2. 誤答が「did の後の形」（`started` / `starting`）など形態不全の初歩ミスに寄る  

という不具合を解消した。**V-TA はすべて (A)（時制助動詞から先の動詞句全体を穴に入れる）に一本化**した。

---

## 2. 実施内容

### 2.1 `src/prompts/system.js`

添付の完全版に差し替え。要点:

| 制約 | 変更 |
|------|------|
| 13 V-VOICE | 主語は template、動詞句全体は選択肢。形態不全禁止は維持 |
| 14 V-TA | (B) 削除。(A) のみ。`do/does/did/have/has/had/is/are/was/were/am` を ___ の外に書かない。疑問文は主語込みで選択肢へ。形態不全ミスを誤答にしない |
| 15 | 語句重複禁止は維持 |

### 2.2 `src/prompts/fewShot.js`

- **削除**: (B) 例 `Have you already ___ your plan for the future?`
- **追加**:
  - 平叙: `I ___ dinner when the phone rang.` → was eating / ate / have eaten / had eaten
  - wh疑問: `Why ___ studying English?` → did you start / have you started / were you starting / had you started

他タグ few-shot は無変更。

### 2.3 `src/utils/validators.js`

| 検証 | 対応 |
|------|------|
| V19 | **削除**（(B) 前提だったため。コメントで履歴を残す） |
| V21 | **新設** — V-TA の options のうち少なくとも1つに finite operator（do/does/did/have/has/had/is/are/was/were/am）が含まれること |

### 2.4 要件・ダンプ

- `marker-trainer-requirements-v0.4.md`
  - §2.2a V-TA グリッド説明を (A) 前提に更新
  - §3.2 に template 契約（v0.5）を追記
  - §6 から V19 削除、V21 追加（番号は再採番しない）
- `npm run dump-prompts` で `prompt-dumps/system.md` を再生成
  - (B) の肯定的記述（「have を template 側に残し」）は無し
  - `× Have you already ___?` は**禁止例**として残存（意図どおり）

### 2.5 テスト

- V19 テストを削除し、V21 テストに置換
- `npm test` — 23件すべてパス
- `npm run build` — 成功

---

## 3. 受け入れ条件チェック

| # | 条件 | 結果 |
|---|------|------|
| 1 | `npm run build` 警告なし | ✅ |
| 2 | バリデータテスト全パス（V19削除・V21追加） | ✅ |
| 3 | 生成テストで V-TA template に finite operator が漏れない | ⏳ 本番生成は API 依存。V21 で単問リトライ対象に含めた |
| 4 | `prompt-dumps/system.md` に (B) 肯定記述なし | ✅ |
| 5 | 要件の V19/V21 更新 | ✅ |
| 6 | fewShot に平叙・wh疑問の2例 | ✅ |

※ Phase 6 の「10問×3セット目視」は Claude API 経由の実生成が必要なため、デプロイ後の手動確認を推奨。

---

## 4. 変更ファイル一覧

- `src/prompts/system.js`
- `src/prompts/fewShot.js`
- `src/utils/validators.js`
- `tests/allocators-validators.test.js`
- `marker-trainer-requirements-v0.4.md`
- `prompt-dumps/system.md`
- `prompt-dumps/user-sample.md`
- `work-report-v-ta-did-reform.md`（本ファイル）

---

## 5. デプロイ

- ブランチ: `main`
- GitHub Pages: https://nkhippo.github.io/English-Marker-Trainer/
- プッシュ後、Actions の Pages デプロイ完了を待って反映を確認

---

## 6. Claude への確認・フォローアップ（任意）

1. 実生成3セットで V-TA の template / options / appliedMeaning を目視レビューしてほしい  
2. V-VOICE の疑問文パターン（制約13は平叙例のみ）を次スコープに入れるか  
3. 相談メモ `consult-v-ta-did-options.md` は方針決定済みとしてアーカイブ扱いでよいか  

---

*work-request-v-ta-did-reform.md / consult-v-ta-did-options.md に基づく実装報告*
