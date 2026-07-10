const MODAL_TAGS = new Set(['V-MOD-DYN', 'V-MOD-DEO']);

/**
 * 選択タグから10問分のタグ列を抽選。
 * 同一タグの最大数 = ceil(10 / selectedTags.length) + 1
 */
export function allocateTags(selectedTags) {
  if (!selectedTags?.length) {
    throw new Error('選択タグが空です');
  }

  const maxPerTag = Math.ceil(10 / selectedTags.length) + 1;
  const counts = Object.fromEntries(selectedTags.map((t) => [t, 0]));
  const result = [];

  for (let i = 0; i < 10; i++) {
    const available = selectedTags.filter((t) => counts[t] < maxPerTag);
    const pool = available.length ? available : selectedTags;
    const tag = pool[Math.floor(Math.random() * pool.length)];
    counts[tag]++;
    result.push(tag);
  }

  return result;
}

export function isModalTag(tag) {
  return MODAL_TAGS.has(tag);
}
