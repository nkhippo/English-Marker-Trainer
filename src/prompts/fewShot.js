/** Few-shot examples embedded in system prompt (appliedMeaning の手本) */
export const FEW_SHOT_EXAMPLES = [
  {
    id: 1,
    tag: 'N-NP',
    sceneTag: '買い物',
    functionTag: '情報を得る',
    contextEn: 'I was looking for a gift.',
    ja: '昨日、私は書店に行った。',
    template: 'I went to ___ yesterday.',
    options: [
      { key: 'A', text: 'a bookstore', correct: true, reasonCode: null, note: null, appliedMeaning: null },
      { key: 'B', text: 'the bookstore', correct: false, reasonCode: 'N_DEF_NEW', note: 'どの書店かは初めて話題に出る', appliedMeaning: '（相手がすでに知っている）例の書店に行った、という意味になる' },
      { key: 'C', text: 'bookstores', correct: false, reasonCode: 'N_NUM_SG', note: '行ったのは1軒', appliedMeaning: '複数の書店を（同時に／はしごして）回った、という意味になる' },
      { key: 'D', text: 'the bookstores', correct: false, reasonCode: 'N_DEF_NEW', note: '限定性・数の両方が不適', appliedMeaning: '相手も知っている複数の書店を回った、という意味になる' },
    ],
  },
  {
    id: 4,
    tag: 'V-MOD-DEO',
    sceneTag: '空港',
    functionTag: '理由・目的を問う',
    contextEn: 'She might miss her flight because of traffic.',
    ja: '彼女は今すぐ空港へ向かわなければならない。',
    template: 'She ___ go to the airport now.',
    poolUsed: ['have to', 'must', 'should', 'may'],
    options: [
      { key: 'A', text: 'has to', correct: true, reasonCode: null, note: null, appliedMeaning: null },
      { key: 'B', text: 'must', correct: false, reasonCode: 'V_MOD_SOURCE_MISMATCH', note: '外部事情ではなく話者の主観的な必要性に聞こえる', appliedMeaning: '話者が「絶対に必要だ」と個人的に強く思っている、という意味になる' },
      { key: 'C', text: 'should', correct: false, reasonCode: 'V_MOD_TOO_WEAK', note: '助言レベルで、緊急の必要性が伝わらない', appliedMeaning: '「そうした方がいいよ」という助言程度の弱さになる' },
      { key: 'D', text: 'may', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: '許可・可能性の意味になり、必要性が伝わらない', appliedMeaning: '「行ってもよい（許可）」という意味に変わってしまう' },
    ],
  },
  {
    id: 6,
    tag: 'V-MOD-DYN',
    sceneTag: '寮生活',
    functionTag: '情報を得る',
    contextEn: 'Every morning before school, she practices.',
    ja: '彼女は毎朝ピアノを弾く。',
    template: 'She ___ the piano every morning.',
    baseVerb: 'play',
    poolUsed: ['(bare)', 'can', 'would', 'may'],
    options: [
      { key: 'A', text: 'plays', correct: true, reasonCode: null, note: null, appliedMeaning: null },
      { key: 'B', text: 'can play', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: '能力の意味になり、日常習慣の叙述と噛み合わない', appliedMeaning: '「弾ける（能力がある）」という意味になる' },
      { key: 'C', text: 'would play', correct: false, reasonCode: 'V_MOD_TENSE_MISMATCH', note: '過去や仮定の距離感が入る', appliedMeaning: '「（昔は／もし〜なら）弾いただろう」という距離のある意味になる' },
      { key: 'D', text: 'may play', correct: false, reasonCode: 'V_MOD_TOO_WEAK', note: '不確実な可能性の意味になる', appliedMeaning: '「弾くかもしれない」という不確かな意味になる' },
    ],
  },
];

export function formatFewShotBlock() {
  return FEW_SHOT_EXAMPLES.map((ex) => JSON.stringify(ex, null, 2)).join('\n\n');
}
