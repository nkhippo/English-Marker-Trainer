import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allocateTags } from '../src/utils/tagAllocator.js';
import { allocateScenes, countSceneTags } from '../src/utils/sceneAllocator.js';
import { MOCK_SET } from '../src/constants/mockSet.js';
import { validateItem, validateV1, sanitizeItemReasonCodes, sanitizeModalPoolOptions, validateSet } from '../src/utils/validators.js';
import { hasLemmaOverflow } from '../src/utils/lemmaCounter.js';

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
});
