# 相談: V-TA で `did` を選択肢に含める／`did` 後の原形は既知とする

Claude Projects 等への相談用メモ。実装前の方針確認。

## 相談したいこと（2点）

スクリーンショット例:

- 日本語: あなたはなぜ英語を勉強し始めたのですか？
- template: `Why did you ___ studying English?`
- 選択肢: `start` / `starting` / `started` / `have started`

### 1. `did` を文面固定にせず、選択肢側にまとめる

現状は `did` が template 側に残り、穴は動詞部分だけになっている。

**希望:** `did` も含めて出題する（`did` を選択肢に入れる）。

意図の例（要議論）:

| 現状 | 希望イメージ |
|------|----------------|
| `Why did you ___ studying English?` | `Why ___ studying English?` |
| `start` / `starting` / `started` / `have started` | `did you start` / `have you started` / `were you starting` / `had you started` など |

※ 正しい4択の形・グリッド軸は相談で決めたい。

### 2. `did` に続く動詞は原形であることが既知

学習者は「`did` のあとは原形（いわゆる学校文法の“現在形”）」を既に知っている前提にしたい。

したがって次のような誤答は**出さない**:

- `Why did you ___ …?` + `started`（過去形）
- `Why did you ___ …?` + `starting`（-ing）

これらは「`did` + 原形」の形態ルールの確認になってしまい、本アプリの V-TA（時制×相の判別）の主目的から外れる。

**希望:** 時制・相の対比（過去単純 / 現在完了 / 過去進行 / 過去完了 等）を、`did` を含む動詞句全体の選択で問う。

---

## 現状の関連ルール（抜粋）

`src/prompts/system.js` 制約 14（V-TA）:

- **(A)** 動詞句全体を穴に入れる（例: `was eating` / `ate` / `have eaten` / `had eaten`）
- **(B)** `have` / `has` / `had` を template 側に残し、後続形だけを穴にする（完了マーカーを見せる）

今回の不具合は、**(B) に似た形で `did` が template に残った**結果、

1. `did` 自体が選択肢に入らない
2. 誤答が「`did` のあとの形」の初歩ミス（`started` / `starting`）に寄りやすい

になっている、と理解している。

固定グリッド例（要件）: `played` / `was playing` / `has played` / `had played`

検証:

- V19: `have`/`has`/`had` が ___ より前 → 有限動詞句を選択肢に置かない
- V20: template と option の2語以上フレーズ重複禁止

`did` 向けの明示ルール・検証はまだない。

---

## Claude への質問

1. **推奨パターンはどれか**
   - (A) 常に `did` を含む動詞句全体を options に入れる（`Why ___ studying English?` → `did you start` / …）
   - (B) `do`/`does`/`did` を template に残すパターンは禁止し、(A) のみにする
   - (C) `have` の (B) は残すが、`do`/`does`/`did` だけは (A) 強制、など非対称ルール

2. **`have` の (B) との整合**
   - 先日「`Have you already ___?` で have を見せたい」方針を入れた。
   - `did` は選択肢に入れ、`have` は文面に残す、で学習目的上の差をどう説明するのがよいか。

3. **プロンプト文言の草案**
   - 制約 14 をどう書き換えるべきか（具体的な禁止例・正解例つき）。

4. **コード検証（Vxx）は必要か**
   - 例: template に `\bdid\b` が ___ より前にある Item を reject
   - 例: `did` + 非原形 の組み合わせを reject
   - プロンプトのみで足りるか、再生成用の決定的検証が必要か。

5. **few-shot**
   - `Have you already ___?` 例（現行）と、`Why ___ studying English?` + `did you start` 例の両方を載せるべきか。

---

## 添付・参照してほしいファイル

| 役割 | パス |
|------|------|
| **生成 system プロンプトのダンプ（相談の主資料）** | `prompt-dumps/system.md` |
| user プロンプトのサンプル | `prompt-dumps/user-sample.md` |
| system プロンプトのソース | `src/prompts/system.js` |
| few-shot ソース | `src/prompts/fewShot.js` |
| 要件正本（V-TA グリッド・検証一覧） | `marker-trainer-requirements-v0.4.md` |
| 検証実装 | `src/utils/validators.js`（V18–V20） |

再ダンプ: `npm run dump-prompts`

---

## 期待する回答フォーマット

1. 採用する出題パターン（A/B/C または別案）と理由（3〜5行）
2. プロンプト制約 14 の書き換え案（コピペ可能な全文）
3. 追加する検証ルールの有無と、ある場合の判定条件
4. few-shot の要否と1例
5. `have` (B) を残す／削る／条件付きにする最終推奨
