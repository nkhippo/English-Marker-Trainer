import { MODAL_POOLS } from '../constants/modalPools.js';
import { isModalTag } from './tagAllocator.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** V-MOD-* の候補プールから4つを均等抽選 */
export function pickModalPool(tag) {
  const pool = MODAL_POOLS[tag];
  if (!pool) throw new Error(`Unknown modal tag: ${tag}`);
  return shuffle(pool).slice(0, 4).sort();
}

/**
 * tagAllocation に基づき、各問の poolUsed を事前抽選（非モーダルは null）
 */
export function allocateModalPools(tagAllocation) {
  return tagAllocation.map((tag) => (isModalTag(tag) ? pickModalPool(tag) : null));
}

/**
 * V-MOD-DYN: pool候補を動詞句に展開（§5.6.1）
 * (bare) は検証時に baseVerb の活用形と照合するため、ここではプレースホルダとして baseVerb を返す
 */
export function expandModalOption(tag, candidate, baseVerb) {
  if (tag === 'V-MOD-DEO') return candidate;
  if (tag !== 'V-MOD-DYN') return candidate;
  if (candidate === '(bare)') return baseVerb;
  return `${candidate} ${baseVerb}`;
}

export function expandModalPool(tag, pool, baseVerb) {
  if (tag !== 'V-MOD-DYN' || !baseVerb) return [...pool].sort();
  return pool.map((c) => expandModalOption(tag, c, baseVerb)).sort();
}
