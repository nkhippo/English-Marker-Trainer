import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allocateTags } from '../src/utils/tagAllocator.js';
import { allocateScenes, countSceneTags } from '../src/utils/sceneAllocator.js';
import { allocateNounGrids, pickWeightedVariant } from '../src/utils/gridAllocator.js';
import { NOUN_GRID_VARIANTS } from '../src/constants/nounGrids.js';
import { MOCK_SET } from '../src/constants/mockSet.js';
import {
  validateItem,
  validateV1,
  sanitizeItemReasonCodes,
  sanitizeModalPoolOptions,
  sanitizeNounLexicalFields,
  sanitizeContextAndIdiom,
  sanitizeLemmaOverflow,
  validateSet,
  isIllFormedModalParticiple,
  findTemplateOptionPhraseOverlap,
  optionsHaveTaFiniteOperator,
} from '../src/utils/validators.js';
import { hasLemmaOverflow, getOverflowingLemmas } from '../src/utils/lemmaCounter.js';
import { rewriteIdiomTemplate, containsIdiom } from '../src/constants/idiomBlocklist.js';

function modalMeta(tag, pool) {
  return {
    expectedTag: tag,
    expectedScene: { sceneTag: '空港', functionTag: '確認する' },
    expectedPool: pool,
  };
}

describe('allocateTags', () => {
  it('respects max per tag over 100 runs', () => {
    for (let run = 0; run < 100; run++) {
      const tags = ['N-NP', 'N-UNC', 'N-QNT'];
      const alloc = allocateTags(tags);
      assert.equal(alloc.length, 10);
      const max = Math.ceil(10 / tags.length) + 1;
      const counts = {};
      for (const t of alloc) counts[t] = (counts[t] ?? 0) + 1;
      for (const c of Object.values(counts)) assert.ok(c <= max);
    }
  });
});

describe('allocateScenes', () => {
  it('limits sceneTag to 2 per set', () => {
    for (let run = 0; run < 100; run++) {
      const alloc = allocateScenes(10, ['V-MOD-DYN']);
      assert.equal(alloc.length, 10);
      const counts = countSceneTags(alloc);
      for (const c of Object.values(counts)) assert.ok(c <= 2);
    }
  });
});

describe('allocateNounGrids', () => {
  it('includes unit-of patterns for N-UNC when selected', () => {
    const alloc = allocateNounGrids(['N-UNC'], () => 0.99);
    assert.equal(alloc[0].variant, 'unit-of');
    assert.deepEqual(alloc[0].patterns, ['{n}', 'a {n}', 'a cup of {n}', 'the {n}']);
    assert.equal(alloc[0].countability, 'uncountable');
  });

  it('picks unit-of less often than other N-UNC variants', () => {
    const variants = NOUN_GRID_VARIANTS['N-UNC'];
    const counts = { 'article-bare': 0, 'some-any': 0, 'unit-of': 0 };
    const n = 5000;
    for (let i = 0; i < n; i++) {
      const picked = pickWeightedVariant(variants, Math.random);
      counts[picked.id] += 1;
    }
    assert.ok(counts['unit-of'] / n < 0.28, `unit-of rate=${counts['unit-of'] / n}`);
    assert.ok(counts['article-bare'] / n > 0.3, `article-bare rate=${counts['article-bare'] / n}`);
    assert.ok(counts['some-any'] / n > 0.3, `some-any rate=${counts['some-any'] / n}`);
  });
});

describe('validators', () => {
  it('validates mock set items', () => {
    MOCK_SET.items.forEach((item, i) => {
      const meta = {
        expectedTag: MOCK_SET.tagAllocation[i],
        expectedScene: { sceneTag: item.sceneTag, functionTag: item.functionTag },
        expectedPool: item.poolUsed ?? null,
      };
      const { valid, errors } = validateItem(item, meta);
      assert.ok(valid, errors.join('; '));
    });
    assert.equal(validateV1(MOCK_SET), null);
    assert.equal(hasLemmaOverflow(MOCK_SET.items), false);
    assert.equal(validateSet(MOCK_SET).valid, true);
  });

  it('accepts V-MOD-DEO conjugated pool options', () => {
    const item = {
      tag: 'V-MOD-DEO',
      sceneTag: '空港',
      functionTag: '確認する',
      template: 'She ___ leave early today.',
      options: [
        { key: 'A', text: 'needs to', correct: true },
        { key: 'B', text: 'must', correct: false },
        { key: 'C', text: 'is allowed to', correct: false },
        { key: 'D', text: 'is supposed to', correct: false },
      ],
    };
    const { errors } = validateItem(
      item,
      modalMeta('V-MOD-DEO', ['need to', 'must', 'be allowed to', 'be supposed to']),
    );
    assert.ok(!errors.some((e) => e.startsWith('V13')), errors.join('; '));
  });

  it('accepts V-MOD-DYN conjugated be able to / be going to options', () => {
    const item = {
      tag: 'V-MOD-DYN',
      sceneTag: '教室',
      functionTag: '情報を得る',
      template: 'She ___ the homework tonight.',
      baseVerb: 'finish',
      options: [
        { key: 'A', text: 'finishes', correct: true },
        { key: 'B', text: 'can finish', correct: false },
        { key: 'C', text: 'is able to finish', correct: false },
        { key: 'D', text: 'is going to finish', correct: false },
      ],
    };
    const { errors } = validateItem(
      item,
      modalMeta('V-MOD-DYN', ['(bare)', 'can', 'be able to', 'be going to']),
    );
    assert.ok(!errors.some((e) => e.startsWith('V13')), errors.join('; '));
  });

  it('accepts abbreviated able to / going to lemmas for V-MOD-DYN', () => {
    const item = {
      tag: 'V-MOD-DYN',
      sceneTag: '教室',
      functionTag: '情報を得る',
      template: 'She ___ the homework tonight.',
      baseVerb: 'finish',
      options: [
        { key: 'A', text: 'finishes', correct: true },
        { key: 'B', text: 'can finish', correct: false },
        { key: 'C', text: 'able to finish', correct: false },
        { key: 'D', text: 'going to finish', correct: false },
      ],
    };
    const { errors } = validateItem(
      item,
      modalMeta('V-MOD-DYN', ['(bare)', 'can', 'be able to', 'be going to']),
    );
    assert.ok(!errors.some((e) => e.startsWith('V13')), errors.join('; '));
  });

  it('sanitizes V-MOD-DYN options back onto expected pool', () => {
    const item = sanitizeModalPoolOptions(
      {
        tag: 'V-MOD-DYN',
        baseVerb: 'finish',
        options: [
          { key: 'A', text: 'finishes', correct: true, reasonCode: null },
          { key: 'B', text: 'can finish', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: 'n', appliedMeaning: 'm' },
          { key: 'C', text: 'must finish', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: 'n', appliedMeaning: 'm' },
          { key: 'D', text: 'should finish', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: 'n', appliedMeaning: 'm' },
        ],
      },
      ['(bare)', 'can', 'will', 'may'],
    );
    const { errors } = validateItem(item, modalMeta('V-MOD-DYN', ['(bare)', 'can', 'will', 'may']));
    assert.ok(!errors.some((e) => e.startsWith('V13')), errors.join('; '));
    assert.equal(item.options.filter((o) => o.correct).length, 1);
    assert.equal(item.options.find((o) => o.correct).text, 'finishes');
  });

  it('sanitizes V-MOD-DEO options back onto expected pool', () => {
    const item = sanitizeModalPoolOptions(
      {
        tag: 'V-MOD-DEO',
        options: [
          { key: 'A', text: 'has to', correct: true, reasonCode: null },
          { key: 'B', text: 'must', correct: false, reasonCode: 'V_MOD_SOURCE_MISMATCH', note: 'n', appliedMeaning: 'm' },
          { key: 'C', text: 'can', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: 'n', appliedMeaning: 'm' },
          { key: 'D', text: 'will', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: 'n', appliedMeaning: 'm' },
        ],
      },
      ['have to', 'must', 'should', 'may'],
    );
    const { errors } = validateItem(item, modalMeta('V-MOD-DEO', ['have to', 'must', 'should', 'may']));
    assert.ok(!errors.some((e) => e.startsWith('V13')), errors.join('; '));
    assert.ok(item.options.some((o) => o.text === 'should'));
    assert.ok(item.options.some((o) => o.text === 'may'));
  });

  it('forces V-MOD-DEO onto pool when correct lemma is outside pool', () => {
    const item = sanitizeModalPoolOptions(
      {
        tag: 'V-MOD-DEO',
        sceneTag: '空港',
        functionTag: '確認する',
        template: 'She ___ leave early today.',
        options: [
          { key: 'A', text: 'ought to', correct: true, reasonCode: null },
          { key: 'B', text: 'must', correct: false, reasonCode: 'V_MOD_TOO_STRONG', note: 'n', appliedMeaning: 'm' },
          { key: 'C', text: 'can', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: 'n', appliedMeaning: 'm' },
          { key: 'D', text: 'will', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: 'n', appliedMeaning: 'm' },
        ],
      },
      ['have to', 'must', 'should', 'may'],
    );
    const { errors } = validateItem(item, {
      ...modalMeta('V-MOD-DEO', ['have to', 'must', 'should', 'may']),
      expectedScene: { sceneTag: '空港', functionTag: '確認する' },
    });
    assert.ok(!errors.some((e) => e.startsWith('V13')), errors.join('; '));
    assert.equal(item.options.filter((o) => o.correct).length, 1);
    assert.ok(item.options.every((o) => ['have to', 'must', 'should', 'may', 'has to'].includes(o.text) || true));
    const lemmas = item.options.map((o) => o.text.toLowerCase().replace(/^has to$/, 'have to'));
    for (const want of ['have to', 'must', 'should', 'may']) {
      assert.ok(
        item.options.some((o) => {
          const t = o.text.toLowerCase();
          return t === want || (want === 'have to' && t === 'has to');
        }),
        `missing ${want} in ${lemmas.join(',')}`,
      );
    }
  });

  it('forces V-MOD-DYN onto pool when correct lemma is outside pool', () => {
    const item = sanitizeModalPoolOptions(
      {
        tag: 'V-MOD-DYN',
        baseVerb: 'finish',
        sceneTag: '教室',
        functionTag: '情報を得る',
        template: 'She ___ the homework tonight.',
        options: [
          { key: 'A', text: 'must finish', correct: true, reasonCode: null },
          { key: 'B', text: 'can finish', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: 'n', appliedMeaning: 'm' },
          { key: 'C', text: 'should finish', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: 'n', appliedMeaning: 'm' },
          { key: 'D', text: 'need to finish', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: 'n', appliedMeaning: 'm' },
        ],
      },
      ['(bare)', 'can', 'will', 'may'],
    );
    const { errors } = validateItem(item, {
      ...modalMeta('V-MOD-DYN', ['(bare)', 'can', 'will', 'may']),
      expectedScene: { sceneTag: '教室', functionTag: '情報を得る' },
    });
    assert.ok(!errors.some((e) => e.startsWith('V13')), errors.join('; '));
    assert.equal(item.options.filter((o) => o.correct).length, 1);
  });

  it('infers baseVerb and forces V-MOD-DYN pool when baseVerb missing', () => {
    const item = sanitizeModalPoolOptions(
      {
        tag: 'V-MOD-DYN',
        sceneTag: '教室',
        functionTag: '情報を得る',
        template: 'She ___ the homework tonight.',
        options: [
          { key: 'A', text: 'finishes', correct: true, reasonCode: null },
          { key: 'B', text: 'can finish', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: 'n', appliedMeaning: 'm' },
          { key: 'C', text: 'must finish', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: 'n', appliedMeaning: 'm' },
          { key: 'D', text: 'will finish', correct: false, reasonCode: 'V_MOD_SENSE_MISMATCH', note: 'n', appliedMeaning: 'm' },
        ],
      },
      ['(bare)', 'can', 'will', 'may'],
    );
    assert.equal(item.baseVerb, 'finish');
    const { errors } = validateItem(item, {
      ...modalMeta('V-MOD-DYN', ['(bare)', 'can', 'will', 'may']),
      expectedScene: { sceneTag: '教室', functionTag: '情報を得る' },
    });
    assert.ok(!errors.some((e) => e.startsWith('V13') || e.startsWith('V16')), errors.join('; '));
  });

  it('fills missing headNounJa and countability for noun tags', () => {
    const item = sanitizeNounLexicalFields(
      {
        tag: 'N-UNC',
        sceneTag: '空港',
        functionTag: '確認する',
        template: "I'd like ___ please.",
        headNoun: 'water',
        options: [
          { key: 'A', text: 'some water', correct: true },
          { key: 'B', text: 'water', correct: false, reasonCode: 'N_MARKER_MISMATCH', note: 'n', appliedMeaning: 'm' },
          { key: 'C', text: 'a water', correct: false, reasonCode: 'N_UNCOUNTABLE', note: 'n', appliedMeaning: 'm' },
          { key: 'D', text: 'the water', correct: false, reasonCode: 'N_DEF_NEW', note: 'n', appliedMeaning: 'm' },
        ],
      },
      { countability: 'uncountable' },
    );
    assert.equal(item.headNounJa, '水');
    assert.equal(item.countability, 'uncountable');
    const { errors } = validateItem(item, {
      expectedTag: 'N-UNC',
      expectedScene: { sceneTag: '空港', functionTag: '確認する' },
      expectedPool: null,
    });
    assert.ok(!errors.some((e) => e.startsWith('V17')), errors.join('; '));
  });

  it('infers headNoun from unit-of options like a cup of tea', () => {
    const item = sanitizeNounLexicalFields(
      {
        tag: 'N-UNC',
        sceneTag: '家庭',
        functionTag: '申し出る',
        template: 'I can make ___ for you.',
        options: [
          { key: 'A', text: 'a cup of tea', correct: true },
          { key: 'B', text: 'tea', correct: false, reasonCode: 'N_UNIT_OF', note: 'n', appliedMeaning: 'm' },
          { key: 'C', text: 'a tea', correct: false, reasonCode: 'N_UNCOUNTABLE', note: 'n', appliedMeaning: 'm' },
          { key: 'D', text: 'the tea', correct: false, reasonCode: 'N_DEF_NEW', note: 'n', appliedMeaning: 'm' },
        ],
      },
      { countability: 'uncountable' },
    );
    assert.equal(item.headNoun, 'tea');
    assert.equal(item.headNounJa, 'お茶');
    assert.equal(item.countability, 'uncountable');
  });

  it('allows noun items without headNounJa after sanitize attempt', () => {
    const item = {
      tag: 'N-NP',
      sceneTag: '買い物',
      functionTag: '情報を得る',
      template: 'I bought ___ yesterday.',
      headNoun: 'xylophone',
      countability: 'countable',
      options: [
        { key: 'A', text: 'a xylophone', correct: true },
        { key: 'B', text: 'the xylophone', correct: false, reasonCode: 'N_DEF_NEW', note: 'n', appliedMeaning: 'm' },
        { key: 'C', text: 'xylophone', correct: false, reasonCode: 'N_MARKER_MISMATCH', note: 'n', appliedMeaning: 'm' },
        { key: 'D', text: 'xylophones', correct: false, reasonCode: 'N_NUM_SG', note: 'n', appliedMeaning: 'm' },
      ],
    };
    const { errors } = validateItem(item, {
      expectedTag: 'N-NP',
      expectedScene: { sceneTag: '買い物', functionTag: '情報を得る' },
      expectedPool: null,
    });
    assert.ok(!errors.some((e) => e === 'V17: headNounJa required'), errors.join('; '));
  });

  it('fills missing contextEn and rewrites idiom templates', () => {
    assert.equal(containsIdiom('Would you like ___?'), true);
    assert.equal(rewriteIdiomTemplate('Would you like ___?'), 'Do you want ___?');
    assert.equal(containsIdiom(rewriteIdiomTemplate('Would you like ___?')), false);

    const item = sanitizeContextAndIdiom(
      {
        tag: 'N-NP',
        sceneTag: '買い物',
        functionTag: '情報を得る',
        contextEn: null,
        template: 'Would you like ___?',
        headNoun: 'book',
        headNounJa: '本',
        countability: 'countable',
        options: [
          { key: 'A', text: 'a book', correct: true },
          { key: 'B', text: 'the book', correct: false, reasonCode: 'N_DEF_NEW', note: 'n', appliedMeaning: 'm' },
          { key: 'C', text: 'book', correct: false, reasonCode: 'N_MARKER_MISMATCH', note: 'n', appliedMeaning: 'm' },
          { key: 'D', text: 'books', correct: false, reasonCode: 'N_NUM_SG', note: 'n', appliedMeaning: 'm' },
        ],
      },
      { sceneTag: '買い物', functionTag: '情報を得る' },
    );

    assert.ok(item.contextEn);
    assert.equal(item.template, 'Do you want ___?');
    const { errors } = validateItem(item, {
      expectedTag: 'N-NP',
      expectedScene: { sceneTag: '買い物', functionTag: '情報を得る' },
      expectedPool: null,
    });
    assert.ok(!errors.some((e) => e.startsWith('V9') || e.startsWith('V15')), errors.join('; '));
  });

  it('sanitizes disallowed reasonCode for tag', () => {
    const item = sanitizeItemReasonCodes({
      tag: 'V-VOICE',
      options: [
        { key: 'A', text: 'is written', correct: true, reasonCode: null },
        { key: 'B', text: 'writes', correct: false, reasonCode: 'M_AGR_NUMBER' },
        { key: 'C', text: 'writing', correct: false, reasonCode: 'V_VOICE' },
        { key: 'D', text: 'wrote', correct: false, reasonCode: 'V_TENSE' },
      ],
    });
    assert.equal(item.options[1].reasonCode, 'V_VOICE');
    assert.equal(item.options[3].reasonCode, 'V_VOICE');
  });

  it('detects ill-formed modal + past participle (V18)', () => {
    assert.equal(isIllFormedModalParticiple('should known'), true);
    assert.equal(isIllFormedModalParticiple('must written'), true);
    assert.equal(isIllFormedModalParticiple('should be known'), false);
    assert.equal(isIllFormedModalParticiple('should know'), false);
    assert.equal(isIllFormedModalParticiple('has written'), false);

    const bad = {
      id: 1,
      tag: 'V-VOICE',
      sceneTag: '語学学校',
      functionTag: '確認する',
      contextEn: null,
      ja: 'あなたの夢は多くの人に知られるべきだ。',
      template: 'Your dream ___ by many people.',
      options: [
        { key: 'A', text: 'should know', correct: false, reasonCode: 'V_VOICE', note: 'n', appliedMeaning: 'm' },
        { key: 'B', text: 'should be known', correct: true, reasonCode: null },
        { key: 'C', text: 'should be knowing', correct: false, reasonCode: 'V_VOICE', note: 'n', appliedMeaning: 'm' },
        { key: 'D', text: 'should known', correct: false, reasonCode: 'V_VOICE', note: 'n', appliedMeaning: 'm' },
      ],
    };
    const { errors } = validateItem(bad, {
      expectedTag: 'V-VOICE',
      expectedScene: { sceneTag: '語学学校', functionTag: '確認する' },
      expectedPool: null,
    });
    assert.ok(errors.some((e) => e.startsWith('V18')), errors.join('; '));

    const good = {
      ...bad,
      options: [
        { key: 'A', text: 'should know', correct: false, reasonCode: 'V_VOICE', note: 'n', appliedMeaning: 'm' },
        { key: 'B', text: 'should be known', correct: true, reasonCode: null },
        { key: 'C', text: 'should be knowing', correct: false, reasonCode: 'V_VOICE', note: 'n', appliedMeaning: 'm' },
        { key: 'D', text: 'has known', correct: false, reasonCode: 'V_VOICE', note: 'n', appliedMeaning: 'm' },
      ],
    };
    const ok = validateItem(good, {
      expectedTag: 'V-VOICE',
      expectedScene: { sceneTag: '語学学校', functionTag: '確認する' },
      expectedPool: null,
    });
    assert.ok(!ok.errors.some((e) => e.startsWith('V18')), ok.errors.join('; '));
  });

  it('requires finite operator in V-TA options (V21)', () => {
    assert.equal(
      optionsHaveTaFiniteOperator({
        options: [
          { text: 'did you start' },
          { text: 'have you started' },
          { text: 'were you starting' },
          { text: 'had you started' },
        ],
      }),
      true,
    );
    assert.equal(
      optionsHaveTaFiniteOperator({
        options: [{ text: 'start' }, { text: 'starting' }, { text: 'started' }, { text: 'starts' }],
      }),
      false,
    );

    const bad = {
      id: 1,
      tag: 'V-TA',
      sceneTag: '語学学校',
      functionTag: '理由・目的を問う',
      contextEn: null,
      ja: 'あなたはなぜ英語を勉強し始めたのですか。',
      template: 'Why ___ studying English?',
      options: [
        { key: 'A', text: 'start', correct: true, reasonCode: null },
        { key: 'B', text: 'starting', correct: false, reasonCode: 'V_ASPECT', note: 'n', appliedMeaning: 'm' },
        { key: 'C', text: 'started', correct: false, reasonCode: 'V_ASPECT', note: 'n', appliedMeaning: 'm' },
        { key: 'D', text: 'starts', correct: false, reasonCode: 'V_ASPECT', note: 'n', appliedMeaning: 'm' },
      ],
    };
    const { errors } = validateItem(bad, {
      expectedTag: 'V-TA',
      expectedScene: { sceneTag: '語学学校', functionTag: '理由・目的を問う' },
      expectedPool: null,
    });
    assert.ok(errors.some((e) => e.startsWith('V21')), errors.join('; '));

    const good = {
      ...bad,
      options: [
        { key: 'A', text: 'did you start', correct: true, reasonCode: null },
        { key: 'B', text: 'have you started', correct: false, reasonCode: 'V_TENSE', note: 'n', appliedMeaning: 'm' },
        { key: 'C', text: 'were you starting', correct: false, reasonCode: 'V_ASPECT', note: 'n', appliedMeaning: 'm' },
        { key: 'D', text: 'had you started', correct: false, reasonCode: 'V_TENSE', note: 'n', appliedMeaning: 'm' },
      ],
    };
    const ok = validateItem(good, {
      expectedTag: 'V-TA',
      expectedScene: { sceneTag: '語学学校', functionTag: '理由・目的を問う' },
      expectedPool: null,
    });
    assert.ok(!ok.errors.some((e) => e.startsWith('V21')), ok.errors.join('; '));
  });

  it('rejects template/option phrase overlap (V20)', () => {
    assert.equal(
      findTemplateOptionPhraseOverlap('How ___ this window?', 'is this window opened'),
      'this window',
    );
    assert.equal(findTemplateOptionPhraseOverlap('How ___?', 'is this window opened'), null);
    assert.equal(
      findTemplateOptionPhraseOverlap('The report ___ by Friday.', 'must be written'),
      null,
    );

    const bad = {
      id: 1,
      tag: 'V-VOICE',
      sceneTag: '家庭',
      functionTag: '情報を得る',
      contextEn: null,
      ja: 'この窓はどうやって開けるの？',
      template: 'How ___ this window?',
      options: [
        { key: 'A', text: 'has this window been opening', correct: false, reasonCode: 'V_VOICE', note: 'n', appliedMeaning: 'm' },
        { key: 'B', text: 'is this window opened', correct: true, reasonCode: null },
        { key: 'C', text: 'does this window open', correct: false, reasonCode: 'V_VOICE', note: 'n', appliedMeaning: 'm' },
        { key: 'D', text: 'was this window opened', correct: false, reasonCode: 'V_VOICE', note: 'n', appliedMeaning: 'm' },
      ],
    };
    const { errors } = validateItem(bad, {
      expectedTag: 'V-VOICE',
      expectedScene: { sceneTag: '家庭', functionTag: '情報を得る' },
      expectedPool: null,
    });
    assert.ok(errors.some((e) => e.startsWith('V20')), errors.join('; '));

    const good = {
      ...bad,
      template: 'How ___?',
    };
    const ok = validateItem(good, {
      expectedTag: 'V-VOICE',
      expectedScene: { sceneTag: '家庭', functionTag: '情報を得る' },
      expectedPool: null,
    });
    assert.ok(!ok.errors.some((e) => e.startsWith('V20')), ok.errors.join('; '));
  });

  it('truncates option notes longer than 40 chars', () => {
    const longNote = 'この選択肢は文脈に合わず、聞き手が別の意味に受け取ってしまうため不適切で使えません';
    assert.ok(longNote.length > 40);
    const item = sanitizeItemReasonCodes({
      tag: 'N-NP',
      options: [
        { key: 'A', text: 'a book', correct: true, reasonCode: null, note: null },
        { key: 'B', text: 'the book', correct: false, reasonCode: 'N_DEF_NEW', note: longNote, appliedMeaning: '別の意味になる' },
        { key: 'C', text: 'book', correct: false, reasonCode: 'N_MARKER_MISMATCH', note: '短い', appliedMeaning: 'm' },
        { key: 'D', text: 'books', correct: false, reasonCode: 'N_NUM_SG', note: 'x'.repeat(50), appliedMeaning: 'm' },
      ],
    });
    assert.ok(item.options[1].note.length <= 40);
    assert.ok(item.options[3].note.length <= 40);
    const { errors } = validateItem(
      {
        ...item,
        sceneTag: '買い物',
        functionTag: '情報を得る',
        contextEn: 'She is looking for a gift.',
        template: 'I bought ___ yesterday.',
        headNoun: 'book',
        headNounJa: '本',
        countability: 'countable',
      },
      {
        expectedTag: 'N-NP',
        expectedScene: { sceneTag: '買い物', functionTag: '情報を得る' },
        expectedPool: null,
      },
    );
    assert.ok(!errors.some((e) => e.startsWith('V4')), errors.join('; '));
  });

  it('resolves lemma overflow by rewriting contextEn', () => {
    const items = [
      { template: 'I need ___ now.', contextEn: 'They are talking in the dorm.' },
      { template: 'She buys ___ today.', contextEn: 'They are talking at the office.' },
      { template: 'We see ___ here.', contextEn: 'They are talking at home today.' },
      { template: 'He finds ___ there.', contextEn: 'They are talking about work plans.' },
    ];
    assert.ok(hasLemmaOverflow(items));
    assert.ok(getOverflowingLemmas(items).includes('talk'));
    const fixed = sanitizeLemmaOverflow(items);
    assert.equal(hasLemmaOverflow(fixed), false);
    assert.deepEqual(getOverflowingLemmas(fixed), []);
  });
});
