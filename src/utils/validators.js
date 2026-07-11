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

  // 疑問倒置: Are you going to study / Will you study / Do you study
  const inv = text.match(
    /^(am|is|are|was|were|do|does|did|have|has|had|will|would|can|could|may|might|must)\s+(i|you|he|she|it|we|they)\s+(.+)$/i,
  );
  if (inv) {
    const aux = inv[1].toLowerCase();
    const rest = inv[3].trim();
    if (/^(do|does|did)$/.test(aux) && (rest === bv || looksLikeBaseVerbForm(rest, bv))) {
      return '(bare)';
    }
    if (/^(am|is|are|was|were)$/.test(aux)) {
      return modalLemmaFromDynOption(rest, baseVerb);
    }
    if (rest === bv || looksLikeBaseVerbForm(rest, bv)) {
      return DYN_MODAL_LEMMA_MAP[aux] ?? aux;
    }
    return modalLemmaFromDynOption(`${aux} ${rest}`, baseVerb);
  }

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
 * モデルが返す表層ゆれ・プール外候補を、事前抽選 pool に強制整列する。
 * 正解 lemma が pool 外でも、pool 内の最有力候補（または先頭）を正解にして再構築する。
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
      return { ...item, poolUsed: [...expectedPool] };
    }

    const correctLemma = pickCorrectLemmaInPool(
      options,
      expected,
      (text) => modalLemmaFromDeoOption(text),
    );

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
          reasonCode: isCorrect ? null : (prev.reasonCode || 'V_MOD_SENSE_MISMATCH'),
          note: isCorrect ? null : (prev.note || 'プール外の候補を置換'),
          appliedMeaning: isCorrect ? null : (prev.appliedMeaning || '別の助動詞の意味になる'),
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
  let baseVerb = item.baseVerb?.trim() || inferDynBaseVerb(options);
  if (!baseVerb) return item;
  baseVerb = normalizeDynBaseVerb(baseVerb);

  // モデルの baseVerb と選択肢の動詞が食い違う場合は、選択肢側を優先して推定し直す
  const matchingCount = options.filter((o) => dynOptionUsesBaseVerb(o.text, baseVerb)).length;
  if (matchingCount < 2) {
    const inferred = inferDynBaseVerb(options);
    if (inferred) baseVerb = inferred;
  }

  const lemmas = options.map((o) => modalLemmaFromDynOption(o.text, baseVerb));
  const poolOk = poolSetsMatch(lemmas, expected);
  const baseVerbOk = options.every((o) => dynOptionUsesBaseVerb(o.text, baseVerb));
  if (poolOk && baseVerbOk) {
    return { ...item, baseVerb, poolUsed: [...expectedPool] };
  }

  const correctLemma = pickCorrectLemmaInPool(
    options,
    expected,
    (text) => modalLemmaFromDynOption(text, baseVerb),
  );

  const byLemma = new Map();
  for (const opt of options) {
    const lemma = modalLemmaFromDynOption(opt.text, baseVerb);
    // 別動詞の (bare) などは採用しない（carries vs bring 等）
    if (dynOptionUsesBaseVerb(opt.text, baseVerb)) {
      byLemma.set(lemma, opt);
    }
  }

  const rebuilt = expectedPool.map((lemma, i) => {
    const key = String.fromCharCode(65 + i);
    const prev = byLemma.get(lemma.toLowerCase());
    const isCorrect = lemma.toLowerCase() === correctLemma;
    const text = prev?.text && dynOptionUsesBaseVerb(prev.text, baseVerb)
      ? prev.text
      : expandModalOption('V-MOD-DYN', lemma, baseVerb);

    if (prev) {
      return {
        ...prev,
        key,
        text,
        correct: isCorrect,
        reasonCode: isCorrect ? null : (prev.reasonCode || 'V_MOD_SENSE_MISMATCH'),
        note: isCorrect ? null : (prev.note || 'プール外の候補を置換'),
        appliedMeaning: isCorrect ? null : (prev.appliedMeaning || '別の助動詞の意味になる'),
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

  return { ...item, baseVerb, poolUsed: [...expectedPool], options: rebuilt };
}

/** 選択肢テキストが baseVerb（またはその活用）を含むか */
export function dynOptionUsesBaseVerb(text, baseVerb) {
  if (typeof text !== 'string' || !baseVerb) return false;
  const t = text.trim().toLowerCase();
  const bv = baseVerb.trim().toLowerCase();
  if (t.includes(bv)) return true;
  return looksLikeBaseVerbForm(t, bv);
}

function normalizeDynBaseVerb(baseVerb) {
  let v = String(baseVerb).trim().toLowerCase();
  // carries → carry / finishes → finish（単一語の三単現を原形へ）
  if (!v.includes(' ')) {
    if (v.endsWith('ies') && v.length > 4) v = `${v.slice(0, -3)}y`;
    else if (v.endsWith('es') && /(ch|sh|ss|x|z|o)$/.test(v.slice(0, -2))) v = v.slice(0, -2);
    else if (v.endsWith('s') && v.length > 3 && !v.endsWith('ss')) v = v.slice(0, -1);
  }
  return v;
}

/** 正解が pool 内ならそれを使い、外なら options 中の pool 内 lemma、それも無ければ pool 先頭 */
function pickCorrectLemmaInPool(options, expectedLower, lemmaOf) {
  const correct = options.find((o) => o.correct);
  const correctLemma = correct ? lemmaOf(correct.text) : null;
  if (correctLemma && expectedLower.includes(correctLemma)) return correctLemma;

  for (const opt of options) {
    const lemma = lemmaOf(opt.text);
    if (expectedLower.includes(lemma)) return lemma;
  }
  return expectedLower[0];
}

/** baseVerb 欠落時、正解または多数派の末尾動詞を推定 */
function inferDynBaseVerb(options) {
  const list = options ?? [];
  const correct = list.find((o) => o.correct);
  const ordered = correct ? [correct, ...list.filter((o) => o !== correct)] : list;
  const tails = ordered
    .map((o) => String(o.text ?? '').trim().toLowerCase())
    .filter(Boolean)
    .map((t) => t.split(/\s+/).pop());
  if (!tails.length) return null;

  // 正解の末尾を優先
  if (correct) {
    const fromCorrect = normalizeDynBaseVerb(tails[0]);
    if (fromCorrect) return fromCorrect;
  }

  const counts = {};
  for (const t of tails) {
    const n = normalizeDynBaseVerb(t);
    counts[n] = (counts[n] ?? 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? null;
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
 * V9/V10/V15 向け: contextEn 欠落の補完、語数超過の切り詰め、template 慣用句の書き換え。
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

  if (next.contextEn && wordCount(next.contextEn) > 10) {
    next.contextEn = truncateToWordLimit(next.contextEn, 10);
    changed = true;
  }

  if (next.template && containsIdiom(next.template)) {
    const rewritten = rewriteIdiomTemplate(next.template);
    if (rewritten !== next.template) {
      next.template = rewritten;
      changed = true;
    }
  }

  if (next.template && wordCount(next.template) > 12) {
    const truncated = truncateTemplatePreservingBlank(next.template, 12);
    if (truncated !== next.template) {
      next.template = truncated;
      changed = true;
    }
  }

  return changed ? next : item;
}

/** 先頭 maxWords 語に切り詰め（空白区切り） */
export function truncateToWordLimit(text, maxWords) {
  if (typeof text !== 'string') return text;
  const words = text.trim().match(/\S+/g) ?? [];
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ');
}

/** ___ を残しつつ template を maxWords 語以内に収める */
export function truncateTemplatePreservingBlank(template, maxWords = 12) {
  if (typeof template !== 'string') return template;
  const words = template.trim().match(/\S+/g) ?? [];
  if (words.length <= maxWords) return template.trim();

  const blankIdx = words.findIndex((w) => w.includes('___'));
  if (blankIdx === -1) return words.slice(0, maxWords).join(' ');

  const keep = Math.min(words.length, maxWords);
  let start = Math.max(0, blankIdx - Math.floor((keep - 1) / 2));
  if (start + keep > words.length) start = words.length - keep;
  start = Math.max(0, start);
  let slice = words.slice(start, start + keep);
  if (!slice.some((w) => w.includes('___'))) {
    start = Math.max(0, Math.min(blankIdx, words.length - keep));
    slice = words.slice(start, start + keep);
  }
  return slice.join(' ');
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

/** V19 は削除済み（V-TA を (A) 一本化したため。(B) have-outside-blank 前提の検証だった） */

const V_TA_FINITE_OPS = /\b(do|does|did|have|has|had|is|are|was|were|am)\b/i;

/**
 * V21: V-TA では時制の担い手（有限の助動詞・be動詞）が options の少なくとも1つに含まれること。
 * template に did/have/was 等が漏れている問題を、options 側必須で検出する。
 */
export function optionsHaveTaFiniteOperator(item) {
  return (item.options ?? []).some((o) => V_TA_FINITE_OPS.test(o.text ?? ''));
}

function validateV21(item) {
  if (item.tag !== 'V-TA') return null;
  if (!optionsHaveTaFiniteOperator(item)) {
    return 'V21: V-TA options missing finite operator (do/does/did/have/has/had/is/are/was/were/am)';
  }
  return null;
}

/** 動詞・助動詞・一致系（名詞は Is there ___ 等があるため除外） */
const SLOT_LOCK_TAGS = new Set([
  'V-TA', 'V-VOICE', 'V-MOD-DYN', 'V-MOD-DEO', 'M-AGR', 'M-SEQ', 'M-PRON-NUM', 'M-PRON-CASE',
]);

/**
 * ___ 直前のスロット固定助動詞（Are you ___ / Did he ___ / Have they ___ 等）
 * @returns {{ aux: string, pronoun: string|null, matched: string }|null}
 */
export function findSlotLockingAuxBeforeBlank(template) {
  if (typeof template !== 'string') return null;
  const idx = template.indexOf('___');
  if (idx === -1) return null;
  const before = template.slice(0, idx);
  const m = before.match(/\b(am|is|are|was|were|do|does|did|have|has|had)(?:\s+(i|you|he|she|it|we|they))?\s*$/i);
  if (!m) return null;
  return {
    aux: m[1].toLowerCase(),
    pronoun: m[2] ? m[2].toLowerCase() : null,
    matched: m[0],
  };
}

const BE_FORMS = { am: 'Am', is: 'Is', are: 'Are', was: 'Was', were: 'Were' };
const DO_FORMS = {
  am: 'Do', is: 'Does', are: 'Do', was: 'Did', were: 'Did', do: 'Do', does: 'Does', did: 'Did',
};

function capitalizeWord(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** スロット固定を外したあと、選択肢を疑問倒置ユニットへ持ち上げる */
export function liftDynOptionPastLock(text, baseVerb, aux, pronoun) {
  const t = String(text ?? '').trim();
  const p = pronoun || 'you';
  if (/^(am|is|are|was|were|do|does|did|have|has|had|will|would|can|could|may|might|must)\s+(i|you|he|she|it|we|they)\b/i.test(t)) {
    return t;
  }
  const lemma = modalLemmaFromDynOption(t, baseVerb);
  const bv = baseVerb;
  if (lemma === 'be going to') {
    return `${BE_FORMS[aux] || 'Are'} ${p} going to ${bv}`;
  }
  if (lemma === 'be able to') {
    return `${BE_FORMS[aux] || 'Are'} ${p} able to ${bv}`;
  }
  if (lemma === '(bare)') {
    return `${DO_FORMS[aux] || 'Do'} ${p} ${bv}`;
  }
  return `${capitalizeWord(lemma)} ${p} ${bv}`;
}

/**
 * Are you ___ / Did you ___ 等のスロット固定を解消し、aux(+代名詞)を選択肢側へ移す。
 * 自動持ち上げは V-MOD-DYN のみ（プール構造が明確なため）。他タグは V22 で再生成促す。
 */
export function sanitizeSlotLockingBlank(item) {
  if (!item || item.tag !== 'V-MOD-DYN' || !item.baseVerb || !Array.isArray(item.options)) {
    return item;
  }
  const lock = findSlotLockingAuxBeforeBlank(item.template);
  if (!lock) return item;

  const escaped = lock.matched.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const newTemplate = item.template
    .replace(new RegExp(`\\b${escaped}\\s*(?=___)`, 'i'), '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const pronoun = lock.pronoun || 'you';
  const options = item.options.map((opt) => ({
    ...opt,
    text: liftDynOptionPastLock(opt.text, item.baseVerb, lock.aux, pronoun),
  }));
  return { ...item, template: newTemplate, options };
}

function validateV22(item) {
  if (!SLOT_LOCK_TAGS.has(item.tag)) return null;
  const lock = findSlotLockingAuxBeforeBlank(item.template);
  if (!lock) return null;
  return `V22: slot-locking aux before blank "${lock.matched.trim()}"`;
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
  validateV20,
  validateV21,
  validateV22,
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
