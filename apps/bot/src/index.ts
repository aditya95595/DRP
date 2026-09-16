import {
  ActivityType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import {
  COMMANDS,
  DEFAULT_CONFIG,
  GuildConfig,
  ensureGuild,
  prisma,
  writeAudit,
} from '@drp/core';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const version = process.env.npm_package_version || '0.1.0';

if (!token) throw new Error('Missing DISCORD_TOKEN');
if (!clientId) throw new Error('Missing DISCORD_CLIENT_ID');

const applicationId: string = clientId;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const rest = new REST({ version: '10' }).setToken(token);
const bootedAt = Date.now();
const cooldowns = new Map<string, number>();
let shuttingDown = false;

const string = (name: string, description: string, required = false) => ({ name, description, type: 'string' as const, required });
const integer = (name: string, description: string, required = false) => ({ name, description, type: 'integer' as const, required });
const user = (name: string, description: string, required = false) => ({ name, description, type: 'user' as const, required });

const optionMap: Record<string, Array<ReturnType<typeof string> | ReturnType<typeof integer> | ReturnType<typeof user>>> = {
  'session-start': [string('server-name', 'RP server name'), string('server-code', 'Emergency Hamburg server code'), integer('capacity', 'Server capacity')],
  'server-startup': [string('server-code', 'Current server code'), integer('players', 'Current player count')],
  'server-full': [integer('players', 'Current player count')],
  'operation-start': [string('name', 'Operation name', true), string('type', 'Operation type')],
  'operation-info': [string('operation', 'Operation name or ID', true)],
  'operation-roster': [string('operation', 'Operation name or ID', true)],
  'operation-join': [string('operation', 'Operation name or ID', true)],
  'operation-leave': [string('operation', 'Operation name or ID', true)],
  'department-create': [string('name', 'Department name', true)],
  'department-edit': [string('department', 'Department name', true)],
  'department-delete': [string('department', 'Department name', true)],
  'department-info': [string('department', 'Department name', true)],
  'department-roster': [string('department', 'Department name', true)],
  'department-join': [string('department', 'Department name', true)],
  'department-leave': [string('department', 'Department name', true)],
  'department-ranks': [string('department', 'Department name', true)],
  'department-rank-add': [string('department', 'Department name', true), string('rank', 'Rank name', true)],
  'department-rank-remove': [string('department', 'Department name', true), string('rank', 'Rank name', true)],
  promote: [user('user', 'Discord member', true), string('department', 'Department name', true), string('rank', 'New rank', true)],
  demote: [user('user', 'Discord member', true), string('department', 'Department name', true), string('rank', 'New rank', true)],
  'on-duty': [string('department', 'Department name', true)],
  'duty-roster': [string('department', 'Department name')],
  'department-stats': [string('department', 'Department name', true)],
  activity: [user('user', 'Discord member')],
  'ingame-ban': [string('player', 'In-game player identifier', true), string('reason', 'Reason', true), integer('duration', 'Duration in minutes')],
  'ingame-kick': [string('player', 'In-game player identifier', true), string('reason', 'Reason', true)],
  'ingame-warning': [string('player', 'In-game player identifier', true), string('reason', 'Reason', true)],
  'ingame-search': [string('query', 'Player ID, name or case ID', true)],
  'discord-ban': [user('user', 'Discord member', true), string('reason', 'Reason', true), integer('duration', 'Duration in minutes')],
  'discord-kick': [user('user', 'Discord member', true), string('reason', 'Reason', true)],
  'discord-records': [user('user', 'Discord member')],
  command: [string('name', 'Command name', true)],
  userinfo: [user('user', 'Discord member')],
  avatar: [user('user', 'Discord member')],
};

function buildCommand(name: string, description: string) {
  const builder = new SlashCommandBuilder().setName(name).setDescription(description.slice(0, 100));
  for (const option of optionMap[name] || []) {
    if (option.type === 'integer') builder.addIntegerOption((o) => o.setName(option.name).setDescription(option.description).setRequired(option.required));
    else if (option.type === 'user') builder.addUserOption((o) => o.setName(option.name).setDescription(option.description).setRequired(option.required));
    else builder.addStringOption((o) => o.setName(option.name).setDescription(option.description).setRequired(option.required));
  }
  return builder;
}

async function registerCommands(): Promise<void> {
  const body = COMMANDS.map((definition) => buildCommand(definition.name, definition.description).toJSON());
  await rest.put(Routes.applicationCommands(applicationId), { body });
}

async function getConfig(guildId: string): Promise<{ version: number; config: GuildConfig }> {
  const guild = await ensureGuild(guildId);
  const latest = await prisma.configVersion.findUnique({ where: { guildId_version: { guildId, version: guild.configVersion } } });
  return { version: guild.configVersion, config: (latest?.data || DEFAULT_CONFIG) as GuildConfig };
}

function render(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_match, key: string) => String(values[key] ?? `{${key}}`));
}

function buildEmbed(template: GuildConfig['embeds'][keyof GuildConfig['embeds']], values: Record<string, string | number>): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(render(template.title, values))
    .setDescription(render(template.description, values))
    .setColor(template.color as `#${string}`)
    .setFooter({ text: template.footer });
}

async function sendAutomation(guildId: string, key: keyof GuildConfig['embeds'], values: Record<string, string | number>): Promise<boolean> {
  const { config } = await getConfig(guildId);
  if (!config.announcementChannelId) return false;
  const channel = await client.channels.fetch(config.announcementChannelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !('send' in channel)) return false;
  const template = config.embeds[key];
  if (!template.enabled) return false;
  await channel.send({ embeds: [buildEmbed(template, values)] });
  return true;
}

async function syncPresence(config: GuildConfig): Promise<void> {
  const typeMap: Record<string, ActivityType> = {
    playing: ActivityType.Playing,
    watching: ActivityType.Watching,
    listening: ActivityType.Listening,
    streaming: ActivityType.Streaming,
    custom: ActivityType.Custom,
  };
  const type = typeMap[config.presence.activityType] ?? ActivityType.Playing;
  const activity: { name: string; type: ActivityType; url?: string } = {
    name: config.presence.activityText || 'Emergency Hamburg RP',
    type,
  };
  if (type === ActivityType.Streaming && config.presence.streamUrl) activity.url = config.presence.streamUrl;
  client.user?.setPresence({ status: config.presence.status, activities: [activity] });
}

async function heartbeat(): Promise<void> {
  const now = new Date();
  await Promise.all(Array.from(client.guilds.cache.values()).map(async (guild) => {
    await prisma.botHeartbeat.upsert({
      where: { guildId: guild.id },
      update: {
        status: 'online',
        latencyMs: Math.max(0, client.ws.ping),
        uptimeSeconds: Math.floor((Date.now() - bootedAt) / 1000),
        version,
        lastSeen: now,
      },
      create: {
        guildId: guild.id,
        status: 'online',
        latencyMs: Math.max(0, client.ws.ping),
        uptimeSeconds: Math.floor((Date.now() - bootedAt) / 1000),
        version,
        lastSeen: now,
        maintenance: false,
      },
    });
  }));
}

async function controlLoop(): Promise<void> {
  if (shuttingDown) return;
  const request = await prisma.controlRequest.findFirst({
    where: { status: 'pending', type: { in: ['RESTART', 'MAINTENANCE_ON', 'MAINTENANCE_OFF'] } },
    orderBy: { createdAt: 'asc' },
  });
  if (!request) return;
  await prisma.controlRequest.update({ where: { id: request.id }, data: { status: 'processing', claimedAt: new Date() } });

  if (request.type === 'RESTART') {
    shuttingDown = true;
    await prisma.botHeartbeat.updateMany({ where: { guildId: { in: Array.from(client.guilds.cache.keys()) } }, data: { status: 'restarting', lastSeen: new Date() } });
    await prisma.controlRequest.update({ where: { id: request.id }, data: { status: 'completed', completedAt: new Date() } });
    client.destroy();
    process.exit(0);
  }

  const maintenance = request.type === 'MAINTENANCE_ON';
  await prisma.botHeartbeat.updateMany({ where: { guildId: { in: Array.from(client.guilds.cache.keys()) } }, data: { maintenance, status: 'online', lastSeen: new Date() } });
  await prisma.controlRequest.update({ where: { id: request.id }, data: { status: 'completed', completedAt: new Date() } });
}

function checkPermissions(interaction: ChatInputCommandInteraction, required: string[]): boolean {
  if (!required.length) return true;
  const perms = interaction.memberPermissions;
  if (!perms) return false;
  return required.every((permission) => {
    if (permission === 'Manage Guild') return perms.has(PermissionFlagsBits.ManageGuild);
    if (permission === 'Administrator') return perms.has(PermissionFlagsBits.Administrator);
    if (permission === 'Ban Members') return perms.has(PermissionFlagsBits.BanMembers);
    if (permission === 'Kick Members') return perms.has(PermissionFlagsBits.KickMembers);
    return false;
  });
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a Discord server.', ephemeral: true });
    return;
  }

  const definition = COMMANDS.find((command) => command.name === interaction.commandName);
  if (!definition) return;
  if (!checkPermissions(interaction, definition.permissions)) {
    await interaction.reply({ content: `You need: **${definition.permissions.join(', ')}** to use this command.`, ephemeral: true });
    return;
  }

  const cooldownKey = `${interaction.guildId}:${interaction.user.id}:${interaction.commandName}`;
  const last = cooldowns.get(cooldownKey) || 0;
  const remaining = definition.cooldownSeconds * 1000 - (Date.now() - last);
  if (remaining > 0) {
    await interaction.reply({ content: `Please wait ${Math.ceil(remaining / 1000)}s before using this command again.`, ephemeral: true });
    return;
  }
  cooldowns.set(cooldownKey, Date.now());

  const { config, version: configVersion } = await getConfig(interaction.guildId);
  const session = await prisma.session.findFirst({ where: { guildId: interaction.guildId, status: 'active' }, orderBy: { startedAt: 'desc' } });

  switch (interaction.commandName) {
    case 'session-start': {
      if (session) {
        await interaction.reply({ content: `A roleplay session is already active: **${session.serverName || config.serverName}**.`, ephemeral: true });
        return;
      }
      const serverName = interaction.options.getString('server-name') || config.serverName;
      const serverCode = interaction.options.getString('server-code') || config.serverCode || null;
      const capacity = interaction.options.getInteger('capacity') || config.serverCapacity;
      const created = await prisma.session.create({ data: { guildId: interaction.guildId, serverName, serverCode, capacity } });
      await sendAutomation(interaction.guildId, 'sessionStart', { serverName, serverCode: serverCode || '—', players: 0, capacity });
      await writeAudit(interaction.guildId, interaction.user.id, 'SESSION_STARTED', created.id, { configVersion });
      await interaction.reply({ content: `✅ Roleplay session started: **${serverName}**.`, ephemeral: true });
      return;
    }
    case 'session-end': {
      if (!session) {
        await interaction.reply({ content: 'No active roleplay session.', ephemeral: true });
        return;
      }
      await prisma.session.update({ where: { id: session.id }, data: { status: 'ended', endedAt: new Date() } });
      await sendAutomation(interaction.guildId, 'sessionEnd', { serverName: session.serverName || config.serverName, players: session.currentPlayers, capacity: session.capacity });
      await writeAudit(interaction.guildId, interaction.user.id, 'SESSION_ENDED', session.id);
      await interaction.reply({ content: `🏁 Session ended. Peak players: **${session.peakPlayers}**.`, ephemeral: true });
      return;
    }
    case 'session-info':
    case 'session-roster': {
      await interaction.reply({ content: session ? `🎮 **${session.serverName || config.serverName}**\nPlayers: **${session.currentPlayers}/${session.capacity}**\nPeak: **${session.peakPlayers}**\nStarted: <t:${Math.floor(session.startedAt.getTime() / 1000)}:R>` : '⚫ No active roleplay session.', ephemeral: true });
      return;
    }
    case 'server-startup': {
      const code = interaction.options.getString('server-code') || session?.serverCode || config.serverCode || '—';
      const players = interaction.options.getInteger('players') ?? session?.currentPlayers ?? 0;
      await sendAutomation(interaction.guildId, 'startup', { owner: interaction.guild.ownerId, startedBy: interaction.user.username, serverCode: code, players, capacity: session?.capacity || config.serverCapacity, serverName: session?.serverName || config.serverName });
      await interaction.reply({ content: '🟢 Startup announcement sent.', ephemeral: true });
      return;
    }
    case 'server-close': {
      await sendAutomation(interaction.guildId, 'sessionEnd', { serverName: session?.serverName || config.serverName, players: session?.currentPlayers || 0, capacity: session?.capacity || config.serverCapacity });
      await interaction.reply({ content: '🏁 Server close announcement sent.', ephemeral: true });
      return;
    }
    case 'server-full': {
      const players = interaction.options.getInteger('players') ?? session?.currentPlayers ?? session?.capacity ?? config.serverCapacity;
      await sendAutomation(interaction.guildId, 'serverFull', { players, capacity: session?.capacity || config.serverCapacity, serverCode: session?.serverCode || config.serverCode || '—', serverName: session?.serverName || config.serverName });
      await interaction.reply({ content: '🔴 Server-full announcement sent.', ephemeral: true });
      return;
    }
    case 'server-status':
    case 'player-count': {
      await interaction.reply({ content: session ? `🟢 **${session.serverName || config.serverName}** — **${session.currentPlayers}/${session.capacity}** players.` : '⚫ No active roleplay session.', ephemeral: true });
      return;
    }
    case 'staff-status':
    case 'staff-roster': {
      const staff = await prisma.member.findMany({ where: { guildId: interaction.guildId, staff: true, onDuty: true }, take: 25 });
      await interaction.reply({ content: staff.length ? `👮 Staff on duty: ${staff.map((m) => `<@${m.discordId}>`).join(', ')}` : '⚠️ No staff are currently marked on duty.', ephemeral: true });
      return;
    }
    case 'staff-check': {
      const count = await prisma.member.count({ where: { guildId: interaction.guildId, staff: true, onDuty: true } });
      await interaction.reply({ content: count ? `✅ Staff presence detected: **${count}** on duty.` : '⚠️ No staff are currently on duty.', ephemeral: true });
      return;
    }
    case 'on-duty':
    case 'off-duty': {
      const department = interaction.commandName === 'on-duty' ? interaction.options.getString('department') : null;
      const member = await prisma.member.upsert({ where: { guildId_discordId: { guildId: interaction.guildId, discordId: interaction.user.id } }, update: { displayName: interaction.user.displayName, staff: true, onDuty: interaction.commandName === 'on-duty' }, create: { guildId: interaction.guildId, discordId: interaction.user.id, displayName: interaction.user.displayName, staff: true, onDuty: interaction.commandName === 'on-duty' } });
      await writeAudit(interaction.guildId, interaction.user.id, interaction.commandName === 'on-duty' ? 'DUTY_ON' : 'DUTY_OFF', member.id, department ? { department } : {});
      await interaction.reply({ content: interaction.commandName === 'on-duty' ? `🟢 You are now on duty${department ? ` for **${department}**` : ''}.` : '⚫ You are now off duty.', ephemeral: true });
      return;
    }
    case 'duty-status': {
      const member = await prisma.member.findUnique({ where: { guildId_discordId: { guildId: interaction.guildId, discordId: interaction.user.id } } });
      await interaction.reply({ content: member?.onDuty ? '🟢 You are on duty.' : '⚫ You are off duty.', ephemeral: true });
      return;
    }
    case 'department-list': {
      const departments = await prisma.department.findMany({ where: { guildId: interaction.guildId, enabled: true }, orderBy: { name: 'asc' } });
      await interaction.reply({ content: departments.length ? `👮 **Departments**\n${departments.map((d) => `• ${d.name}`).join('\n')}` : 'No departments configured yet.', ephemeral: true });
      return;
    }
    case 'department-create': {
      const name = interaction.options.getString('name', true).trim();
      const existing = await prisma.department.findUnique({ where: { guildId_name: { guildId: interaction.guildId, name } } });
      if (existing) { await interaction.reply({ content: 'That department already exists.', ephemeral: true }); return; }
      await prisma.department.create({ data: { guildId: interaction.guildId, name } });
      await interaction.reply({ content: `✅ Department created: **${name}**.`, ephemeral: true });
      return;
    }
    case 'department-info':
    case 'department-roster':
    case 'department-ranks': {
      const name = interaction.options.getString('department', true);
      const department = await prisma.department.findUnique({ where: { guildId_name: { guildId: interaction.guildId, name } }, include: { ranks: true } });
      await interaction.reply({ content: department ? `👮 **${department.name}**\n${department.description || 'No description configured.'}\nRanks: ${department.ranks.length ? department.ranks.map((r) => r.name).join(', ') : 'None'}` : 'Department not found.', ephemeral: true });
      return;
    }
    case 'department-delete': {
      const name = interaction.options.getString('department', true);
      const department = await prisma.department.findUnique({ where: { guildId_name: { guildId: interaction.guildId, name } } });
      if (!department) { await interaction.reply({ content: 'Department not found.', ephemeral: true }); return; }
      await prisma.department.delete({ where: { id: department.id } });
      await interaction.reply({ content: `🗑️ Deleted department **${name}**.`, ephemeral: true });
      return;
    }
    case 'ingame-ban':
    case 'ingame-kick':
    case 'ingame-warning': {
      const action = interaction.commandName.replace('ingame-', '').toUpperCase();
      const player = interaction.options.getString('player', true);
      const reason = interaction.options.getString('reason', true);
      const duration = interaction.options.getInteger('duration');
      const record = await prisma.record.create({ data: { guildId: interaction.guildId, scope: 'ingame', action, subjectId: player, reason, durationSeconds: duration ? duration * 60 : null, issuedBy: interaction.user.id, sessionId: session?.id } });
      await writeAudit(interaction.guildId, interaction.user.id, `INGAME_${action}`, record.id);
      await interaction.reply({ content: `📋 In-game **${action.toLowerCase()}** record created. Case: \`${record.id}\`.`, ephemeral: true });
      return;
    }
    case 'discord-ban':
    case 'discord-kick': {
      const target = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);
      const duration = interaction.options.getInteger('duration');
      if (interaction.commandName === 'discord-ban') {
        await interaction.guild.members.ban(target, { reason });
      } else {
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (member) await member.kick(reason);
      }
      const action = interaction.commandName.replace('discord-', '').toUpperCase();
      const record = await prisma.record.create({ data: { guildId: interaction.guildId, scope: 'discord', action, subjectId: target.id, subjectName: target.username, reason, durationSeconds: duration ? duration * 60 : null, issuedBy: interaction.user.id, sessionId: session?.id } });
      await writeAudit(interaction.guildId, interaction.user.id, `DISCORD_${action}`, record.id);
      await interaction.reply({ content: `🟦 Discord **${action.toLowerCase()}** completed and recorded as case \`${record.id}\`.`, ephemeral: true });
      return;
    }
    case 'discord-record':
    case 'ingame-record': {
      const caseId = interaction.options.getString('case-id') || '';
      const record = await prisma.record.findFirst({ where: { id: caseId, guildId: interaction.guildId } });
      await interaction.reply({ content: record ? `📋 **Case ${record.id}**\nScope: ${record.scope}\nAction: ${record.action}\nSubject: ${record.subjectName || record.subjectId}\nReason: ${record.reason || '—'}` : 'Record not found.', ephemeral: true });
      return;
    }
    case 'commands': {
      const categories = new Map<string, string[]>();
      for (const command of COMMANDS) (categories.get(command.category) || (categories.set(command.category, []), categories.get(command.category)!)).push(`/${command.name}`);
      const description = Array.from(categories.entries()).map(([category, names]) => `**${category}**\n${names.join(' • ')}`).join('\n\n');
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🧰 DRP Command Center').setDescription(description.slice(0, 3900)).setColor('#5865F2')], ephemeral: true });
      return;
    }
    case 'command':
    case 'help': {
      const name = interaction.options.getString('name') || interaction.options.getString('command');
      const target = COMMANDS.find((c) => c.name === name);
      if (!target) { await interaction.reply({ content: 'Command not found. Use `/commands` to browse the registry.', ephemeral: true }); return; }
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`/${target.name}`).setDescription(target.description).addFields({ name: 'Usage', value: `\`${target.usage}\`` }, { name: 'Permissions', value: target.permissions.length ? target.permissions.join(', ') : 'Everyone' }, { name: 'Cooldown', value: `${target.cooldownSeconds}s` }).setColor('#5865F2')], ephemeral: true });
      return;
    }
    case 'ping': await interaction.reply({ content: `🏓 Pong • Gateway **${client.ws.ping}ms** • Config **v${configVersion}**`, ephemeral: true }); return;
    case 'uptime': await interaction.reply({ content: `⏱️ Uptime: <t:${Math.floor(bootedAt / 1000)}:R>`, ephemeral: true }); return;
    case 'botinfo': await interaction.reply({ content: `🤖 DRP Control v${version}\nGuilds: **${client.guilds.cache.size}**\nLatency: **${client.ws.ping}ms**`, ephemeral: true }); return;
    case 'serverinfo': await interaction.reply({ content: `🏠 **${interaction.guild.name}**\nMembers: **${interaction.guild.memberCount}**\nID: \`${interaction.guild.id}\``, ephemeral: true }); return;
    case 'userinfo': { const target = interaction.options.getUser('user') || interaction.user; await interaction.reply({ content: `👤 **${target.username}**\nID: \`${target.id}\`\nCreated: <t:${Math.floor(target.createdTimestamp / 1000)}:R>`, ephemeral: true }); return; }
    case 'avatar': { const target = interaction.options.getUser('user') || interaction.user; await interaction.reply({ content: target.displayAvatarURL({ size: 1024 }), ephemeral: true }); return; }
    case 'health':
    case 'bot-status': {
      const hb = await prisma.botHeartbeat.findUnique({ where: { guildId: interaction.guildId } });
      await interaction.reply({ content: `🤖 ${hb?.status === 'online' ? 'Online' : 'Offline'} • DB **connected** • Gateway **${client.ws.ping}ms** • Heartbeat **${hb ? `<t:${Math.floor(hb.lastSeen.getTime() / 1000)}:R>` : 'not recorded'}** • Maintenance **${hb?.maintenance ? 'ON' : 'OFF'}**`, ephemeral: true });
      return;
    }
    default:
      await interaction.reply({ content: `**/${definition.name}** is registered. Its dashboard-backed workflow can be configured from DRP Control.`, ephemeral: true });
  }
}

client.once('ready', async () => {
  console.log(`[DRP] Logged in as ${client.user?.tag}`);
  try {
    await registerCommands();
    console.log(`[DRP] Registered ${COMMANDS.length} slash commands`);
  } catch (error) {
    console.error('[DRP] Command registration failed:', error);
  }

  const firstGuild = client.guilds.cache.first();
  if (firstGuild) {
    const { config } = await getConfig(firstGuild.id);
    await syncPresence(config).catch((error) => console.error('[DRP] Presence sync failed:', error));
  }

  await heartbeat().catch((error) => console.error('[DRP] Heartbeat failed:', error));
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleCommand(interaction);
  } catch (error) {
    console.error(`[DRP] /${interaction.commandName} failed:`, error);
    if (interaction.replied || interaction.deferred) await interaction.followUp({ content: 'An internal error occurred while running that command.', ephemeral: true }).catch(() => undefined);
    else await interaction.reply({ content: 'An internal error occurred while running that command.', ephemeral: true }).catch(() => undefined);
  }
});

const interval = setInterval(() => {
  heartbeat().catch((error) => console.error('[DRP] Heartbeat failed:', error));
  controlLoop().catch((error) => console.error('[DRP] Control loop failed:', error));
}, 30_000);

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(interval);
  console.log(`[DRP] ${signal} received; shutting down gracefully.`);
  await prisma.botHeartbeat.updateMany({ where: { guildId: { in: Array.from(client.guilds.cache.keys()) } }, data: { status: 'offline', lastSeen: new Date() } }).catch(() => undefined);
  client.destroy();
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void client.login(token);
