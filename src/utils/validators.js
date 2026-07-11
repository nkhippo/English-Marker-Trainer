import { CONTEXT_REQUIRED_TAGS } from '../constants/tags.js';
import { NOUN_LEXICAL_TAGS } from '../constants/nounGrids.js';
import { REASON_CODES } from '../constants/reasonCodes.js';
import { containsIdiom, rewriteIdiomTemplate } from '../constants/idiomBlocklist.js';
import { fallbackContextEn, allFallbackContexts } from '../constants/sceneContexts.js';
import {
  hasLemmaOverflow,
  getOverflowingLemmas,
  contextUsesLemma,
  countLemmaFrequencies,
  extractContentLemmas,
  itemContentLemmas,
} from './lemmaCounter.js';
import { expandModalOption } from './poolPicker.js';
import { lookupHeadNounJa } from '../constants/headNounJa.js';

const MODAL_TAGS = new Set(['V-MOD-DYN', 'V-MOD-DEO']);
const EPISTEMIC_JA = /きっと|確かに|に違いない|絶対/;

const DEO_LEMMA_MAP = {
  'has to': 'have to',
  'needs to': 'need to',
  'is allowed to': 'be allowed to',
  'are allowed to': 'be allowed to',
  'was allowed to': 'be allowed to',
  'were allowed to': 'be allowed to',
  'allowed to': 'be allowed to',
  'is supposed to': 'be supposed to',
  'are supposed to': 'be supposed to',
  'was supposed to': 'be supposed to',
  'were supposed to': 'be supposed to',
  'supposed to': 'be supposed to',
};

const DYN_MODAL_LEMMA_MAP = {
  'is able to': 'be able to',
  'are able to': 'be able to',
  'was able to': 'be able to',
  'were able to': 'be able to',
  'able to': 'be able to',
  'is going to': 'be going to',
  'are going to': 'be going to',
  'was going to': 'be going to',
  'were going to': 'be going to',
  'going to': 'be going to',
};

function wordCount(text) {
  if (!text) return 0;
  return (text.match(/\S+/g) ?? []).length;
}

function sortedTexts(options) {
  return options.map((o) => o.text).sort();
}

function looksLikeBaseVerbForm(text, baseVerb) {
  const t = text.trim().toLowerCase();
  const bv = baseVerb.toLowerCase();
  if (t === bv) return true;
  if (t === `${bv}s` || t === `${bv}es`) return true;
  if (bv.endsWith('y') && t === `${bv.slice(0, -1)}ies`) return true;
  if (t === `${bv}ed` || t === `${bv}d`) return true;
  if (t === `${bv}ing`) return true;
  // phrasal: "wakes up" for baseVerb "wake up"
  if (bv.includes(' ')) {
    const [head, ...rest] = bv.split(' ');
    const tail = rest.join(' ');
    if (t === `${head}s ${tail}` || t === `${head}es ${tail}`) return true;
    if (t === `${head}ed ${tail}` || t === `${head}ing ${tail}`) return true;
  }
  return false;
}

/** V-MOD-DEO: 三人称などの活用形をプールの原形に戻す */
export function modalLemmaFromDeoOption(text) {
  const t = text.trim().toLowerCase();
  return DEO_LEMMA_MAP[t] ?? t;
}

/** V-MOD-DYN: 選択肢テキストからプール候補（原形）を抽出 */
export function modalLemmaFromDynOption(optionText, baseVerb) {
  const text = optionText.trim().toLowerCase();
  const bv = (baseVerb || '').toLowerCase();
  if (!bv) return text;

  if (looksLikeBaseVerbForm(text, bv)) return '(bare)';

  let modalPart;
  if (text.endsWith(` ${bv}`)) {
    modalPart = text.slice(0, -(bv.length + 1)).trim();
  } else if (!text.includes(' ')) {
    return '(bare)';
  } else {
    const parts = text.split(' ');
    modalPart = parts.slice(0, -1).join(' ');
  }

  if (!modalPart) return '(bare)';
  return DYN_MODAL_LEMMA_MAP[modalPart] ?? modalPart;
}

/**
 * モデルが返す表層ゆれを、事前抽選 pool に揃える。
 * 正解 lemma が expectedPool に含まれる場合のみ書き換え、そうでなければそのまま返す。
 */
export function sanitizeModalPoolOptions(item, expectedPool) {
  if (!item || !MODAL_TAGS.has(item.tag) || !expectedPool?.length || !item.options?.length) {
    return item;
  }

  const expected = expectedPool.map((t) => t.trim().toLowerCase());
  const options = item.options;

  if (item.tag === 'V-MOD-DEO') {
    const lemmas = options.map((o) => modalLemmaFromDeoOption(o.text));
    if (poolSetsMatch(lemmas, expected)) {
      // 表層は許容（has to 等）。poolUsed だけ正規化
      return { ...item, poolUsed: [...expectedPool] };
    }

    const correct = options.find((o) => o.correct);
    const correctLemma = correct ? modalLemmaFromDeoOption(correct.text) : null;
    if (!correctLemma || !expected.includes(correctLemma)) return item;

    const byLemma = new Map();
    for (const opt of options) {
      byLemma.set(modalLemmaFromDeoOption(opt.text), opt);
    }

    const rebuilt = expectedPool.map((lemma, i) => {
      const key = String.fromCharCode(65 + i);
      const prev = byLemma.get(lemma.toLowerCase());
      const isCorrect = lemma.toLowerCase() === correctLemma;
      if (prev) {
        return {
          ...prev,
          key,
          text: prev.text,
          correct: isCorrect,
          reasonCode: isCorrect ? null : prev.reasonCode,
          note: isCorrect ? null : prev.note,
          appliedMeaning: isCorrect ? null : prev.appliedMeaning,
        };
      }
      return {
        key,
        text: lemma,
        correct: isCorrect,
        reasonCode: isCorrect ? null : 'V_MOD_SENSE_MISMATCH',
        note: isCorrect ? null : 'プール外の候補を置換',
        appliedMeaning: isCorrect ? null : '別の助動詞の意味になる',
      };
    });

    return { ...item, poolUsed: [...expectedPool], options: rebuilt };
  }

  // V-MOD-DYN
  if (!item.baseVerb) return item;
  const lemmas = options.map((o) => modalLemmaFromDynOption(o.text, item.baseVerb));
  if (poolSetsMatch(lemmas, expected)) {
    return { ...item, poolUsed: [...expectedPool] };
  }

  const correct = options.find((o) => o.correct);
  const correctLemma = correct
    ? modalLemmaFromDynOption(correct.text, item.baseVerb)
    : null;
  if (!correctLemma || !expected.includes(correctLemma)) return item;

  const byLemma = new Map();
  for (const opt of options) {
    byLemma.set(modalLemmaFromDynOption(opt.text, item.baseVerb), opt);
  }

  const rebuilt = expectedPool.map((lemma, i) => {
    const key = String.fromCharCode(65 + i);
    const prev = byLemma.get(lemma.toLowerCase());
    const isCorrect = lemma.toLowerCase() === correctLemma;
    const text = prev?.text && modalLemmaFromDynOption(prev.text, item.baseVerb) === lemma.toLowerCase()
      ? prev.text
      : expandModalOption('V-MOD-DYN', lemma, item.baseVerb);

    if (prev) {
      return {
        ...prev,
        key,
        text,
        correct: isCorrect,
        reasonCode: isCorrect ? null : prev.reasonCode,
        note: isCorrect ? null : prev.note,
        appliedMeaning: isCorrect ? null : prev.appliedMeaning,
      };
    }
    return {
      key,
      text,
      correct: isCorrect,
      reasonCode: isCorrect ? null : 'V_MOD_SENSE_MISMATCH',
      note: isCorrect ? null : 'プール外の候補を置換',
      appliedMeaning: isCorrect ? null : '別の助動詞の意味になる',
    };
  });

  return { ...item, poolUsed: [...expectedPool], options: rebuilt };
}

/**
 * 名詞タグの欠落フィールドを補完する（リトライなし運用向け）。
 * - 別名キーの正規化
 * - countability を事前抽選グリッド / N-QNT 正解から補完
 * - headNounJa を用語集から補完
 */
export function sanitizeNounLexicalFields(item, expectedGrid = null) {
  if (!item || !NOUN_LEXICAL_TAGS.has(item.tag)) return item;

  let next = { ...item };
  let changed = false;

  const headNoun = pickNonEmpty(next.headNoun, next.head_noun, next.noun);
  const headNounJa = pickNonEmpty(
    next.headNounJa,
    next.head_noun_ja,
    next.nounJa,
    next.headNounJA,
  );

  if (headNoun && headNoun !== next.headNoun) {
    next.headNoun = headNoun;
    changed = true;
  }
  if (headNounJa && headNounJa !== next.headNounJa) {
    next.headNounJa = headNounJa;
    changed = true;
  }

  if (!next.countability) {
    const fromGrid = expectedGrid?.countability;
    const fromQnt = item.tag === 'N-QNT' ? inferCountabilityFromQnt(next) : null;
    const fromTag = item.tag === 'N-NP' ? 'countable' : item.tag === 'N-UNC' ? 'uncountable' : null;
    const countability = fromGrid || fromQnt || fromTag;
    if (countability) {
      next.countability = countability;
      changed = true;
    }
  }

  if (!pickNonEmpty(next.headNounJa) && next.headNoun) {
    const lookedUp = lookupHeadNounJa(next.headNoun);
    if (lookedUp) {
      next.headNounJa = lookedUp;
      changed = true;
    }
  }

  if (!next.headNoun) {
    const inferred = inferHeadNounFromOptions(next);
    if (inferred) {
      next.headNoun = inferred;
      changed = true;
      if (!pickNonEmpty(next.headNounJa)) {
        const lookedUp = lookupHeadNounJa(inferred);
        if (lookedUp) next.headNounJa = lookedUp;
      }
    }
  }

  return changed ? next : item;
}

/**
 * V9/V15 向け: contextEn 欠落の補完と template 慣用句の書き換え。
 */
export function sanitizeContextAndIdiom(item, expectedScene = null) {
  if (!item) return item;

  let next = { ...item };
  let changed = false;

  const needsContext = CONTEXT_REQUIRED_TAGS.includes(next.tag);
  const contextMissing = !pickNonEmpty(next.contextEn, next.context_en, next.context);
  if (needsContext && contextMissing) {
    const sceneTag = expectedScene?.sceneTag ?? next.sceneTag;
    next.contextEn = fallbackContextEn(sceneTag);
    changed = true;
  } else if (!next.contextEn && pickNonEmpty(next.context_en, next.context)) {
    next.contextEn = pickNonEmpty(next.context_en, next.context);
    changed = true;
  }

  if (next.template && containsIdiom(next.template)) {
    const rewritten = rewriteIdiomTemplate(next.template);
    if (rewritten !== next.template) {
      next.template = rewritten;
      changed = true;
    }
  }

  return changed ? next : item;
}

/**
 * V11: contextEn を差し替えて lemma 重複を解消する（template は触らない）。
 */
export function sanitizeLemmaOverflow(items, maxCount = 2) {
  if (!Array.isArray(items) || !items.length) return items;
  if (!hasLemmaOverflow(items, maxCount)) return items;

  const pool = allFallbackContexts();
  let next = items.map((item) => ({ ...item }));

  for (let pass = 0; pass < 8; pass++) {
    const overflowing = getOverflowingLemmas(next, maxCount);
    if (!overflowing.length) return next;

    let changed = false;
    for (const lm of overflowing) {
      const idxs = [];
      for (let i = 0; i < next.length; i++) {
        if (contextUsesLemma(next[i], lm)) idxs.push(i);
      }
      // contextEn 側の余剰から潰す（先頭 maxCount 問は残す）
      for (const i of idxs.slice(maxCount)) {
        const replacement = pickContextAvoiding(next, i, pool, maxCount);
        if (replacement && replacement !== next[i].contextEn) {
          next[i] = { ...next[i], contextEn: replacement };
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  return next;
}

function pickContextAvoiding(items, index, pool, maxCount) {
  const others = items.filter((_, i) => i !== index);
  const baseFreq = countLemmaFrequencies(others);

  let best = null;
  let bestScore = Infinity;
  for (const candidate of pool) {
    const lemmas = extractContentLemmas(candidate);
    let score = 0;
    let ok = true;
    for (const lm of lemmas) {
      const nextCount = (baseFreq[lm] ?? 0) + 1;
      if (nextCount > maxCount) {
        ok = false;
        break;
      }
      score += nextCount;
    }
    // template 側の lemma とも衝突しすぎない
    const templateLemmas = itemContentLemmas({
      template: items[index].template,
      contextEn: null,
    });
    for (const lm of lemmas) {
      if (templateLemmas.has(lm)) score += 2;
    }
    if (!ok) continue;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function pickNonEmpty(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function inferCountabilityFromQnt(item) {
  const correct = item.options?.find((o) => o.correct)?.text?.trim().toLowerCase();
  if (!correct) return null;
  if (['much', 'little', 'a little'].includes(correct)) return 'uncountable';
  if (['many', 'few', 'a few'].includes(correct)) return 'countable';
  return null;
}

/** N-NP / N-UNC の選択肢から headNoun を推定（a book / some water / a cup of tea など） */
function inferHeadNounFromOptions(item) {
  const texts = (item.options ?? []).map((o) => o.text?.trim().toLowerCase()).filter(Boolean);
  if (texts.length < 2) return null;

  const stripped = texts.map((t) =>
    t
      .replace(/^(a|an|the|some|any)\s+/i, '')
      .replace(/^(cups?|glasses?|bowls?|pieces?|bottles?|slices?|loaves|loaf|bits?|pairs?)\s+of\s+/i, '')
      .replace(/'s$/i, '')
      .trim(),
  );

  const singularized = stripped.map((t) => (t.endsWith('s') && t.length > 3 ? t.slice(0, -1) : t));
  const counts = {};
  for (const s of singularized) {
    if (!s || s.includes(' ')) continue;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : null;
}

function poolSetsMatch(actual, expected) {
  const a = [...actual].sort();
  const e = [...expected].sort();
  return a.length === e.length && a.every((v, i) => v === e[i]);
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
  if (item.tag === 'V-MOD-DYN') {
    if (!item.baseVerb) return 'V13/V16: baseVerb missing for V-MOD-DYN';

    const optionLemmas = item.options.map((o) => modalLemmaFromDynOption(o.text, item.baseVerb));
    if (!poolSetsMatch(optionLemmas, meta.expectedPool)) return 'V13: pool mismatch';
    if (optionTexts.length !== 4) return 'V13: option count';
    return null;
  }

  if (item.tag === 'V-MOD-DEO') {
    const normOptions = optionTexts.map(modalLemmaFromDeoOption);
    const normExpected = meta.expectedPool.map((t) => t.trim().toLowerCase());
    if (!poolSetsMatch(normOptions, normExpected)) return 'V13: pool mismatch';
    return null;
  }

  const expected = [...meta.expectedPool].sort();
  if (JSON.stringify(optionTexts.map((t) => t.toLowerCase())) !== JSON.stringify(expected.map((t) => t.toLowerCase()))) {
    return 'V13: pool mismatch';
  }
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

function validateV17(item) {
  if (!NOUN_LEXICAL_TAGS.has(item.tag)) return null;
  if (!item.headNoun) return 'V17: headNoun required';
  // headNounJa はフィードバック用。欠落しても生成は通す（sanitize で補完を試みる）
  if (!item.countability) return 'V17: countability required';
  if (item.tag === 'N-NP' && item.countability !== 'countable') return 'V17: N-NP requires countable';
  if (item.tag === 'N-UNC' && item.countability !== 'uncountable') return 'V17: N-UNC requires uncountable';
  return null;
}

/** 助動詞の直後に過去分詞だけが続く形態不全（should known / must written 等） */
const MODAL_PREFIX =
  /^(?:should|must|can|could|will|would|may|might|shall|ought to|had better|(?:have|has|had|need|needs) to)\s+/i;

const IRREGULAR_PAST_PARTICIPLES = new Set([
  'known', 'written', 'done', 'seen', 'taken', 'given', 'made', 'built', 'spoken', 'broken',
  'chosen', 'driven', 'eaten', 'fallen', 'forgotten', 'gotten', 'hidden', 'ridden', 'risen',
  'shown', 'stolen', 'thrown', 'worn', 'won', 'begun', 'blown', 'drawn', 'flown', 'grown',
  'lain', 'sworn', 'torn', 'woken', 'bought', 'brought', 'caught', 'fought', 'taught',
  'thought', 'sought', 'found', 'bound', 'held', 'kept', 'left', 'lost', 'meant', 'met',
  'paid', 'said', 'sent', 'slept', 'sold', 'spent', 'stood', 'told', 'understood', 'felt',
  'heard', 'led', 'read', 'run', 'sung', 'sunk', 'swum', 'been', 'put', 'cut', 'hit', 'hurt',
  'let', 'set', 'shut', 'spread', 'cost',
]);

function looksLikePastParticiple(word) {
  const w = word.toLowerCase();
  if (IRREGULAR_PAST_PARTICIPLES.has(w)) return true;
  if (w.length > 3 && (w.endsWith('ed') || w.endsWith('en'))) return true;
  return false;
}

/** @returns {boolean} true if option is modal + bare past participle (missing be/have) */
export function isIllFormedModalParticiple(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim().toLowerCase();
  if (!MODAL_PREFIX.test(t)) return false;
  const rest = t.replace(MODAL_PREFIX, '').trim();
  if (/^(be|been|being|have|has|had)\b/.test(rest)) return false;
  const tokens = rest.split(/\s+/);
  return tokens.length === 1 && looksLikePastParticiple(tokens[0]);
}

function validateV18(item) {
  if (item.tag !== 'V-VOICE') return null;
  for (const opt of item.options ?? []) {
    if (isIllFormedModalParticiple(opt.text)) {
      return `V18: ill-formed modal+participle "${opt.text}"`;
    }
  }
  return null;
}

/** template で have/has/had が ___ より前にあり、完了の後続スロットを問う形か */
export function templateHasPerfectAuxBeforeBlank(template) {
  if (typeof template !== 'string') return false;
  const idx = template.indexOf('___');
  if (idx === -1) return false;
  const before = template.slice(0, idx);
  return /\b(have|has|had)\b/i.test(before);
}

/** have 後続スロットに置けない有限動詞・別助動詞句 */
const FINITE_OR_AUX_OPTION =
  /^(am|is|are|was|were|do|does|did|have|has|had|will|would|can|could|may|might|must|shall|should)\b/i;

/** @returns {boolean} true if option cannot follow have/has/had in the blank */
export function isIncompatibleAfterPerfectAux(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (!t) return false;
  // been + ... は完了進行として許容
  if (/^been\b/i.test(t)) return false;
  return FINITE_OR_AUX_OPTION.test(t);
}

function validateV19(item) {
  if (item.tag !== 'V-TA') return null;
  if (!templateHasPerfectAuxBeforeBlank(item.template)) return null;
  for (const opt of item.options ?? []) {
    if (isIncompatibleAfterPerfectAux(opt.text)) {
      return `V19: option incompatible after have/has/had "${opt.text}"`;
    }
  }
  return null;
}

function normalizeOverlapTokens(text) {
  return String(text)
    .toLowerCase()
    .replace(/___/g, ' ')
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * template の ___ 以外と option で、2語以上の連続フレーズが重複していればそのフレーズを返す
 * @returns {string|null}
 */
export function findTemplateOptionPhraseOverlap(template, optionText) {
  if (typeof template !== 'string' || typeof optionText !== 'string') return null;
  const fixedTokens = normalizeOverlapTokens(template);
  const optTokens = normalizeOverlapTokens(optionText);
  if (fixedTokens.length < 2 || optTokens.length < 2) return null;

  const optJoined = ` ${optTokens.join(' ')} `;
  const maxN = Math.min(fixedTokens.length, optTokens.length, 6);
  for (let n = maxN; n >= 2; n--) {
    for (let i = 0; i <= fixedTokens.length - n; i++) {
      const phrase = fixedTokens.slice(i, i + n).join(' ');
      if (optJoined.includes(` ${phrase} `)) return phrase;
    }
  }
  return null;
}

function validateV20(item) {
  for (const opt of item.options ?? []) {
    const overlap = findTemplateOptionPhraseOverlap(item.template, opt.text);
    if (overlap) {
      return `V20: template/option phrase overlap "${overlap}" in "${opt.text}"`;
    }
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
  validateV17,
  validateV18,
  validateV19,
  validateV20,
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

const NOTE_MAX_LEN = 40;

function truncateNote(note) {
  if (typeof note !== 'string' || note.length <= NOTE_MAX_LEN) return note;
  const sliced = note.slice(0, NOTE_MAX_LEN);
  const breakAt = Math.max(sliced.lastIndexOf('、'), sliced.lastIndexOf('。'), sliced.lastIndexOf(' '));
  if (breakAt >= 20) return sliced.slice(0, breakAt).trim();
  return sliced.trim();
}

/** reasonCode の範囲外置換 + note の40字超過を切り詰め */
export function sanitizeItemReasonCodes(item) {
  if (!item?.options) return item;

  const allowedForTag = Object.keys(REASON_CODES).filter(
    (code) => REASON_CODES[code].allowedTags.includes(item.tag),
  );
  const fallback = allowedForTag[0] ?? null;

  let changed = false;
  const options = item.options.map((opt) => {
    let next = opt;

    if (!opt.correct && opt.reasonCode && fallback && !allowedForTag.includes(opt.reasonCode)) {
      next = { ...next, reasonCode: fallback };
      changed = true;
    }

    if (opt.note && opt.note.length > NOTE_MAX_LEN) {
      next = { ...next, note: truncateNote(opt.note) };
      changed = true;
    }

    return next;
  });

  return changed ? { ...item, options } : item;
}
