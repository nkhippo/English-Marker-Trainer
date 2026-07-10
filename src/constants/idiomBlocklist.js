// template（英訳の穴埋め文）に対して評価する。
// マッチしたら V15 違反。sanitize で書き換えを試みる。
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

/** 慣用句オープニング → 叙述・通常疑問への置換（___ は維持） */
const IDIOM_REWRITES = [
  { pattern: /\bWould\s+you\s+like\b/gi, replace: 'Do you want' },
  { pattern: /\bWould\s+you\s+mind\b/gi, replace: 'Is it okay to' },
  { pattern: /\bWould\s+you\s+care\s+to\b/gi, replace: 'Do you want to' },
  { pattern: /\bHow\s+about\b/gi, replace: 'What do you think of' },
  { pattern: /\bWhat\s+about\s+(\w+ing)\b/gi, replace: 'What do you think of $1' },
  { pattern: /\bWhy\s+don'?t\s+you\b/gi, replace: 'You should' },
  { pattern: /\bWhy\s+don'?t\s+we\b/gi, replace: 'We should' },
  { pattern: /^Let'?s\s+/i, replace: 'We should ' },
  { pattern: /^(May|Can|Could|Would|Will|Shall)\s+I\s+/i, replace: 'I want to ' },
  { pattern: /^(May|Can|Could|Would|Will|Shall)\s+you\s+/i, replace: 'You should ' },
  { pattern: /^(May|Can|Could|Would|Will|Shall)\s+we\s+/i, replace: 'We should ' },
];

export function containsIdiom(template) {
  if (!template) return false;
  return IDIOM_PATTERNS.some((p) => p.test(template));
}

/** 慣用句パターンを通常の文に書き換え。解消できなければ元文を返す。 */
export function rewriteIdiomTemplate(template) {
  if (!template || !containsIdiom(template)) return template;

  let next = template;
  for (const { pattern, replace } of IDIOM_REWRITES) {
    next = next.replace(pattern, replace);
  }

  // "I want to ___ the door" のように to + ___ が続く場合はそのまま
  // "Is it okay to ___?" も許容
  next = next.replace(/\s{2,}/g, ' ').trim();

  return containsIdiom(next) ? template : next;
}
