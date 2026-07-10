const STOP_WORDS = new Set([
  'a', 'an', 'the', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their',
  'this', 'that', 'these', 'those', 'is', 'am', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'to', 'of', 'in',
  'on', 'at', 'by', 'for', 'with', 'from', 'as', 'and', 'or', 'but', 'not',
  'so', 'if', 'when', 'while', 'before', 'after', 'about', 'into', 'through',
  'during', 'than', 'then', 'there', 'here', 'what', 'which', 'who', 'whom',
  'whose', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'only', 'own', 'same',
  'too', 'very', 'just', 'also', 'now', 'up', 'out', 'off', 'over', 'under',
  'again', 'once', 'please', 'like', 'some',
]);

function tokenize(text) {
  if (!text) return [];
  return (text.match(/\b[a-zA-Z'-]+\b/g) ?? []).map((w) => w.toLowerCase());
}

function lemma(word) {
  if (word.length <= 2) return word;
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

export function extractContentLemmas(text) {
  return tokenize(text)
    .filter((w) => !STOP_WORDS.has(w))
    .map(lemma);
}

/** 1問あたり各 lemma は1回だけカウント（セット横断の語彙重複を見る） */
export function itemContentLemmas(item) {
  const texts = [item.template, item.contextEn].filter(Boolean);
  const set = new Set();
  for (const text of texts) {
    for (const lm of extractContentLemmas(text)) set.add(lm);
  }
  return set;
}

export function countLemmaFrequencies(items) {
  const freq = {};
  for (const item of items) {
    for (const lm of itemContentLemmas(item)) {
      freq[lm] = (freq[lm] ?? 0) + 1;
    }
  }
  return freq;
}

export function hasLemmaOverflow(items, maxCount = 2) {
  const freq = countLemmaFrequencies(items);
  return Object.values(freq).some((n) => n > maxCount);
}

export function getOverflowingLemmas(items, maxCount = 2) {
  const freq = countLemmaFrequencies(items);
  return Object.keys(freq).filter((lm) => freq[lm] > maxCount);
}

export function itemUsesLemma(item, targetLemma) {
  return itemContentLemmas(item).has(targetLemma);
}

export function contextUsesLemma(item, targetLemma) {
  if (!item.contextEn) return false;
  return extractContentLemmas(item.contextEn).includes(targetLemma);
}
