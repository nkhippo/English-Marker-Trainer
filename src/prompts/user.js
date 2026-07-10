import { REASON_CODES } from '../constants/reasonCodes.js';

/**
 * @param {{
 *   tagAllocation: string[],
 *   sceneAllocations: { sceneTag: string, functionTag: string }[],
 *   poolAllocations: (string[]|null)[],
 *   gridAllocations: (object|null)[],
 *   presetName: string,
 *   selectedTags: string[],
 * }} params
 */
export function buildUserPrompt({
  tagAllocation,
  sceneAllocations,
  poolAllocations,
  gridAllocations = [],
  presetName,
  selectedTags,
}) {
  const assignments = tagAllocation.map((tag, i) => ({
    id: i + 1,
    tag,
    sceneTag: sceneAllocations[i].sceneTag,
    functionTag: sceneAllocations[i].functionTag,
    ...(poolAllocations[i] ? { poolUsed: poolAllocations[i] } : {}),
    ...(gridAllocations[i]
      ? {
          gridVariant: gridAllocations[i].variant,
          gridPatterns: gridAllocations[i].patterns,
          countability: gridAllocations[i].countability,
        }
      : {}),
  }));

  const poolNotes = assignments
    .filter((a) => a.poolUsed)
    .map((a) => {
      const extra = a.tag === 'V-MOD-DYN'
        ? ' baseVerb は場面から選び、動詞句全体として4択を構成。options の lemma は poolUsed と完全一致（順不同）。プール外禁止。'
        : ' この4つの中から正解を1つ選び、残り3つを誤答として配置。options の lemma は poolUsed と完全一致（順不同）。プール外禁止。';
      return `問${a.id} (${a.tag}): poolUsed=${JSON.stringify(a.poolUsed)}.${extra}`;
    })
    .join('\n');

  const gridNotes = assignments
    .filter((a) => a.gridPatterns)
    .map((a) => `問${a.id} (${a.tag}): gridVariant=${a.gridVariant}, gridPatterns=${JSON.stringify(a.gridPatterns)}, countability=${a.countability}`)
    .join('\n');

  return `10問の Set を生成してください（1回の出力で全検証規則を満たすこと。再生成はありません）。

preset: ${presetName}
selectedTags: ${JSON.stringify(selectedTags)}

## 事前抽選 tagAllocation / scene / pool / grid
${JSON.stringify(assignments, null, 2)}

## プール問の指示
${poolNotes || '（なし）'}

## 名詞グリッド問の指示
${gridNotes || '（なし）'}

tagAllocation のタグ・scene・poolUsed・gridPatterns を厳守すること。
N-NP / N-UNC / N-QNT では headNoun・headNounJa・countability を必ず出力すること（欠けると検証失敗）。
headNounJa は headNoun の日本語訳（例: water→水, homework→宿題）。省略禁止。
CEFR A1〜B1 語彙制約を再掲: 易しい語彙のみ。文長は template≤12語、contextEn≤10語。`;
}
