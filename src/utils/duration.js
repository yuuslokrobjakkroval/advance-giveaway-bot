import ms from 'ms';

export function parseDuration(input) {
  if (typeof input !== 'string' || !/^\d+(\.\d+)?\s*(s|m|h|d|w)$/i.test(input.trim())) return null;
  const value = ms(input.trim());
  if (!Number.isFinite(value) || value < 10_000 || value > ms('90d')) return null;
  return value;
}
