import { CONTEXT_REQUIRED_TAGS } from '../constants/tags.js';
import { REASON_CODES } from '../constants/reasonCodes.js';
import { containsIdiom } from '../constants/idiomBlocklist.js';
import { hasLemmaOverflow } from './lemmaCounter.js';
import { expandModalPool } from './poolPicker.js';

const MODAL_TAGS = new Set(['V-MOD-DYN', 'V-MOD-DEO']);
const EPISTEMIC_JA = /きっと|確かに|に違いない|絶対/;

function wordCount(text) {
  if (!text) return 0;
  return (text.match(/\S+/g) ?? []).length;
}

function sortedTexts(options) {
  return options.map((o) => o.text).sort();
}

function validateV2(item) {
  if (item.options?.length !== 4) return 'V2: options.length !== 4';
  const texts = item.options.map((o) => o.text);
  if (new Set(texts).size !== texts.length) return 'V2: duplicate option text';
  return null;
}

function validateV3(item) {
  const correctCount = item.options?.filter((o) => o.correct).length ?? 0;
  if (correctCount !== 1) return 'V3: correct count !== 1';
  return null;
}

function validateV4(item) {
  const wrong = item.options?.filter((o) => !o.correct) ?? [];
  for (const opt of wrong) {
    if (!opt.reasonCode || !opt.appliedMeaning) return 'V4: missing reasonCode or appliedMeaning';
    if (opt.note && opt.note.length > 40) return 'V4: note exceeds 40 chars';
  }
  return null;
}

function validateV5(item) {
  for (const opt of item.options ?? []) {
    if (opt.correct) continue;
    const allowed = REASON_CODES[opt.reasonCode]?.allowedTags;
    if (!allowed?.includes(item.tag)) return `V5: reasonCode ${opt.reasonCode} not allowed for ${item.tag}`;
  }
  return null;
}

function validateV6(item) {
  const blanks = item.template?.match(/___/g) ?? [];
  if (blanks.length !== 1) return 'V6: template must have exactly one ___';
  return null;
}

function validateV7(item, meta) {
  if (item.tag !== meta.expectedTag) return 'V7: tag mismatch';
  return null;
}

function validateV8(item, meta) {
  if (item.sceneTag !== meta.expectedScene.sceneTag) return 'V8: sceneTag mismatch';
  if (item.functionTag !== meta.expectedScene.functionTag) return 'V8: functionTag mismatch';
  return null;
}

function validateV9(item) {
  if (CONTEXT_REQUIRED_TAGS.includes(item.tag) && !item.contextEn) return 'V9: contextEn required';
  return null;
}

function validateV10(item) {
  if (wordCount(item.template) > 12) return 'V10: template > 12 words';
  if (item.contextEn && wordCount(item.contextEn) > 10) return 'V10: contextEn > 10 words';
  return null;
}

function validateV13(item, meta) {
  if (!MODAL_TAGS.has(item.tag)) return null;
  if (!meta.expectedPool) return 'V13: expectedPool missing';

  const optionTexts = sortedTexts(item.options);
  let expected;
  if (item.tag === 'V-MOD-DYN') {
    if (!item.baseVerb) return 'V13/V16: baseVerb missing for V-MOD-DYN';
    expected = expandModalPool(item.tag, meta.expectedPool, item.baseVerb);
    // (bare) expands to baseVerb lemma; options for bare are conjugated forms — compare via suffix
    const normalizedExpected = meta.expectedPool.map((c) =>
      c === '(bare)' ? null : `${c} ${item.baseVerb}`,
    );
    const normalizedOptions = item.options.map((o) => {
      const text = o.text.toLowerCase();
      const bv = item.baseVerb.toLowerCase();
      if (text === bv || text.endsWith(` ${bv}`) || text.endsWith(bv)) return o.text;
      return o.text;
    });
    // For V-MOD-DYN, verify each pool candidate maps to exactly one option
    for (const candidate of meta.expectedPool) {
      if (candidate === '(bare)') {
        const hasBare = item.options.some(
          (o) => o.text.toLowerCase().includes(item.baseVerb.toLowerCase()) && !o.text.includes(' '),
        );
        if (!hasBare) return 'V13: missing (bare) conjugated option';
      } else {
        const phrase = `${candidate} ${item.baseVerb}`.toLowerCase();
        if (!item.options.some((o) => o.text.toLowerCase() === phrase)) {
          return `V13: missing option for ${candidate}`;
        }
      }
    }
    if (optionTexts.length !== 4) return 'V13: option count';
    return null;
  }

  expected = [...meta.expectedPool].sort();
  if (item.tag === 'V-MOD-DEO') {
    const normalize = (t) => t.replace(/^has to$/i, 'have to');
    const normOptions = optionTexts.map(normalize).sort();
    const normExpected = expected.map(normalize).sort();
    if (JSON.stringify(normOptions) !== JSON.stringify(normExpected)) return 'V13: pool mismatch';
    return null;
  }

  if (JSON.stringify(optionTexts) !== JSON.stringify(expected)) return 'V13: pool mismatch';
  return null;
}

function validateV14(item) {
  if (item.tag === 'V-MOD-DEO' && EPISTEMIC_JA.test(item.ja)) return 'V14: epistemic ja for V-MOD-DEO';
  return null;
}

function validateV15(item) {
  if (containsIdiom(item.template)) return 'V15: idiom in template';
  return null;
}

function validateV16(item) {
  if (item.tag !== 'V-MOD-DYN') return null;
  if (!item.baseVerb) return 'V16: baseVerb missing';
  const bv = item.baseVerb.toLowerCase();
  for (const opt of item.options ?? []) {
    const text = opt.text.toLowerCase();
    if (!text.includes(bv)) return `V16: option "${opt.text}" missing baseVerb`;
  }
  return null;
}

const ITEM_VALIDATORS = [
  validateV2,
  validateV3,
  validateV4,
  validateV5,
  validateV6,
  validateV7,
  validateV8,
  validateV9,
  validateV10,
  validateV13,
  validateV14,
  validateV15,
  validateV16,
];

/**
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateItem(item, meta) {
  const errors = [];
  for (const fn of ITEM_VALIDATORS) {
    const err = fn(item, meta);
    if (err) errors.push(err);
  }
  return { valid: errors.length === 0, errors };
}

export function validateV1(set) {
  return set.items?.length === 10 ? null : 'V1: items.length !== 10';
}

export function validateV11(set) {
  return hasLemmaOverflow(set.items ?? []) ? 'V11: lemma overflow' : null;
}

export function validateV12(set) {
  const counts = {};
  for (const item of set.items ?? []) {
    counts[item.sceneTag] = (counts[item.sceneTag] ?? 0) + 1;
    if (counts[item.sceneTag] > 2) return 'V12: sceneTag overflow';
  }
  return null;
}

export function validateSet(set) {
  const errors = [validateV1(set), validateV11(set), validateV12(set)].filter(Boolean);
  return { valid: errors.length === 0, errors };
}

export function validateItemQuick(item, meta) {
  return validateItem(item, meta).valid;
}
