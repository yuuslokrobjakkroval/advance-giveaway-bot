import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { Giveaway } from './models/Giveaway.js';
import { GuildConfig, getGuildConfig } from './models/GuildConfig.js';
import { parseDuration } from './utils/duration.js';
import { buildGiveawayEmbed } from './utils/template.js';
import { claimAndEnd, enterGiveaway, entryRow, rerollGiveaway } from './services/giveaways.js';
import { configModal, configPanel } from './ui/configPanel.js';

async function canManage(interaction, config = null) {
  if (interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const settings = config ?? await getGuildConfig(interaction.guildId);
  return settings.managerRoleIds.some((id) => interaction.member.roles.cache.has(id));
}

async function requireManager(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  if (await canManage(interaction, config)) return config;
  await interaction.reply({ content: 'You need **Manage Server** or a configured giveaway manager role.', flags: MessageFlags.Ephemeral });
  return null;
}

async function startPreview(interaction, config) {
  const duration = parseDuration(interaction.options.getString('duration', true));
  if (!duration) return interaction.reply({ content: 'Duration must be between 10 seconds and 90 days, such as `30m`, `2h`, or `3d`.', flags: MessageFlags.Ephemeral });
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  if (!channel?.isTextBased()) return interaction.reply({ content: 'Choose a text or announcement channel.', flags: MessageFlags.Ephemeral });
  const me = interaction.guild.members.me;
  const permissions = channel.permissionsFor(me);
  if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    return interaction.reply({ content: `I need View Channel, Send Messages, and Embed Links in ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  const giveaway = await Giveaway.create({
    guildId: interaction.guildId,
    channelId: channel.id,
    hostId: interaction.user.id,
    prize: interaction.options.getString('prize', true),
    winnerCount: interaction.options.getInteger('winners', true),
    endsAt: new Date(Date.now() + duration),
    requirements: {
      roleId: interaction.options.getRole('required_role')?.id ?? null,
      minMessages: interaction.options.getInteger('min_messages') ?? 0,
      minDailyAverage: interaction.options.getNumber('daily_average') ?? 0,
      minInvites: interaction.options.getInteger('min_invites') ?? 0,
      minAccountAgeDays: interaction.options.getInteger('account_age') ?? 0,
      minServerAgeDays: interaction.options.getInteger('server_age') ?? 0,
    },
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gw:confirm:${giveaway._id}`).setLabel('Post Giveaway').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`gw:cancel:${giveaway._id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger),
  );
  return interaction.reply({ content: `Preview — this will be posted in ${channel}.`, embeds: [buildGiveawayEmbed(config, giveaway, interaction.guild)], components: [row], flags: MessageFlags.Ephemeral });
}

async function commandHandler(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const config = await requireManager(interaction);
  if (!config) return;
  if (subcommand === 'config') return interaction.reply({ ...configPanel(config, interaction.guild), flags: MessageFlags.Ephemeral });
  if (subcommand === 'start') return startPreview(interaction, config);

  const messageId = interaction.options.getString('message_id', true);
  if (!/^\d{17,20}$/.test(messageId)) return interaction.reply({ content: 'That is not a valid Discord message ID.', flags: MessageFlags.Ephemeral });
  const giveaway = await Giveaway.findOne({ guildId: interaction.guildId, messageId });
  if (!giveaway) return interaction.reply({ content: 'I could not find a giveaway with that message ID.', flags: MessageFlags.Ephemeral });
  if (subcommand === 'end') {
    if (giveaway.status !== 'active') return interaction.reply({ content: 'That giveaway is not active.', flags: MessageFlags.Ephemeral });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const ended = await claimAndEnd(interaction.client, giveaway._id);
    return interaction.editReply(ended ? 'The giveaway has ended.' : 'Another process is already ending this giveaway.');
  }
  if (giveaway.status !== 'ended') return interaction.reply({ content: 'Only ended giveaways can be rerolled.', flags: MessageFlags.Ephemeral });
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const winners = await rerollGiveaway(interaction.client, giveaway, interaction.options.getInteger('winners') ?? giveaway.winnerCount);
  return interaction.editReply(winners.length ? `Selected ${winners.length} fresh winner(s).` : 'No fresh eligible winners were available.');
}

async function giveawayButton(interaction, action, id) {
  if (action === 'enter') return enterGiveaway(interaction, id);
  const giveaway = await Giveaway.findById(id);
  if (!giveaway || giveaway.status !== 'pending') return interaction.reply({ content: 'This preview has expired.', flags: MessageFlags.Ephemeral });
  if (giveaway.hostId !== interaction.user.id) return interaction.reply({ content: 'Only the person who opened this preview can confirm it.', flags: MessageFlags.Ephemeral });
  if (action === 'cancel') {
    giveaway.status = 'cancelled';
    await giveaway.save();
    return interaction.update({ content: 'Giveaway cancelled.', embeds: [], components: [] });
  }
  if (!await canManage(interaction)) return interaction.reply({ content: 'You no longer have giveaway manager access.', flags: MessageFlags.Ephemeral });
  if (giveaway.endsAt <= new Date()) {
    giveaway.status = 'cancelled';
    await giveaway.save();
    return interaction.update({ content: 'This preview expired because its end time has passed. Start a new giveaway.', embeds: [], components: [] });
  }
  const config = await getGuildConfig(giveaway.guildId);
  const channel = await interaction.guild.channels.fetch(giveaway.channelId);
  const message = await channel.send({ embeds: [buildGiveawayEmbed(config, giveaway, interaction.guild)], components: [entryRow(giveaway, config)] });
  giveaway.messageId = message.id;
  giveaway.status = 'active';
  await giveaway.save();
  await message.edit({ embeds: [buildGiveawayEmbed(config, giveaway, interaction.guild)], components: [entryRow(giveaway, config)] });
  return interaction.update({ content: `Giveaway posted: ${message.url}`, embeds: [], components: [] });
}

function parseRoleIds(value) {
  return [...new Set(value.match(/\d{17,20}/g) ?? [])];
}

function isHttpUrl(value) {
  if (!value) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

async function configComponent(interaction, action) {
  const config = await requireManager(interaction);
  if (!config) return;
  if (interaction.isStringSelectMenu()) {
    config.buttonStyle = interaction.values[0];
    await config.save();
    return interaction.update(configPanel(config, interaction.guild, 'Button color saved.'));
  }
  if (action === 'reset') {
    const defaults = new GuildConfig({ guildId: interaction.guildId });
    config.embed = defaults.embed;
    config.buttonStyle = defaults.buttonStyle;
    config.buttonLabel = defaults.buttonLabel;
    await config.save();
    return interaction.update(configPanel(config, interaction.guild, 'Embed design reset.'));
  }
  return interaction.showModal(configModal(action, config));
}

async function configModalSubmit(interaction, kind) {
  const config = await getGuildConfig(interaction.guildId);
  if (!await canManage(interaction, config)) return interaction.reply({ content: 'You no longer have giveaway manager access.', flags: MessageFlags.Ephemeral });
  const field = (name) => interaction.fields.getTextInputValue(name).trim();
  let notice;
  if (kind === 'text') {
    config.embed.title = field('title'); config.embed.description = field('description');
    config.embed.footer = field('footer'); config.embed.author = field('author'); notice = 'Embed text saved.';
  } else if (kind === 'media') {
    const thumbnail = field('thumbnail'); const image = field('image');
    if (![thumbnail, image].every(isHttpUrl)) return interaction.reply({ content: 'Enter valid `http://` or `https://` image URLs.', flags: MessageFlags.Ephemeral });
    config.embed.thumbnail = thumbnail; config.embed.image = image; notice = 'Images saved.';
  } else if (kind === 'appearance') {
    const color = field('color');
    if (!/^#[0-9a-f]{6}$/i.test(color)) return interaction.reply({ content: 'Use a six-digit hex color such as `#5865F2`.', flags: MessageFlags.Ephemeral });
    config.embed.color = color; config.buttonLabel = field('label'); notice = 'Appearance saved.';
  } else if (kind === 'bonuses') {
    const rows = field('roles').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const bonuses = [];
    for (const row of rows) {
      const match = row.match(/<?@?&?(\d{17,20})>?\s*=\s*(\d+)/);
      if (!match || Number(match[2]) < 1 || Number(match[2]) > 100 || !interaction.guild.roles.cache.has(match[1])) {
        return interaction.reply({ content: `Invalid bonus row: \`${row.slice(0, 100)}\`. Use \`ROLE_ID=MULTIPLIER\` with multipliers from 1–100.`, flags: MessageFlags.Ephemeral });
      }
      bonuses.push({ roleId: match[1], multiplier: Number(match[2]) });
    }
    config.bonusRoles = bonuses; notice = 'Bonus roles saved.';
  } else {
    const ids = parseRoleIds(field('roles'));
    if (ids.some((id) => !interaction.guild.roles.cache.has(id))) return interaction.reply({ content: 'One or more manager role IDs do not exist in this server.', flags: MessageFlags.Ephemeral });
    config.managerRoleIds = ids; notice = 'Manager roles saved.';
  }
  await config.save();
  return interaction.update(configPanel(config, interaction.guild, notice));
}

export async function handleInteraction(interaction) {
  if (!interaction.inGuild()) return;
  if (interaction.isChatInputCommand() && interaction.commandName === 'giveaway') return commandHandler(interaction);
  if (interaction.isButton()) {
    const [scope, action, id] = interaction.customId.split(':');
    if (scope === 'gw') return giveawayButton(interaction, action, id);
    if (scope === 'cfg') return configComponent(interaction, action);
  }
  if (interaction.isStringSelectMenu() && interaction.customId === 'cfg:style') return configComponent(interaction, 'style');
  if (interaction.isModalSubmit() && interaction.customId.startsWith('cfgmodal:')) return configModalSubmit(interaction, interaction.customId.split(':')[1]);
}
