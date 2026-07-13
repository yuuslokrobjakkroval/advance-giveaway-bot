import { EmbedBuilder } from 'discord.js';
import { describeRequirements } from './requirements.js';

export const PLACEHOLDERS = '{prize} {winners} {entries} {host} {end_timestamp} {end_relative} {requirements} {server} {channel} {giveaway_id}';

function replace(text, values) {
  return String(text ?? '').replace(/\{([a-z_]+)\}/gi, (match, key) => key in values ? String(values[key]) : match);
}

export function templateValues(giveaway, guild, entries = giveaway.entrants?.length ?? 0) {
  const unix = Math.floor(new Date(giveaway.endsAt).getTime() / 1000);
  return {
    prize: giveaway.prize,
    winners: giveaway.winnerCount,
    entries,
    host: `<@${giveaway.hostId}>`,
    end_timestamp: `<t:${unix}:F>`,
    end_relative: `<t:${unix}:R>`,
    requirements: describeRequirements(giveaway.requirements),
    server: guild.name,
    channel: `<#${giveaway.channelId}>`,
    giveaway_id: giveaway.messageId ?? giveaway._id ?? 'preview',
  };
}

export function buildGiveawayEmbed(config, giveaway, guild, { ended = false } = {}) {
  const values = templateValues(giveaway, guild);
  const design = config.embed;
  const title = replace(design.title, values).slice(0, 256);
  const description = replace(design.description, values).slice(0, 4096);
  const embed = new EmbedBuilder()
    .setColor(ended ? '#747F8D' : design.color)
    .setTimestamp(ended ? giveaway.endedAt ?? new Date() : giveaway.endsAt);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  const footer = replace(design.footer, values).slice(0, 2048);
  const author = replace(design.author, values).slice(0, 256);
  if (footer) embed.setFooter({ text: footer });
  if (author) embed.setAuthor({ name: author });
  if (design.thumbnail) embed.setThumbnail(design.thumbnail);
  if (design.image) embed.setImage(design.image);
  if (ended) embed.addFields({ name: 'Status', value: giveaway.winners?.length ? `Ended • Winners: ${giveaway.winners.map((id) => `<@${id}>`).join(', ')}` : 'Ended • No eligible winners' });
  return embed;
}
