import {
  ActivityType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { COMMANDS, DEFAULT_CONFIG, GuildConfig, ensureGuild, prisma, writeAudit } from '@drp/core';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const version = process.env.npm_package_version || '0.1.0';

if (!token || !clientId) throw new Error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const rest = new REST({ version: '10' }).setToken(token);
const bootedAt = Date.now();
const cooldowns = new Map<string, number>();
let shuttingDown = false;

const optionMap: Record<string, Array<{ name: string; description: string; type?: number; required?: boolean }>> = {
  'session-start': [
    { name: 'server-name', description: 'RP server name', required: false },
    { name: 'server-code', description: 'Current Emergency Hamburg server code', required: false },
    { name: 'capacity', description: 'Server capacity', type: 4, required: false },
  ],
  'server-startup': [
    { name: 'server-code', description: 'Current server code', required: false },
    { name: 'players', description: 'Current player count', type: 4, required: false },
  ],
  'server-full': [{ name: 'players', description: 'Current player count', type: 4, required: false }],
  'operation-start': [
    { name: 'name', description: 'Operation name', required: true },
    { name: 'type', description: 'Operation type', required: false },
  ],
  'operation-info': [{ name: 'operation', description: 'Operation name or ID', required: true }],
  'operation-roster': [{ name: 'operation', description: 'Operation name or ID', required: true }],
  'operation-join': [{ name: 'operation', description: 'Operation name or ID', required: true }],
  'operation-leave': [{ name: 'operation', description: 'Operation name or ID', required: true }],
  'department-create': [{ name: 'name', description: 'Department name', required: true }],
  'department-edit': [{ name: 'department', description: 'Department name', required: true }],
  'department-delete': [{ name: 'department', description: 'Department name', required: true }],
  'department-info': [{ name: 'department', description: 'Department name', required: true }],
  'department-roster': [{ name: 'department', description: 'Department name', required: true }],
  'department-join': [{ name: 'department', description: 'Department name', required: true }],
  'department-leave': [{ name: 'department', description: 'Department name', required: true }],
  'department-ranks': [{ name: 'department', description: 'Department name', required: true }],
  'department-rank-add': [
    { name: 'department', description: 'Department name', required: true },
    { name: 'rank', description: 'Rank name', required: true },
  ],
  'department-rank-remove': [
    { name: 'department', description: 'Department name', required: true },
    { name: 'rank', description: 'Rank name', required: true },
  ],
  promote: [
    { name: 'user', description: 'Discord member', type: 6, required: true },
    { name: 'department', description: 'Department name', required: true },
    { name: 'rank', description: 'New rank', required: true },
  ],
  demote: [
    { name: 'user', description: 'Discord member', type: 6, required: true },
    { name: 'department', description: 'Department name', required: true },
    { name: 'rank', description: 'New rank', required: true },
  ],
  'on-duty': [{ name: 'department', description: 'Department name', required: true }],
  'duty-roster': [{ name: 'department', description: 'Department name', required: false }],
  'department-stats': [{ name: 'department', description: 'Department name', required: true }],
  'activity': [{ name: 'user', description: 'Discord member', type: 6, required: false }],
  'ingame-ban': [
    { name: 'player', description: 'In-game player identifier', required: true },
    { name: 'reason', description: 'Reason for record', required: true },
    { name: 'duration', description: 'Duration in minutes', type: 4, required: false },
  ],
  'ingame-kick': [
    { name: 'player', description: 'In-game player identifier', required: true },
    { name: 'reason', description: 'Reason for record', required: true },
  ],
  'ingame-warning': [
    { name: 'player', description: 'In-game player identifier', required: true },
    { name: 'reason', description: 'Reason for record', required: true },
  ],
  'ingame-search': [{ name: 'query', description: 'Player ID, name or case ID', required: true }],
  'discord-ban': [
    { name: 'user', description: 'Discord member', type: 6, required: true },
    { name: 'reason', description: 'Reason', required: true },
    { name: 'duration', description: 'Duration in minutes', type: 4, required: false },
  ],
  'discord-kick': [
    { name: 'user', description: 'Discord member', type: 6, required: true },
    { name: 'reason', description: 'Reason', required: true },
  ],
  'discord-records': [{ name: 'user', description: 'Discord member', type: 6, required: false }],
  'command': [{ name: 'name', description: 'Command name', required: true }],
  'userinfo': [{ name: 'user', description: 'Discord member', type: 6, required: false }],
  'avatar': [{ name: 'user', description: 'Discord member', type: 6, required: false }],
};

function commandBuilder(name: string, description: string) {
  const builder = new SlashCommandBuilder().setName(name).setDescription(description.slice(0, 100));
  for (const option of optionMap[name] || []) {
    builder.addStringOption((o) => o.setName(option.name).setDescription(option.description).setRequired(Boolean(option.required)).setAutocomplete(false));
  }
  // Rebuild numeric options after strings. Discord requires the option type to match the interaction.
  return builder;
}

// Discord.js option builders are overloaded; define numeric options separately to keep registration predictable.
function buildCommand(name: string, description: string) {
  const builder = new SlashCommandBuilder().setName(name).setDescription(description.slice(0, 100));
  for (const option of optionMap[name] || []) {
    if (option.type === 4) builder.addIntegerOption((o) => o.setName(option.name).setDescription(option.description).setRequired(Boolean(option.required)));
    else if (option.type === 6) builder.addUserOption((o) => o.setName(option.name).setDescription(option.description).setRequired(Boolean(option.required)));
    else builder.addStringOption((o) => o.setName(option.name).setDescription(option.description).setRequired(Boolean(option.required)));
  }
  return builder;
}

async function registerCommands() {
  const body = COMMANDS.map((definition) => buildCommand(definition.name, definition.description).toJSON());
  await rest.put(Routes.applicationCommands(clientId), { body });
}

async function getConfig(guildId: string): Promise<{ guildId: string; version: number; config: GuildConfig }> {
  const guild = await ensureGuild(guildId);
  const latest = await prisma.configVersion.findUnique({ where: { guildId_version: { guildId, version: guild.configVersion } } });
  return { guildId, version: guild.configVersion, config: (latest?.data || DEFAULT_CONFIG) as GuildConfig };
}

function render(template: string, values: Record<string, string | number>) {
  return template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

function buildConfiguredEmbed(template: GuildConfig['embeds'][keyof GuildConfig['embeds']], values: Record<string, string | number>) {
  const embed = new EmbedBuilder()
    .setTitle(render(template.title, values))
    .setDescription(render(template.description, values))
    .setColor(template.color as `#${string}`)
    .setFooter({ text: template.footer });
  return embed;
}

async function sendAutomation(guildId: string, key: keyof GuildConfig['embeds'], values: Record<string, string | number>) {
  const config = await getConfig(guildId);
  const channelId = config.config.announcementChannelId;
  if (!channelId) return false;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !(channel instanceof TextChannel)) return false;
  const template = config.config.embeds[key];
  if (!template.enabled) return false;
  const embed = buildConfiguredEmbed(template, values);
  await channel.send({ embeds: [embed] });
  return true;
}

async function syncPresence(config: GuildConfig) {
  const presence = config.presence;
  const activities = [];
  const typeMap: Record<string, ActivityType> = {
    playing: ActivityType.Playing,
    watching: ActivityType.Watching,
    listening: ActivityType.Listening,
    streaming: ActivityType.Streaming,
    custom: ActivityType.Custom,
  };
  const type = typeMap[presence.activityType] ?? ActivityType.Playing;
  const activity: { name: string; type: ActivityType; url?: string } = { name: presence.activityText || 'Emergency Hamburg RP', type };
  if (type === ActivityType.Streaming && presence.streamUrl) activity.url = presence.streamUrl;
  activities.push(activity);
  client.user?.setPresence({ status: presence.status, activities });
}

async function heartbeat() {
  const now = new Date();
  for (const guild of client.guilds.cache.values()) {
    await prisma.botHeartbeat.upsert({
      where: { guildId: guild.id },
      update: { status: 'online', latencyMs: Math.max(0, client.ws.ping), uptimeSeconds: Math.floor((Date.now() - bootedAt) / 1000), version, lastSeen: now },
      create: { guildId: guild.id, status: 'online', latencyMs: Math.max(0, client.ws.ping), uptimeSeconds: Math.floor((Date.now() - bootedAt) / 1000), version, lastSeen: now },
    });
  }
}

async function controlLoop() {
  if (shuttingDown) return;
  const request = await prisma.controlRequest.findFirst({ where: { status: 'pending', type: { in: ['RESTART', 'MAINTENANCE_OFF', 'MAINTENANCE_ON'] } }, orderBy: { createdAt: 'asc' } });
  if (!request) return;

  await prisma.controlRequest.update({ where: { id: request.id }, data: { status: 'processing', claimedAt: new Date() } });
  if (request.type === 'RESTART') {
    shuttingDown = true;
    await prisma.controlRequest.update({ where: { id: request.id }, data: { status: 'completed', completedAt: new Date() } });
    for (const guild of client.guilds.cache.values()) {
      await prisma.botHeartbeat.updateMany({ where: { guildId: guild.id }, data: { status: 'restarting', lastSeen: new Date() } });
    }
    client.destroy();
    process.exit(0);
  }
  if (request.type === 'MAINTENANCE_ON' || request.type === 'MAINTENANCE_OFF') {
    const enabled = request.type === 'MAINTENANCE_ON';
    for (const guild of client.guilds.cache.values()) {
      await prisma.botHeartbeat.updateMany({ where: { guildId: guild.id }, data: { maintenance: enabled } });
    }
    await prisma.controlRequest.update({ where: { id: request.id }, data: { status: 'completed', completedAt: new Date() } });
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
  const definition = COMMANDS.find((command) => command.name === interaction.commandName);
  if (!definition) return;

  const cooldownKey = `${interaction.guildId}:${interaction.user.id}:${interaction.commandName}`;
  const last = cooldowns.get(cooldownKey) || 0;
  const remaining = definition.cooldownSeconds * 1000 - (Date.now() - last);
  if (remaining > 0) return interaction.reply({ content: `Please wait ${Math.ceil(remaining / 1000)}s before using this command again.`, ephemeral: true });
  cooldowns.set(cooldownKey, Date.now());

  const { config, version: configVersion } = await getConfig(interaction.guildId);
  const session = await prisma.session.findFirst({ where: { guildId: interaction.guildId, status: 'active' }, orderBy: { startedAt: 'desc' } });

  switch (interaction.commandName) {
    case 'session-start': {
      const serverName = interaction.options.getString('server-name') || config.serverName;
      const serverCode = interaction.options.getString('server-code') || config.serverCode || null;
      const capacity = interaction.options.getInteger('capacity') || config.serverCapacity;
      if (session) return interaction.reply({ content: `A roleplay session is already active (${session.serverName || serverName}).`, ephemeral: true });
      const created = await prisma.session.create({ data: { guildId: interaction.guildId, serverName, serverCode, capacity } });
      await sendAutomation(interaction.guildId, 'sessionStart', { serverName, serverCode: serverCode || '—', players: 0, capacity });
      await writeAudit(interaction.guildId, interaction.user.id, 'SESSION_STARTED', created.id, { configVersion });
      return interaction.reply({ content: `✅ Session started: **${serverName}**${serverCode ? ` • code \`${serverCode}\`` : ''}.`, ephemeral: true });
    }
    case 'session-end': {
      if (!session) return interaction.reply({ content: 'No active roleplay session.', ephemeral: true });
      await prisma.session.update({ where: { id: session.id }, data: { status: 'ended', endedAt: new Date() } });
      await sendAutomation(interaction.guildId, 'sessionEnd', { serverName: session.serverName || config.serverName, players: session.currentPlayers, capacity: session.capacity });
      await writeAudit(interaction.guildId, interaction.user.id, 'SESSION_ENDED', session.id, {});
      return interaction.reply({ content: `🏁 Session ended. Peak players: **${session.peakPlayers}**.`, ephemeral: true });
    }
    case 'session-info':
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎮 Active Roleplay Session').setColor('#5865F2').addFields(
        { name: 'Status', value: session ? 'Active' : 'Offline', inline: true },
        { name: 'Server', value: session?.serverName || '—', inline: true },
        { name: 'Players', value: session ? `${session.currentPlayers}/${session.capacity}` : '—', inline: true },
        { name: 'Server code', value: session?.serverCode || config.serverCode || '—', inline: true },
        { name: 'Peak', value: session ? String(session.peakPlayers) : '—', inline: true },
        { name: 'Started', value: session ? `<t:${Math.floor(session.startedAt.getTime() / 1000)}:R>` : '—', inline: true },
      )], ephemeral: true });
    case 'server-status':
    case 'player-count':
    case 'staff-status': {
      const staffCount = session ? await prisma.member.count({ where: { guildId: interaction.guildId, staff: true, onDuty: true } }) : 0;
      return interaction.reply({ content: session ? `🟢 **${session.serverName || config.serverName}** — ${session.currentPlayers}/${session.capacity} players • ${staffCount} staff on duty.` : '⚫ No active roleplay session.', ephemeral: true });
    }
    case 'server-code':
      return interaction.reply({ content: `Current server code: **${session?.serverCode || config.serverCode || 'Not configured'}**`, ephemeral: true });
    case 'server-startup': {
      const code = interaction.options.getString('server-code') || session?.serverCode || config.serverCode || '—';
      const players = interaction.options.getInteger('players') ?? session?.currentPlayers ?? 0;
      await sendAutomation(interaction.guildId, 'startup', { owner: interaction.guild?.ownerId || '—', startedBy: interaction.user.username, serverCode: code, players, capacity: session?.capacity || config.serverCapacity, serverName: session?.serverName || config.serverName });
      return interaction.reply({ content: '🟢 Startup announcement sent.', ephemeral: true });
    }
    case 'server-full': {
      const players = interaction.options.getInteger('players') ?? session?.currentPlayers ?? session?.capacity ?? config.serverCapacity;
      await sendAutomation(interaction.guildId, 'serverFull', { players, capacity: session?.capacity || config.serverCapacity, serverCode: session?.serverCode || config.serverCode || '—', serverName: session?.serverName || config.serverName });
      return interaction.reply({ content: '🔴 Server-full announcement sent.', ephemeral: true });
    }
    case 'join-server':
      return interaction.reply({ content: config.joinUrl ? `🔗 ${config.joinUrl}` : 'No join URL has been configured in the dashboard.', ephemeral: true });
    case 'staff-roster':
    case 'duty-roster': {
      const members = await prisma.member.findMany({ where: { guildId: interaction.guildId, staff: true, onDuty: true }, take: 30 });
      return interaction.reply({ content: members.length ? `👮 On duty (${members.length}): ${members.map((m) => `<@${m.discordId}>`).join(', ')}` : 'No staff are currently marked on duty.', ephemeral: true });
    }
    case 'staff-check': {
      const staffCount = await prisma.member.count({ where: { guildId: interaction.guildId, staff: true, onDuty: true } });
      return interaction.reply({ content: staffCount ? `🟢 ${staffCount} staff member(s) on duty.` : '⚠️ No staff are marked on duty.', ephemeral: true });
    }
    case 'operation-start': {
      if (!session) return interaction.reply({ content: 'Start a roleplay session before starting an operation.', ephemeral: true });
      const name = interaction.options.getString('name', true);
      const type = interaction.options.getString('type') || 'Custom';
      const operation = await prisma.operation.create({ data: { guildId: interaction.guildId, sessionId: session.id, name, type } });
      await sendAutomation(interaction.guildId, 'operationStart', { operation: name, type });
      await writeAudit(interaction.guildId, interaction.user.id, 'OPERATION_STARTED', operation.id, { type });
      return interaction.reply({ content: `🚨 Operation **${name}** started.`, ephemeral: true });
    }
    case 'operation-end': {
      const op = await prisma.operation.findFirst({ where: { guildId: interaction.guildId, status: 'active' }, orderBy: { startedAt: 'desc' } });
      if (!op) return interaction.reply({ content: 'No active operation.', ephemeral: true });
      await prisma.operation.update({ where: { id: op.id }, data: { status: 'ended', endedAt: new Date() } });
      await sendAutomation(interaction.guildId, 'operationEnd', { operation: op.name, type: op.type || 'Custom' });
      return interaction.reply({ content: `✅ Operation **${op.name}** completed.`, ephemeral: true });
    }
    case 'operation-info':
    case 'operation-roster': {
      const query = interaction.options.getString('operation', true);
      const op = await prisma.operation.findFirst({ where: { guildId: interaction.guildId, OR: [{ id: query }, { name: { equals: query, mode: 'insensitive' } }] }, orderBy: { startedAt: 'desc' } });
      if (!op) return interaction.reply({ content: 'Operation not found.', ephemeral: true });
      const participants = Array.isArray(op.participants) ? (op.participants as string[]) : [];
      return interaction.reply({ content: `🚨 **${op.name}** • ${op.type || 'Custom'}\nStatus: **${op.status}**\nParticipants: ${participants.length ? participants.map((id) => `<@${id}>`).join(', ') : 'None'}`, ephemeral: true });
    }
    case 'operation-join':
    case 'operation-leave': {
      const query = interaction.options.getString('operation', true);
      const op = await prisma.operation.findFirst({ where: { guildId: interaction.guildId, OR: [{ id: query }, { name: { equals: query, mode: 'insensitive' } }], status: 'active' }, orderBy: { startedAt: 'desc' } });
      if (!op) return interaction.reply({ content: 'Active operation not found.', ephemeral: true });
      const current = Array.isArray(op.participants) ? [...(op.participants as string[])] : [];
      const included = current.includes(interaction.user.id);
      const next = interaction.commandName === 'operation-join' ? Array.from(new Set([...current, interaction.user.id])) : current.filter((id) => id !== interaction.user.id);
      await prisma.operation.update({ where: { id: op.id }, data: { participants: next } });
      return interaction.reply({ content: interaction.commandName === 'operation-join' ? (included ? 'You are already on the roster.' : `✅ Joined **${op.name}**.`) : (included ? `✅ Left **${op.name}**.` : 'You were not on the roster.'), ephemeral: true });
    }
    case 'department-create': {
      const name = interaction.options.getString('name', true);
      const existing = await prisma.department.findUnique({ where: { guildId_name: { guildId: interaction.guildId, name } } });
      if (existing) return interaction.reply({ content: 'That department already exists.', ephemeral: true });
      await prisma.department.create({ data: { guildId: interaction.guildId, name } });
      return interaction.reply({ content: `👮 Department **${name}** created.`, ephemeral: true });
    }
    case 'department-list': {
      const departments = await prisma.department.findMany({ where: { guildId: interaction.guildId, enabled: true }, include: { ranks: true }, orderBy: { name: 'asc' } });
      return interaction.reply({ content: departments.length ? departments.map((d) => `• **${d.name}** — ${d.ranks.length} rank(s)`).join('\n') : 'No departments configured.', ephemeral: true });
    }
    case 'department-info':
    case 'department-roster': {
      const name = interaction.options.getString('department', true);
      const department = await prisma.department.findFirst({ where: { guildId: interaction.guildId, name: { equals: name, mode: 'insensitive' } }, include: { ranks: true, memberships: { include: { member: true, department: true } } } });
      if (!department) return interaction.reply({ content: 'Department not found.', ephemeral: true });
      const members = department.memberships.map((m) => `<@${m.member.discordId}>${m.rankId ? ` — ${department.ranks.find((r) => r.id === m.rankId)?.name || 'Member'}` : ''}`);
      return interaction.reply({ content: `👮 **${department.name}**\n${department.description || 'No description.'}\n\nRoster: ${members.length ? members.join(', ') : 'Empty'}\nRanks: ${department.ranks.map((r) => r.name).join(', ') || 'None'}`, ephemeral: true });
    }
    case 'department-join':
    case 'department-leave': {
      const name = interaction.options.getString('department', true);
      const department = await prisma.department.findFirst({ where: { guildId: interaction.guildId, name: { equals: name, mode: 'insensitive' } } });
      if (!department) return interaction.reply({ content: 'Department not found.', ephemeral: true });
      const member = await prisma.member.upsert({ where: { guildId_discordId: { guildId: interaction.guildId, discordId: interaction.user.id } }, update: { displayName: interaction.user.displayName }, create: { guildId: interaction.guildId, discordId: interaction.user.id, displayName: interaction.user.displayName } });
      if (interaction.commandName === 'department-join') await prisma.departmentMembership.upsert({ where: { memberId_departmentId: { memberId: member.id, departmentId: department.id } }, update: {}, create: { memberId: member.id, departmentId: department.id } });
      else await prisma.departmentMembership.deleteMany({ where: { memberId: member.id, departmentId: department.id } });
      return interaction.reply({ content: interaction.commandName === 'department-join' ? `✅ Joined **${department.name}**.` : `✅ Left **${department.name}**.`, ephemeral: true });
    }
    case 'on-duty': {
      const departmentName = interaction.options.getString('department', true);
      const department = await prisma.department.findFirst({ where: { guildId: interaction.guildId, name: { equals: departmentName, mode: 'insensitive' } } });
      if (!department) return interaction.reply({ content: 'Department not found.', ephemeral: true });
      await prisma.member.upsert({ where: { guildId_discordId: { guildId: interaction.guildId, discordId: interaction.user.id } }, update: { displayName: interaction.user.displayName, staff: true, onDuty: true, dutyDepartmentId: department.id, dutyStartedAt: new Date() }, create: { guildId: interaction.guildId, discordId: interaction.user.id, displayName: interaction.user.displayName, staff: true, onDuty: true, dutyDepartmentId: department.id, dutyStartedAt: new Date() } });
      return interaction.reply({ content: `🟢 You are now on duty in **${department.name}**.`, ephemeral: true });
    }
    case 'off-duty': {
      await prisma.member.updateMany({ where: { guildId: interaction.guildId, discordId: interaction.user.id }, data: { onDuty: false, dutyDepartmentId: null, dutyStartedAt: null } });
      return interaction.reply({ content: '⚪ You are now off duty.', ephemeral: true });
    }
    case 'duty-status': {
      const member = await prisma.member.findUnique({ where: { guildId_discordId: { guildId: interaction.guildId, discordId: interaction.user.id } } });
      return interaction.reply({ content: member?.onDuty ? `🟢 On duty${member.dutyStartedAt ? ` since <t:${Math.floor(member.dutyStartedAt.getTime() / 1000)}:R>` : ''}.` : '⚪ Off duty.', ephemeral: true });
    }
    case 'ingame-ban':
    case 'ingame-kick':
    case 'ingame-warning': {
      const player = interaction.options.getString('player', true);
      const reason = interaction.options.getString('reason', true);
      const duration = interaction.options.getInteger('duration');
      const record = await prisma.record.create({ data: { guildId: interaction.guildId, scope: 'ingame', action: interaction.commandName.replace('ingame-', ''), subjectId: player, reason, durationSeconds: duration ? duration * 60 : null, issuedBy: interaction.user.id, sessionId: session?.id } });
      return interaction.reply({ content: `📋 In-game record created: **${record.id}**.`, ephemeral: true });
    }
    case 'ingame-search': {
      const q = interaction.options.getString('query', true);
      const records = await prisma.record.findMany({ where: { guildId: interaction.guildId, scope: 'ingame', OR: [{ subjectId: { contains: q, mode: 'insensitive' } }, { subjectName: { contains: q, mode: 'insensitive' } }, { id: q }] }, orderBy: { createdAt: 'desc' }, take: 10 });
      return interaction.reply({ content: records.length ? records.map((r) => `**${r.id}** • ${r.action} • ${r.subjectId} • ${r.reason || 'No reason'}`).join('\n') : 'No matching in-game records.', ephemeral: true });
    }
    case 'discord-ban':
    case 'discord-kick': {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);
      const duration = interaction.options.getInteger('duration');
      const action = interaction.commandName.replace('discord-', '');
      const record = await prisma.record.create({ data: { guildId: interaction.guildId, scope: 'discord', action, subjectId: user.id, subjectName: user.username, reason, durationSeconds: duration ? duration * 60 : null, issuedBy: interaction.user.id, sessionId: session?.id } });
      return interaction.reply({ content: `📋 Discord record created: **${record.id}**. This record command does not automatically apply a guild punishment.`, ephemeral: true });
    }
    case 'activity':
    case 'stats': {
      const sessions = await prisma.session.count({ where: { guildId: interaction.guildId } });
      const operations = await prisma.operation.count({ where: { guildId: interaction.guildId } });
      const records = await prisma.record.count({ where: { guildId: interaction.guildId } });
      const staff = await prisma.member.count({ where: { guildId: interaction.guildId, staff: true } });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('📊 Community Activity').setColor('#5865F2').addFields(
        { name: 'Sessions', value: String(sessions), inline: true },
        { name: 'Operations', value: String(operations), inline: true },
        { name: 'Records', value: String(records), inline: true },
        { name: 'Staff profiles', value: String(staff), inline: true },
      )], ephemeral: true });
    }
    case 'command': {
      const name = interaction.options.getString('name', true);
      const target = COMMANDS.find((c) => c.name === name);
      if (!target) return interaction.reply({ content: `Command **${name}** was not found.`, ephemeral: true });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`/${target.name}`).setDescription(target.description).setColor('#5865F2').addFields(
        { name: 'Category', value: target.category, inline: true },
        { name: 'Usage', value: `\`${target.usage}\``, inline: false },
        { name: 'Permissions', value: target.permissions.length ? target.permissions.join(', ') : 'Everyone', inline: true },
        { name: 'Cooldown', value: `${target.cooldownSeconds}s`, inline: true },
      )], ephemeral: true });
    }
    case 'help':
    case 'commands': {
      const lines = COMMANDS.reduce<Record<string, string[]>>((acc, c) => { (acc[c.category] ||= []).push(`/${c.name}`); return acc; }, {});
      const description = Object.entries(lines).map(([category, names]) => `**${category}**\n${names.join(' • ')}`).join('\n\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🧰 DRP Command Center').setDescription(description.slice(0, 3900)).setColor('#5865F2')], ephemeral: true });
    }
    case 'ping': return interaction.reply({ content: `🏓 Pong • Gateway **${client.ws.ping}ms** • Config **v${configVersion}**`, ephemeral: true });
    case 'uptime': return interaction.reply({ content: `⏱️ Uptime: <t:${Math.floor(bootedAt / 1000)}:R>`, ephemeral: true });
    case 'botinfo': return interaction.reply({ content: `🤖 DRP Control v${version}\nGuilds: **${client.guilds.cache.size}**\nLatency: **${client.ws.ping}ms**`, ephemeral: true });
    case 'serverinfo': return interaction.reply({ content: `🏠 **${interaction.guild.name}**\nMembers: **${interaction.guild.memberCount}**\nID: \`${interaction.guild.id}\``, ephemeral: true });
    case 'userinfo': {
      const user = interaction.options.getUser('user') || interaction.user;
      return interaction.reply({ content: `👤 **${user.username}**\nID: \`${user.id}\`\nCreated: <t:${Math.floor(user.createdTimestamp / 1000)}:R>`, ephemeral: true });
    }
    case 'avatar': {
      const user = interaction.options.getUser('user') || interaction.user;
      return interaction.reply({ content: user.displayAvatarURL({ size: 1024 }), ephemeral: true });
    }
    case 'health':
    case 'bot-status': {
      const heartbeat = await prisma.botHeartbeat.findUnique({ where: { guildId: interaction.guildId } });
      return interaction.reply({ content: `🤖 ${heartbeat?.status === 'online' ? 'Online' : 'Offline'} • DB **connected** • Gateway **${client.ws.ping}ms** • Heartbeat **${heartbeat ? `<t:${Math.floor(heartbeat.lastSeen.getTime() / 1000)}:R>` : 'not recorded'}** • Maintenance **${heartbeat?.maintenance ? 'ON' : 'OFF'}**`, ephemeral: true });
    }
    default:
      return interaction.reply({ content: `**/${definition.name}** is registered and ready for its configured workflow.`, ephemeral: true });
  }
}

client.once('ready', async (readyClient) => {
  console.log(`[DRP] Logged in as ${readyClient.user.tag}`);
  console.log(`[DRP] Loaded ${COMMANDS.length} commands`);
  const firstGuild = readyClient.guilds.cache.first();
  if (firstGuild) {
    const { config } = await getConfig(firstGuild.id).catch(() => ({ config: DEFAULT_CONFIG }));
    await syncPresence(config);
  }
  await registerCommands().then(() => console.log('[DRP] Slash commands registered')).catch((error) => console.error('[DRP] Command registration failed:', error));
  await heartbeat().catch((error) => console.error('[DRP] Heartbeat failed:', error));
  setInterval(() => heartbeat().catch((error) => console.error('[DRP] Heartbeat failed:', error)), 15_000);
  setInterval(() => controlLoop().catch((error) => console.error('[DRP] Control loop failed:', error)), 5_000);
});

client.on('guildCreate', async (guild) => { await ensureGuild(guild.id, guild.name); });
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try { await handleCommand(interaction); }
  catch (error) { console.error(`[DRP] Command ${interaction.commandName} failed:`, error); if (interaction.replied || interaction.deferred) await interaction.followUp({ content: 'Something went wrong while processing that command.', ephemeral: true }).catch(() => undefined); else await interaction.reply({ content: 'Something went wrong while processing that command.', ephemeral: true }).catch(() => undefined); }
});

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[DRP] ${signal} received; shutting down gracefully.`);
  for (const guild of client.guilds.cache.values()) await prisma.botHeartbeat.updateMany({ where: { guildId: guild.id }, data: { status: 'offline', lastSeen: new Date() } }).catch(() => undefined);
  client.destroy();
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

client.login(token);
