import mongoose from 'mongoose';
import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
} from 'discord.js';
import { loadConfig } from './config.js';
import { handleInteraction } from './interactions.js';
import { MemberStats } from './models/MemberStats.js';
import {
  handleInviteCreate,
  handleInviteDelete,
  handleMemberAdd,
  handleMemberRemove,
  cacheGuildInvites,
  initializeInviteCache,
} from './services/invites.js';
import { startScheduler } from './services/giveaways.js';

const config = loadConfig();
await mongoose.connect(config.mongoUri);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.GuildMember],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Ready as ${readyClient.user.tag} in ${readyClient.guilds.cache.size} guild(s).`);
  await initializeInviteCache(readyClient);
  startScheduler(readyClient, config.schedulerInterval);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    await handleInteraction(interaction);
  } catch (error) {
    console.error('[interaction]', error);
    const response = { content: 'Something went wrong while processing that action. Please try again.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.followUp(response).catch(() => {});
    else await interaction.reply(response).catch(() => {});
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.inGuild() || message.author.bot) return;
  await MemberStats.updateOne(
    { guildId: message.guildId, userId: message.author.id },
    { $inc: { totalMessages: 1 }, $set: { lastMessageAt: new Date() }, $setOnInsert: { trackingStartedAt: new Date() } },
    { upsert: true },
  ).catch((error) => console.error('[messages]', error));
});

client.on(Events.GuildCreate, (guild) => cacheGuildInvites(guild));
client.on(Events.InviteCreate, (invite) => handleInviteCreate(invite).catch((error) => console.error('[inviteCreate]', error)));
client.on(Events.InviteDelete, (invite) => handleInviteDelete(invite).catch((error) => console.error('[inviteDelete]', error)));
client.on(Events.GuildMemberAdd, (member) => handleMemberAdd(member).catch((error) => console.error('[memberAdd]', error)));
client.on(Events.GuildMemberRemove, (member) => handleMemberRemove(member).catch((error) => console.error('[memberRemove]', error)));
client.on(Events.Error, (error) => console.error('[discord]', error));

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down.`);
  client.destroy();
  await mongoose.disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (error) => console.error('[unhandledRejection]', error));

await client.login(config.token);
