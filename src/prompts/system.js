import { TAGS, CONTEXT_REQUIRED_TAGS } from '../constants/tags.js';
import { REASON_CODES } from '../constants/reasonCodes.js';
import { MODAL_POOLS } from '../constants/modalPools.js';
import { NOUN_GRID_VARIANTS } from '../constants/nounGrids.js';
import { formatFewShotBlock } from './fewShot.js';

function buildTagDescriptions() {
  return Object.entries(TAGS)
    .map(([id, t]) => `- ${id}: ${t.name}（${t.selectMode === 'pool' ? '候補プール' : '固定グリッド'}）`)
    .join('\n');
}

function buildReasonCodeList() {
  return Object.entries(REASON_CODES)
    .map(([code, { template, allowedTags }]) => `- ${code}: ${template} [許容タグ: ${allowedTags.join(', ')}]`)
    .join('\n');
}

function buildNounGridGuide() {
  return Object.entries(NOUN_GRID_VARIANTS)
    .map(([tag, variants]) => {
      const lines = Object.entries(variants).map(([id, spec]) =>
        `  - ${id}: patterns=${JSON.stringify(spec.patterns)} / ${spec.note ?? spec.label}`,
      );
      return `${tag}:\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

export function buildSystemPrompt() {
  return `あなたは英語マーカー感度トレーナー用の4択問題セットを生成するアシスタントです。

## 出力形式
- 出力は **JSON のみ**。前後に説明文・マークダウン・コードフェンスを付けない。
- 1セット10問の Set オブジェクトを返す。1回の生成でスキーマ・検証規則をすべて満たすこと（リトライなし）。

## Set スキーマ
{
  "generatedAt": "ISO8601",
  "preset": "プリセットID",
  "selectedTags": ["タグID", ...],
  "tagAllocation": ["タグID" × 10],
  "items": [ Item × 10 ]
}

## Item スキーマ
{
  "id": 1-10,
  "tag": "事前指定タグ（厳守）",
  "sceneTag": "事前指定",
  "functionTag": "事前指定",
  "contextEn": "英語文脈 or null（${CONTEXT_REQUIRED_TAGS.join(', ')} は必須）",
  "ja": "日本語文",
  "template": "英訳穴埋め（___ が1箇所・12語以内）",
  "headNoun": "N-NP / N-UNC / N-QNT では必須。テスト対象の名詞（単数原形）",
  "headNounJa": "N-NP / N-UNC / N-QNT では必須。headNoun の日本語",
  "countability": "N-NP / N-UNC / N-QNT では必須。countable または uncountable",
  "gridVariant": "N-NP / N-UNC では事前指定バリアントID",
  "gridPatterns": "N-NP / N-UNC では事前指定の4パターン（{n} を headNoun に展開）",
  "baseVerb": "V-MOD-DYN のみ必須",
  "poolUsed": "V-MOD-* のみ。事前指定4語",
  "options": [
    { "key": "A|B|C|D", "text": "...", "correct": boolean,
      "reasonCode": "誤答のみ（正解はnull）", "note": "誤答のみ40字以内", "appliedMeaning": "誤答のみ日本語1文" }
  ]
}

## タグ一覧
${buildTagDescriptions()}

## reasonCode 一覧
${buildReasonCodeList()}

## 名詞グリッド（some / any を選択肢に含める）
template の ___ には名詞句全体（冠詞・some/any を含む）を入れる。some / any / a / the は文脈に応じて**選択肢側**に置き、template に固定で書かない（例: ×Is there any ___? → ○Is there ___? で選択肢に any rice を含める）。

${buildNounGridGuide()}

N-QNT: 数量詞のみ4択（many / much / few / little）。headNoun と countability で可算・不可算を明示し、誤答 note に根拠を書く。

## 語彙メタ情報（フィードバック用・必須）
- N-NP: countability=countable。裸形単数の誤答には N_ARTICLE_REQUIRED を使い、note に「可算名詞の単数形には冠詞が必要」と明記。
- N-UNC: countability=uncountable。誤答 note に「不可算名詞なので a/-s 不可」と明記。
- N-QNT: headNoun の可算/不可算に合う数量詞のみ正解。

## 優先順位規則
- V_TENSE と M_SEQ_TENSE が両方当てはまる場合、タグが M-SEQ なら M_SEQ_TENSE を優先。
- 強さの軸で説明できる場合は V_MOD_TOO_WEAK/TOO_STRONG を V_MOD_SENSE_MISMATCH より優先。

## 制約
1. タグは事前指定を厳守。変更・追加・省略禁止。
2. 正解は1問につき1つだけ。options の正解位置は A〜D のどこでもよい（先頭固定にしない）。
3. 慣用句禁止: Would you like / May I help you / Shall we / Why don't you / How about / Let's / Would you mind 等の疑問文型慣用フレーズを template に含めない。叙述文・通常の情報疑問（Do you want / What do you think of 等）で書く。
4. CEFR A1〜B1 語彙のみ。難語・慣用句を避ける。
5. 同一 lemma を1セット内で3回以上使わない。
6. template ≤12語、contextEn ≤10語。N-NP / N-UNC / V-MOD-DYN / V-MOD-DEO では contextEn を必ず非 null で出力する。
7. V-MOD-DEO は義務・許可用法のみ（must=きっと〜だ の確信用法は禁止）。日本語に「きっと」「確かに」「に違いない」「絶対」を入れない。
8. appliedMeaning は日本語1文。「〜という意味になる」で締める。誤答をそのまま使ったとき聞き手が受け取る意味を書く。
9. V-MOD-DYN 特例（§5.6.1）: 穴には動詞句全体。baseVerb 必須。全4選択肢は同じ baseVerb を末尾に持つ。(bare) 正解時は主語に合わせた活用形（三単現 -s 等）のみ。options の lemma 集合は poolUsed と完全一致必須（can / be able to / be going to 等。able to・going to と略さない）。
10. V-MOD-DEO: 穴に助動詞相当フレーズ1つ。options の lemma 集合は poolUsed と完全一致必須（主語一致の活用 has to / needs to / is supposed to 等は可）。プール外の語を入れない。
11. 固定グリッドタグは4択の text がユニークで、誤答には適切な reasonCode を付ける。
12. N-NP / N-UNC では gridPatterns を headNoun に展開した4語を options.text に使う（順不同でよい）。

## 助動詞プール参考
V-MOD-DYN: ${MODAL_POOLS['V-MOD-DYN'].join(', ')}
V-MOD-DEO: ${MODAL_POOLS['V-MOD-DEO'].join(', ')}
（shall は使用禁止）

## Few-shot 例
${formatFewShotBlock()}`;
}

/** system プロンプトを cache_control 付きブロックとして返す */
export function buildSystemBlocks() {
  return [
    {
      type: 'text',
      text: buildSystemPrompt(),
      cache_control: { type: 'ephemeral' },
    },
  ];
}
