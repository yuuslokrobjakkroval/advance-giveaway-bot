import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRequirements, trackedDays } from '../src/utils/requirements.js';

const now = new Date('2026-07-13T00:00:00Z');
const member = {
  user: { createdTimestamp: new Date('2025-01-01').getTime() },
  joinedTimestamp: new Date('2026-06-01').getTime(),
  roles: { cache: { has: (id) => id === 'role-ok' } },
};

test('daily average uses elapsed tracked days', () => {
  const stats = { totalMessages: 40, trackingStartedAt: new Date('2026-07-09T00:00:00Z'), realInvites: 2 };
  assert.equal(trackedDays(stats, now), 4);
  assert.equal(checkRequirements({ member, stats, now, requirements: { roleId: 'role-ok', minMessages: 40, minDailyAverage: 10, minInvites: 2, minAccountAgeDays: 100, minServerAgeDays: 30 } }).eligible, true);
});

test('returns all unmet requirements', () => {
  const result = checkRequirements({ member, stats: null, now, requirements: { roleId: 'missing', minMessages: 1, minInvites: 1 } });
  assert.equal(result.eligible, false);
  assert.equal(result.failures.length, 3);
});
