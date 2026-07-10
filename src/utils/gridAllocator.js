import { NOUN_GRID_VARIANTS } from '../constants/nounGrids.js';

/** weight 付きバリアントから1つ抽選（weight 未指定は 1） */
export function pickWeightedVariant(variants, random = Math.random) {
  const entries = Object.entries(variants);
  if (!entries.length) return null;

  const total = entries.reduce((sum, [, spec]) => sum + (spec.weight ?? 1), 0);
  let r = random() * total;
  for (const [id, spec] of entries) {
    r -= spec.weight ?? 1;
    if (r <= 0) {
      return { id, spec };
    }
  }
  const [id, spec] = entries[entries.length - 1];
  return { id, spec };
}

/** 名詞タグごとに4択グリッドのバリアントを事前抽選 */
export function allocateNounGrids(tagAllocation, random = Math.random) {
  return tagAllocation.map((tag) => {
    const variants = NOUN_GRID_VARIANTS[tag];
    if (!variants) return null;

    const picked = pickWeightedVariant(variants, random);
    if (!picked) return null;

    const { id: variant, spec } = picked;
    return {
      variant,
      patterns: [...spec.patterns],
      countability: spec.countability,
      hint: spec.note ?? spec.label,
    };
  });
}
