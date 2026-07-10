import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allocateTags } from '../src/utils/tagAllocator.js';
import { allocateScenes, countSceneTags } from '../src/utils/sceneAllocator.js';
import { ALL_TAG_IDS } from '../src/constants/tags.js';
import { MOCK_SET } from '../src/constants/mockSet.js';
import { validateItem, validateV1 } from '../src/utils/validators.js';

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
  });
});
