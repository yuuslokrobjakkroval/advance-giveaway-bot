const DAY = 86_400_000;

export function trackedDays(stats, now = new Date()) {
  if (!stats?.trackingStartedAt) return 1;
  return Math.max(1, Math.ceil((now.getTime() - new Date(stats.trackingStartedAt).getTime()) / DAY));
}

export function describeRequirements(req = {}) {
  const parts = [];
  if (req.roleId) parts.push(`<@&${req.roleId}>`);
  if (req.minMessages) parts.push(`${req.minMessages} messages`);
  if (req.minDailyAverage) parts.push(`${req.minDailyAverage} messages/day`);
  if (req.minInvites) parts.push(`${req.minInvites} valid invites`);
  if (req.minAccountAgeDays) parts.push(`${req.minAccountAgeDays}d account age`);
  if (req.minServerAgeDays) parts.push(`${req.minServerAgeDays}d server age`);
  return parts.length ? parts.join(' • ') : 'None';
}

export function checkRequirements({ member, stats, requirements, now = new Date() }) {
  const failures = [];
  const req = requirements ?? {};
  if (req.roleId && !member.roles.cache.has(req.roleId)) failures.push(`You need the <@&${req.roleId}> role.`);
  if ((stats?.totalMessages ?? 0) < (req.minMessages ?? 0)) failures.push(`You need ${req.minMessages} tracked messages.`);
  const average = (stats?.totalMessages ?? 0) / trackedDays(stats, now);
  if (average < (req.minDailyAverage ?? 0)) failures.push(`You need a ${req.minDailyAverage} daily message average (current: ${average.toFixed(1)}).`);
  if ((stats?.realInvites ?? 0) < (req.minInvites ?? 0)) failures.push(`You need ${req.minInvites} valid invites.`);
  const accountDays = (now.getTime() - member.user.createdTimestamp) / DAY;
  if (accountDays < (req.minAccountAgeDays ?? 0)) failures.push(`Your account must be ${req.minAccountAgeDays} days old.`);
  const serverDays = member.joinedTimestamp ? (now.getTime() - member.joinedTimestamp) / DAY : 0;
  if (serverDays < (req.minServerAgeDays ?? 0)) failures.push(`You must be in this server for ${req.minServerAgeDays} days.`);
  return { eligible: failures.length === 0, failures, average };
}
