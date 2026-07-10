import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shuffleItemOptions, shuffleSetOptions } from '../src/utils/shuffleOptions.js';
import { MOCK_SET } from '../src/constants/mockSet.js';

describe('shuffleItemOptions', () => {
  it('keeps exactly one correct option and four keys A-D', () => {
    const item = MOCK_SET.items[0];
    const shuffled = shuffleItemOptions(item);
    assert.equal(shuffled.options.length, 4);
    assert.equal(shuffled.options.filter((o) => o.correct).length, 1);
    assert.deepEqual(
      shuffled.options.map((o) => o.key),
      ['A', 'B', 'C', 'D'],
    );
    const texts = new Set(item.options.map((o) => o.text));
    assert.equal(shuffled.options.every((o) => texts.has(o.text)), true);
  });

  it('varies correct position across many shuffles', () => {
    const item = MOCK_SET.items[2]; // N-QNT, correct was originally first
    const positions = new Set();
    for (let i = 0; i < 80; i++) {
      const shuffled = shuffleItemOptions(item);
      positions.add(shuffled.options.findIndex((o) => o.correct));
    }
    assert.ok(positions.size >= 3, `expected varied positions, got ${[...positions]}`);
  });

  it('shuffles every item in a set', () => {
    const items = shuffleSetOptions(MOCK_SET.items);
    assert.equal(items.length, MOCK_SET.items.length);
    assert.ok(items.every((item) => item.options.filter((o) => o.correct).length === 1));
  });
});
