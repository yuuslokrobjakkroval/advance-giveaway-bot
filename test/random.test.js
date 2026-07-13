import test from 'node:test';
import assert from 'node:assert/strict';
import { weightedDraw } from '../src/utils/random.js';

test('weighted draw selects distinct winners', () => {
  const winners = weightedDraw([{ userId: 'a', weight: 100 }, { userId: 'b', weight: 1 }, { userId: 'c', weight: 2 }], 3);
  assert.equal(winners.length, 3);
  assert.equal(new Set(winners).size, 3);
});

test('weighted draw never selects zero-weight candidates', () => {
  assert.deepEqual(weightedDraw([{ userId: 'a', weight: 0 }, { userId: 'b', weight: 1 }], 2), ['b']);
});
