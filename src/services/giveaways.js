import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { Giveaway } from '../models/Giveaway.js';
import { MemberStats } from '../models/MemberStats.js';
import { getGuildConfig } from '../models/GuildConfig.js';
import { buildGiveawayEmbed } from '../utils/template.js';
import { checkRequirements } from '../utils/requirements.js';
import { weightedDraw } from '../utils/random.js';

export function entryRow(giveaway, config, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gw:enter:${giveaway._id}`)
      .setLabel(config.buttonLabel)
      .setEmoji('🎉')
      .setStyle(ButtonStyle[config.buttonStyle] ?? ButtonStyle.Primary)
      .setDisabled(disabled),
  );
}

function bonusWeight(member, config) {
  return Math.max(1, ...config.bonusRoles
    .filter((item) => member.roles.cache.has(item.roleId))
    .map((item) => item.multiplier));
}

async function eligibleCandidates(client, giveaway, config, excluded = new Set()) {
  const guild = client.guilds.cache.get(giveaway.guildId) ?? await client.guilds.fetch(giveaway.guildId);
  const statsList = await MemberStats.find({ guildId: giveaway.guildId, userId: { $in: giveaway.entrants } });
  const statsByUser = new Map(statsList.map((stats) => [stats.userId, stats]));
  const candidates = [];
  for (const userId of giveaway.entrants) {
    if (excluded.has(userId)) continue;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member || member.user.bot) continue;
    const result = checkRequirements({ member, stats: statsByUser.get(userId), requirements: giveaway.requirements });
    if (result.eligible) candidates.push({ userId, weight: bonusWeight(member, config) });
  }
  return { guild, candidates };
}

async function updateGiveawayMessage(client, giveaway, config) {
  const guild = client.guilds.cache.get(giveaway.guildId);
  const channel = guild?.channels.cache.get(giveaway.channelId) ?? await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel?.isTextBased() || !giveaway.messageId) return;
  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (message) await message.edit({ embeds: [buildGiveawayEmbed(config, giveaway, guild, { ended: giveaway.status === 'ended' })], components: [entryRow(giveaway, config, giveaway.status !== 'active')] });
}

export async function enterGiveaway(interaction, giveawayId) {
  const giveaway = await Giveaway.findById(giveawayId);
  if (!giveaway || giveaway.status !== 'active' || giveaway.endsAt <= new Date()) {
    return interaction.reply({ content: 'This giveaway is no longer accepting entries.', flags: MessageFlags.Ephemeral });
  }
  const stats = await MemberStats.findOne({ guildId: giveaway.guildId, userId: interaction.user.id });
  const result = checkRequirements({ member: interaction.member, stats, requirements: giveaway.requirements });
  if (!result.eligible) return interaction.reply({ content: `You cannot enter yet:\n${result.failures.map((failure) => `• ${failure}`).join('\n')}`, flags: MessageFlags.Ephemeral });

  const alreadyEntered = giveaway.entrants.includes(interaction.user.id);
  if (alreadyEntered) {
    await Giveaway.updateOne({ _id: giveaway._id }, { $pull: { entrants: interaction.user.id } });
    await interaction.reply({ content: 'Your entry has been removed.', flags: MessageFlags.Ephemeral });
  } else {
    await Giveaway.updateOne({ _id: giveaway._id, status: 'active' }, { $addToSet: { entrants: interaction.user.id } });
    await interaction.reply({ content: 'You are entered! Your bonus multiplier is evaluated when the giveaway ends.', flags: MessageFlags.Ephemeral });
  }
  const fresh = await Giveaway.findById(giveaway._id);
  const config = await getGuildConfig(giveaway.guildId);
  await updateGiveawayMessage(interaction.client, fresh, config).catch((error) => console.warn(`[giveaway] Entry count refresh failed: ${error.message}`));
}

export async function claimAndEnd(client, giveawayId = null) {
  const now = new Date();
  const stale = new Date(Date.now() - 120_000);
  const scope = giveawayId ? { _id: giveawayId } : { endsAt: { $lte: now } };
  const giveaway = await Giveaway.findOneAndUpdate(
    { ...scope, $or: [{ status: 'active' }, { status: 'ending', processingStartedAt: { $lt: stale } }] },
    { $set: { status: 'ending', processingStartedAt: now } },
    { returnDocument: 'after', sort: { endsAt: 1 } },
  );
  if (!giveaway) return null;

  try {
    const config = await getGuildConfig(giveaway.guildId);
    const { guild, candidates } = await eligibleCandidates(client, giveaway, config);
    giveaway.winners = weightedDraw(candidates, giveaway.winnerCount);
    giveaway.winnerHistory.push(giveaway.winners);
    giveaway.status = 'ended';
    giveaway.endedAt = new Date();
    await giveaway.save();
    await updateGiveawayMessage(client, giveaway, config);

    const channel = guild.channels.cache.get(giveaway.channelId) ?? await guild.channels.fetch(giveaway.channelId);
    const announcement = giveaway.winners.length
      ? `🎉 Congratulations ${giveaway.winners.map((id) => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**.`
      : `No eligible winners were found for **${giveaway.prize}**.`;
    await channel.send({ content: announcement, allowedMentions: { users: giveaway.winners } });
    await Promise.allSettled(giveaway.winners.map(async (userId) => {
      const user = await client.users.fetch(userId);
      await user.send(`🎉 You won **${giveaway.prize}** in **${guild.name}**!\nhttps://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`);
    }));
    return giveaway;
  } catch (error) {
    await Giveaway.updateOne({ _id: giveaway._id, status: 'ending' }, { $set: { status: 'active', processingStartedAt: null } });
    throw error;
  }
}

export async function rerollGiveaway(client, giveaway, winnerCount) {
  const config = await getGuildConfig(giveaway.guildId);
  const excluded = new Set(giveaway.winnerHistory.flat());
  const { guild, candidates } = await eligibleCandidates(client, giveaway, config, excluded);
  const winners = weightedDraw(candidates, winnerCount);
  giveaway.winners = winners;
  giveaway.winnerHistory.push(winners);
  await giveaway.save();
  const channel = guild.channels.cache.get(giveaway.channelId) ?? await guild.channels.fetch(giveaway.channelId);
  await channel.send({
    content: winners.length ? `🔄 New winner${winners.length === 1 ? '' : 's'}: ${winners.map((id) => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**.` : 'No fresh eligible winners were available.',
    allowedMentions: { users: winners },
  });
  await Promise.allSettled(winners.map(async (id) => (await client.users.fetch(id)).send(`🎉 You were selected as a reroll winner for **${giveaway.prize}** in **${guild.name}**!`)));
  await updateGiveawayMessage(client, giveaway, config);
  return winners;
}

export function startScheduler(client, intervalMs) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      while (await claimAndEnd(client)) { /* drain all due giveaways */ }
    } catch (error) {
      console.error('[scheduler]', error);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return timer;
}
