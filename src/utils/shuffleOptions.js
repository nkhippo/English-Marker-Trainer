/** Fisher–Yates shuffle (copy). */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 選択肢の表示順をランダム化する（全タグ・全プリセット共通）。
 * key は表示位置に合わせて A–D を振り直す。
 */
export function shuffleItemOptions(item) {
  if (!item?.options?.length) return item;
  const shuffled = shuffle(item.options).map((opt, i) => ({
    ...opt,
    key: String.fromCharCode(65 + i),
  }));
  return { ...item, options: shuffled };
}

export function shuffleSetOptions(items) {
  return (items ?? []).map(shuffleItemOptions);
}
