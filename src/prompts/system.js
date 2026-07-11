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
- N-UNC: countability=uncountable。誤答 note に「不可算名詞なので a/-s 不可」と明記。unit-of バリアントでは単位表現（a cup of tea 等）の要否も N_UNIT_OF で説明する。
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
12. N-NP / N-UNC では gridPatterns を headNoun に展開した4語を options.text に使う（順不同でよい）。a cup of {n} の cup は headNoun に合う単位（glass/bowl/piece/bottle/slice 等）へ置き換えてよい。
13. V-VOICE: 態×相の対比を、**主語より後の動詞句全体を1ユニット**として問う。
   - 主語は template 側、動詞句全体（助動詞・be動詞・過去分詞/現在分詞を含む）は選択肢側に置く。
     - 例) The report ___ by Friday. → must be written / must write / is writing / has written
   - 4択はすべて**文法的に成立する動詞句**（態×相の対比）。be/have 欠落の形態不全（should known / must written 等）は禁止。
   - 誤答は「態や相が違うが形としては成立する」ものだけにする。
14. V-TA: 時制×相の対比を、**時制助動詞から先の動詞句全体を1ユニット**として問う。
   - **穴 ___ には常に「時制助動詞（もしあれば）＋動詞句全体」を入れる**。疑問文では主語も含めて選択肢に置く。
     - 平叙: I ___ dinner when the phone rang. → was eating / ate / have eaten / had eaten
     - wh疑問: Why ___ studying English? → did you start / have you started / were you starting / had you started
     - yes/no疑問: ___ your homework yet? → Have you finished / Did you finish / Were you finishing / Had you finished
   - **禁止（最重要）**: do / does / did / have / has / had / is / are / was / were / am を **___ の外の位置に書かない**。時制の担い手（定形の助動詞・be動詞）は必ず**選択肢の中**にあること。
     - × Why did you ___ studying English?   （did が template に残っている）
     - × Have you already ___?               （have が template に残っている）
     - × I ___ eating when he came.          （was が template に残っている）
     - ○ Why ___ studying English?            / did you start / have you started / were you starting / had you started
     - ○ ___ already?                         / Have you finished / Did you finish / Were you finishing / Had you finished
   - 4択はすべて**文法的に成立する動詞句ユニット**（疑問文なら主語込み）。**形態不全ミス**（did の後に過去形、have の後に -ing 単独、原形と -ing の混在等、初等 do-support / have+pp / be+ing 規則の確認になるもの）を誤答に含めない。
   - 誤答は「時制（現在/過去）× 相（単純/進行/完了/完了進行）」のいずれかの軸でズレていることを appliedMeaning で説明する。形態的な非文法を誤答にしない。
15. **template と options の語句重複禁止**: ___ 以外に書いた名詞句・主語などを options.text に繰り返さない。穴に入れたとき二重にならないこと。
   - × How ___ this window? + is this window opened → How is this window opened this window?
   - ○ How ___? + is this window opened / does this window open / …
   - ○ The report ___ by Friday. + must be written（主語は template のみ）
   疑問の倒置で主語を選択肢に含めるなら、template 側からその主語を除く。

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
