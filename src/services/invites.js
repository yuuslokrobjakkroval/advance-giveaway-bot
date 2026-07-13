import { Collection } from 'discord.js';
import { MemberStats } from '../models/MemberStats.js';

const inviteCache = new Map();

function snapshot(invites) {
  return new Collection(invites.map((invite) => [invite.code, invite.uses ?? 0]));
}

export async function cacheGuildInvites(guild) {
  try {
    inviteCache.set(guild.id, snapshot(await guild.invites.fetch()));
  } catch (error) {
    console.warn(`[invites] Cannot fetch invites for ${guild.name}: ${error.message}`);
  }
}

export async function initializeInviteCache(client) {
  await Promise.allSettled(client.guilds.cache.map(cacheGuildInvites));
}

export async function handleInviteCreate(invite) {
  await cacheGuildInvites(invite.guild);
}

export async function handleInviteDelete(invite) {
  const cached = inviteCache.get(invite.guild.id);
  cached?.delete(invite.code);
}

export async function handleMemberAdd(member) {
  const before = inviteCache.get(member.guild.id) ?? new Collection();
  let current;
  try {
    current = await member.guild.invites.fetch();
  } catch (error) {
    console.warn(`[invites] Join attribution failed in ${member.guild.name}: ${error.message}`);
    await MemberStats.updateOne(
      { guildId: member.guild.id, userId: member.id },
      { $setOnInsert: { trackingStartedAt: new Date() } },
      { upsert: true },
    );
    return;
  }

  const used = current
    .filter((invite) => (invite.uses ?? 0) > (before.get(invite.code) ?? 0) && invite.inviter?.id)
    .sort((a, b) => ((b.uses ?? 0) - (before.get(b.code) ?? 0)) - ((a.uses ?? 0) - (before.get(a.code) ?? 0)))
    .first();
  inviteCache.set(member.guild.id, snapshot(current));

  const update = { $setOnInsert: { trackingStartedAt: new Date() } };
  if (used?.inviter?.id && used.inviter.id !== member.id) {
    update.$set = { joinedViaCode: used.code, invitedById: used.inviter.id };
    await MemberStats.updateOne(
      { guildId: member.guild.id, userId: used.inviter.id },
      { $inc: { realInvites: 1 }, $setOnInsert: { trackingStartedAt: new Date() } },
      { upsert: true },
    );
  }
  await MemberStats.updateOne({ guildId: member.guild.id, userId: member.id }, update, { upsert: true });
}

export async function handleMemberRemove(member) {
  const stats = await MemberStats.findOne({ guildId: member.guild.id, userId: member.id });
  if (!stats?.invitedById) return;
  await MemberStats.updateOne(
    { guildId: member.guild.id, userId: stats.invitedById },
    { $inc: { realInvites: -1 } },
  );
  await MemberStats.updateOne(
    { guildId: member.guild.id, userId: member.id },
    { $set: { invitedById: null, joinedViaCode: null } },
  );
  await MemberStats.updateOne(
    { guildId: member.guild.id, userId: stats.invitedById, realInvites: { $lt: 0 } },
    { $set: { realInvites: 0 } },
  );
}
