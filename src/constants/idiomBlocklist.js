// template（英訳の穴埋め文）に対して評価する。
// マッチしたら V15 違反として単問再生成。
export const IDIOM_PATTERNS = [
  /\b(May|Can|Could|Would|Will|Shall)\s+(I|we|you)\s/i,
  /\bWhy\s+don'?t\s+(you|we)\b/i,
  /\bHow\s+about\b/i,
  /\bWhat\s+about\s+\w+ing\b/i,
  /\bWould\s+you\s+like\b/i,
  /\bWould\s+you\s+mind\b/i,
  /^Let'?s\s/i,
  /\bWould\s+you\s+care\s+to\b/i,
];

export function containsIdiom(template) {
  return IDIOM_PATTERNS.some((p) => p.test(template));
}
