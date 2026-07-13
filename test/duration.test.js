import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration } from '../src/utils/duration.js';

test('parses supported giveaway durations', () => {
  assert.equal(parseDuration('30m'), 1_800_000);
  assert.equal(parseDuration('2h'), 7_200_000);
  assert.equal(parseDuration('3d'), 259_200_000);
});

test('rejects unsafe and out-of-range durations', () => {
  assert.equal(parseDuration('tomorrow'), null);
  assert.equal(parseDuration('5s'), null);
  assert.equal(parseDuration('91d'), null);
});
