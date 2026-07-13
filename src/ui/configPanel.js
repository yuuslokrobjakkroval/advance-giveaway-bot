import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { buildGiveawayEmbed, PLACEHOLDERS } from '../utils/template.js';

const input = (id, label, style, value, maxLength, required = false) => {
  const component = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setMaxLength(maxLength).setRequired(required);
  if (value) component.setValue(value);
  return new ActionRowBuilder().addComponents(component);
};

export function configPanel(config, guild, notice = null) {
  const preview = {
    _id: 'preview', prize: 'Preview Prize', winnerCount: 2, entrants: ['1', '2', '3'], hostId: guild.client.user.id,
    channelId: guild.systemChannelId ?? guild.channels.cache.find((c) => c.isTextBased())?.id ?? guild.id,
    endsAt: new Date(Date.now() + 3_600_000), requirements: {},
  };
  const bonusText = config.bonusRoles.length ? config.bonusRoles.map((r) => `<@&${r.roleId}> ×${r.multiplier}`).join(', ') : 'None';
  const managerText = config.managerRoleIds.length ? config.managerRoleIds.map((id) => `<@&${id}>`).join(', ') : 'Manage Server only';
  const info = new EmbedBuilder()
    .setColor('#2B2D31')
    .setDescription(`${notice ? `✅ ${notice}\n\n` : ''}**Bonus roles:** ${bonusText}\n**Manager roles:** ${managerText}\n**Available placeholders:**\n${PLACEHOLDERS}`);

  const editRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cfg:text').setLabel('Text').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cfg:media').setLabel('Images').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cfg:appearance').setLabel('Appearance').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cfg:bonuses').setLabel('Bonus Roles').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
  );
  const adminRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cfg:managers').setLabel('Manager Roles').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cfg:reset').setLabel('Reset Design').setEmoji('↩️').setStyle(ButtonStyle.Danger),
  );
  const styleRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('cfg:style').setPlaceholder(`Entry button color: ${config.buttonStyle}`).addOptions(
      ['Primary', 'Secondary', 'Success', 'Danger'].map((style) => new StringSelectMenuOptionBuilder().setLabel(style).setValue(style).setDefault(config.buttonStyle === style)),
    ),
  );
  return { content: '## Giveaway Configuration', embeds: [buildGiveawayEmbed(config, preview, guild), info], components: [editRow, adminRow, styleRow] };
}

export function configModal(kind, config) {
  if (kind === 'text') return new ModalBuilder().setCustomId('cfgmodal:text').setTitle('Giveaway embed text').addComponents(
    input('title', 'Title', TextInputStyle.Short, config.embed.title, 256),
    input('description', 'Description', TextInputStyle.Paragraph, config.embed.description, 4000),
    input('footer', 'Footer', TextInputStyle.Short, config.embed.footer, 2000),
    input('author', 'Author name', TextInputStyle.Short, config.embed.author, 256),
  );
  if (kind === 'media') return new ModalBuilder().setCustomId('cfgmodal:media').setTitle('Giveaway images').addComponents(
    input('thumbnail', 'Thumbnail URL (blank to remove)', TextInputStyle.Short, config.embed.thumbnail, 1000),
    input('image', 'Banner image URL (blank to remove)', TextInputStyle.Short, config.embed.image, 1000),
  );
  if (kind === 'appearance') return new ModalBuilder().setCustomId('cfgmodal:appearance').setTitle('Giveaway appearance').addComponents(
    input('color', 'Embed color (hex)', TextInputStyle.Short, config.embed.color, 7, true),
    input('label', 'Entry button label', TextInputStyle.Short, config.buttonLabel, 80, true),
  );
  if (kind === 'bonuses') return new ModalBuilder().setCustomId('cfgmodal:bonuses').setTitle('Bonus role multipliers').addComponents(
    input('roles', 'One ROLE_ID=MULTIPLIER per line', TextInputStyle.Paragraph, config.bonusRoles.map((r) => `${r.roleId}=${r.multiplier}`).join('\n'), 4000),
  );
  return new ModalBuilder().setCustomId('cfgmodal:managers').setTitle('Giveaway manager roles').addComponents(
    input('roles', 'Role IDs, mentions, spaces, or new lines', TextInputStyle.Paragraph, config.managerRoleIds.join('\n'), 4000),
  );
}
