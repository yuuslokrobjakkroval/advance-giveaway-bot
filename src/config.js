import 'dotenv/config';

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'MONGODB_URI'];

export function loadConfig({ registration = false } = {}) {
  const keys = registration ? ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'] : required;
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);

  const interval = Number(process.env.SCHEDULER_INTERVAL_MS ?? 15_000);
  if (!registration && (!Number.isFinite(interval) || interval < 5_000)) {
    throw new Error('SCHEDULER_INTERVAL_MS must be at least 5000.');
  }

  return {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    mongoUri: process.env.MONGODB_URI,
    guildId: process.env.DISCORD_GUILD_ID || null,
    schedulerInterval: interval,
  };
}
