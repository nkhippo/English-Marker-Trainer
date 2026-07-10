import { NOUN_GRID_VARIANTS } from '../constants/nounGrids.js';

/** 名詞タグごとに4択グリッドのバリアントを事前抽選 */
export function allocateNounGrids(tagAllocation) {
  return tagAllocation.map((tag) => {
    const variants = NOUN_GRID_VARIANTS[tag];
    if (!variants) return null;

    const keys = Object.keys(variants);
    const variant = keys[Math.floor(Math.random() * keys.length)];
    const spec = variants[variant];
    return {
      variant,
      patterns: [...spec.patterns],
      countability: spec.countability,
      hint: spec.note ?? spec.label,
    };
  });
}
