import { Client, GatewayIntentBits, REST, Routes, ActivityType, PresenceUpdateStatus } from 'discord.js';
import { COMMANDS } from '@drp/core';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  throw new Error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const rest = new REST({ version: '10' }).setToken(token);

async function registerCommands() {
  const body = COMMANDS.map((definition) => ({
    name: definition.name,
    description: definition.description.slice(0, 100),
    options: definition.options?.map((option) => ({
      type: 3,
      name: option.name,
      description: option.description.slice(0, 100),
      required: Boolean(option.required),
    })),
  }));

  await rest.put(Routes.applicationCommands(clientId), { body });
}

client.once('ready', async (readyClient) => {
  console.log(`[DRP] Logged in as ${readyClient.user.tag}`);
  console.log(`[DRP] Loaded ${COMMANDS.length} commands`);

  await readyClient.user.setPresence({
    status: (process.env.BOT_STATUS as PresenceUpdateStatus) || 'online',
    activities: [{ name: process.env.BOT_ACTIVITY || 'Emergency Hamburg RP', type: ActivityType.Playing }],
  });

  try {
    await registerCommands();
    console.log('[DRP] Slash commands registered');
  } catch (error) {
    console.error('[DRP] Command registration failed:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const definition = COMMANDS.find((command) => command.name === interaction.commandName);
  if (!definition) return;

  try {
    await interaction.reply({
      content: `**${definition.name}**\n${definition.description}\n\nUsage: \`${definition.usage}\``,
      ephemeral: true,
    });
  } catch (error) {
    console.error(`[DRP] Command ${interaction.commandName} failed:`, error);
  }
});

process.on('SIGTERM', () => {
  console.log('[DRP] Graceful shutdown requested');
  client.destroy();
  process.exit(0);
});

client.login(token);
