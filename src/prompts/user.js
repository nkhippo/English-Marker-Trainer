import { REASON_CODES } from '../constants/reasonCodes.js';

function formatAllowedReasonCodes(tag) {
  return Object.entries(REASON_CODES)
    .filter(([, value]) => value.allowedTags.includes(tag))
    .map(([code, value]) => `- ${code}: ${value.template}`)
    .join('\n');
}

function appendNounGridLines(lines, grid) {
  if (!grid) return;
  lines.push(`gridVariant: ${grid.variant}`);
  lines.push(`gridPatterns: ${JSON.stringify(grid.patterns)}`);
  lines.push(`countability: ${grid.countability}`);
  lines.push(grid.hint);
  lines.push('headNoun / headNounJa を必ず含め、誤答 note に可算・不可算の根拠を書くこと。');
}

/**
 * @param {{
 *   tagAllocation: string[],
 *   sceneAllocations: { sceneTag: string, functionTag: string }[],
 *   poolAllocations: (string[]|null)[],
 *   gridAllocations: (object|null)[],
 *   presetName: string,
 *   selectedTags: string[],
 *   singleItem?: { id: number, tag: string, scene: object, pool: string[]|null, grid?: object },
 *   validationErrors?: string[],
 *   avoidLemmas?: string[],
 * }} params
 */
export function buildUserPrompt({
  tagAllocation,
  sceneAllocations,
  poolAllocations,
  gridAllocations = [],
  presetName,
  selectedTags,
  singleItem,
  validationErrors,
  avoidLemmas,
}) {
  if (singleItem) {
    const { id, tag, scene, pool, grid } = singleItem;
    const lines = [
      `以下の1問だけを再生成してください。出力は Item オブジェクト1つの JSON のみ。`,
      ``,
      `id: ${id}`,
      `tag: ${tag}`,
      `sceneTag: ${scene.sceneTag}`,
      `functionTag: ${scene.functionTag}`,
      ``,
      `このタグで使える reasonCode（誤答のみ。範囲外コードは無効）:`,
      formatAllowedReasonCodes(tag),
    ];
    appendNounGridLines(lines, grid);
    if (pool) {
      lines.push(`poolUsed: ${JSON.stringify(pool)}`);
      lines.push(`この4つの中から正解を1つ選び、残り3つを誤答として配置せよ。`);
      if (tag === 'V-MOD-DYN') {
        lines.push(`V-MOD-DYN: baseVerb を場面から選び、全選択肢を動詞句として展開せよ。(bare) は活用形のみ。`);
      }
    }
    if (tag === 'N-QNT') {
      lines.push('headNoun / headNounJa / countability を必ず含め、many・few は可算、much・little は不可算に対応させること。');
    }
    if (validationErrors?.length) {
      lines.push('', '前回の検証エラー（必ず修正）:');
      for (const err of validationErrors) lines.push(`- ${err}`);
    }
    if (avoidLemmas?.length) {
      lines.push('', `次の語彙（lemma）はセット内で使いすぎなので、この問では避けること: ${avoidLemmas.join(', ')}`);
    }
    lines.push(`CEFR A1〜B1 語彙・文長制約を厳守。`);
    return lines.join('\n');
  }

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
        ? ' baseVerb は場面から選び、動詞句全体として4択を構成。'
        : ' この4つの中から正解を1つ選び、残り3つを誤答として配置。';
      return `問${a.id} (${a.tag}): poolUsed=${JSON.stringify(a.poolUsed)}.${extra}`;
    })
    .join('\n');

  const gridNotes = assignments
    .filter((a) => a.gridPatterns)
    .map((a) => `問${a.id} (${a.tag}): gridVariant=${a.gridVariant}, gridPatterns=${JSON.stringify(a.gridPatterns)}, countability=${a.countability}`)
    .join('\n');

  return `10問の Set を生成してください。

preset: ${presetName}
selectedTags: ${JSON.stringify(selectedTags)}

## 事前抽選 tagAllocation / scene / pool / grid
${JSON.stringify(assignments, null, 2)}

## プール問の指示
${poolNotes || '（なし）'}

## 名詞グリッド問の指示
${gridNotes || '（なし）'}

tagAllocation のタグ・scene・poolUsed・gridPatterns を厳守すること。
N-NP / N-UNC / N-QNT では headNoun・headNounJa・countability を必ず出力すること。
CEFR A1〜B1 語彙制約を再掲: 易しい語彙のみ。文長は template≤12語、contextEn≤10語。`;
}
