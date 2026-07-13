import { ChannelType, InteractionContextType, SlashCommandBuilder } from 'discord.js';

export const giveawayCommand = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('Create and manage advanced giveaways')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) => sub
    .setName('start')
    .setDescription('Preview and start a giveaway')
    .addStringOption((o) => o.setName('prize').setDescription('The prize').setRequired(true).setMaxLength(256))
    .addStringOption((o) => o.setName('duration').setDescription('For example: 30m, 2h, 3d').setRequired(true))
    .addIntegerOption((o) => o.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1).setMaxValue(20))
    .addChannelOption((o) => o.setName('channel').setDescription('Where to post it').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addRoleOption((o) => o.setName('required_role').setDescription('Role required to enter'))
    .addIntegerOption((o) => o.setName('min_messages').setDescription('Minimum tracked messages').setMinValue(1))
    .addNumberOption((o) => o.setName('daily_average').setDescription('Minimum messages per tracked day').setMinValue(0.1))
    .addIntegerOption((o) => o.setName('min_invites').setDescription('Minimum valid invites').setMinValue(1))
    .addIntegerOption((o) => o.setName('account_age').setDescription('Minimum account age in days').setMinValue(1))
    .addIntegerOption((o) => o.setName('server_age').setDescription('Minimum server membership in days').setMinValue(1)))
  .addSubcommand((sub) => sub
    .setName('end')
    .setDescription('End an active giveaway now')
    .addStringOption((o) => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
  .addSubcommand((sub) => sub
    .setName('reroll')
    .setDescription('Pick fresh winner(s)')
    .addStringOption((o) => o.setName('message_id').setDescription('Ended giveaway message ID').setRequired(true))
    .addIntegerOption((o) => o.setName('winners').setDescription('Override winner count').setMinValue(1).setMaxValue(20)))
  .addSubcommand((sub) => sub.setName('config').setDescription('Open the giveaway configuration panel'));

export const commands = [giveawayCommand.toJSON()];
