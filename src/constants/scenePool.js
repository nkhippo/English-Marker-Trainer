// structure-map §9 ミラー — MECE非保証・重複容認

/** @type {{ scenes: string[], layer?: number }[]} */
export const SCENE_ENTRIES = [
  // A: 生活者共通
  { scenes: ['道聞き', '買い物', '寮生活', '雑談', '教室', '空港', 'レストラン'] },
  // B: ペルソナ
  { scenes: ['留学生活', '職場', '家庭', '旅行'] },
  // B': ロジカルシンキング（語学学校・自己将来）
  { scenes: ['自己と将来', '語学学校', 'キャリア'] },
];

export const FUNCTION_TAGS = [
  '確認する',
  '情報を得る',
  '理由・目的を問う',
  '方法を問う',
  '申し出る',
  '提案する',
];

/** 仮定法系など第2層 — 初版除外 */
export const LAYER2_SCENES = [
  { scenes: ['What would you do if…'], layer: 2 },
];

export function getScenePoolText() {
  const lines = [
    '【A 生活者共通】' + SCENE_ENTRIES[0].scenes.join('、'),
    '【B ペルソナ】' + SCENE_ENTRIES[1].scenes.join('、'),
    "【B' ロジカルシンキング】" + SCENE_ENTRIES[2].scenes.join('、'),
    '【C 機能軸（functionTag）】' + FUNCTION_TAGS.join('、'),
    '※ 各問は上記からランダムに sceneTag と functionTag を1つずつ選ぶ。MECE非保証・重複容認。',
    '※ 仮定法系（layer:2）は初版では出題しない。',
  ];
  return lines.join('\n');
}

export function pickRandomScene() {
  const pool = SCENE_ENTRIES.flatMap((e) => e.scenes);
  const sceneTag = pool[Math.floor(Math.random() * pool.length)];
  const functionTag = FUNCTION_TAGS[Math.floor(Math.random() * FUNCTION_TAGS.length)];
  return { sceneTag, functionTag };
}
