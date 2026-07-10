/** sceneTag → 短い英語文脈（≤10語）。V9 欠落時のフォールバック。 */
export const SCENE_CONTEXT_EN = {
  道聞き: 'A tourist needs directions nearby.',
  買い物: 'She is looking for a gift.',
  寮生活: 'They are talking in the dorm.',
  雑談: 'Two friends are chatting casually.',
  教室: 'The teacher is speaking in class.',
  空港: 'She is waiting at the airport.',
  レストラン: 'They are ordering food now.',
  留学生活: 'She is studying abroad this year.',
  職場: 'They are talking at the office.',
  家庭: 'They are talking at home today.',
  旅行: 'They are traveling together now.',
  自己と将来: 'She is thinking about her future.',
  語学学校: 'They are in a language class.',
  キャリア: 'They are talking about work plans.',
  'What would you do if…': 'They discuss a possible case.',
};

export function fallbackContextEn(sceneTag) {
  return SCENE_CONTEXT_EN[sceneTag] ?? 'They are talking about the situation.';
}
