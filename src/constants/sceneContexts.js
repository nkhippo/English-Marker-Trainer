/** sceneTag → 短い英語文脈（≤10語）。内容語 lemma が場面間で重ならないよう選定。 */
export const SCENE_CONTEXT_EN = {
  道聞き: 'A tourist needs directions nearby.',
  買い物: 'She wants a small gift.',
  寮生活: 'His roommate left a note.',
  雑談: 'Two friends share weekend plans.',
  教室: 'The lesson starts after lunch.',
  空港: 'Her flight leaves in an hour.',
  レストラン: 'The menu looks quite long.',
  留学生活: 'Campus life feels new today.',
  職場: 'The meeting ends before noon.',
  家庭: 'Dinner is almost ready now.',
  旅行: 'Their hotel is near the station.',
  自己と将来: 'She plans her next career step.',
  語学学校: 'Practice helps every morning.',
  キャリア: 'He updates his resume carefully.',
  'What would you do if…': 'They discuss a possible case.',
};

/** overflow 解消用の追加文脈（互いに内容語を重ねない） */
export const EXTRA_CONTEXT_EN = [
  'Rain started a minute ago.',
  'The window stays closed tonight.',
  'Coffee smells strong this morning.',
  'A bus arrives very soon.',
  'Music plays in the hall.',
  'Paper covers the wooden desk.',
  'Salt is on the table.',
  'News comes from the radio.',
  'Tickets cost more than before.',
  'Butter melts in the pan.',
];

export function fallbackContextEn(sceneTag) {
  return SCENE_CONTEXT_EN[sceneTag] ?? 'Something simple is happening nearby.';
}

export function allFallbackContexts() {
  return [...Object.values(SCENE_CONTEXT_EN), ...EXTRA_CONTEXT_EN];
}
