import { REST, Routes } from 'discord.js';
import { commands } from './commands.js';
import { loadConfig } from './config.js';

const config = loadConfig({ registration: true });
const rest = new REST({ version: '10' }).setToken(config.token);
const route = config.guildId
  ? Routes.applicationGuildCommands(config.clientId, config.guildId)
  : Routes.applicationCommands(config.clientId);

await rest.put(route, { body: commands });
console.log(`Registered ${commands.length} command(s) ${config.guildId ? `in guild ${config.guildId}` : 'globally'}.`);
