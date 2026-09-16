export type CommandCategory =
  | 'roleplay'
  | 'departments'
  | 'records'
  | 'sessions'
  | 'statistics'
  | 'activity'
  | 'configuration'
  | 'bot'
  | 'utility';

export type CommandDefinition = {
  name: string;
  category: CommandCategory;
  description: string;
  usage: string;
  permissions: string[];
  cooldownSeconds: number;
  dashboard: boolean;
  options?: Array<{ name: string; description: string; required?: boolean }>;
  examples?: string[];
};

const command = (
  name: string,
  category: CommandCategory,
  description: string,
  usage: string,
  permissions: string[] = [],
  options: CommandDefinition['options'] = [],
  examples: string[] = [],
  cooldownSeconds = 3,
): CommandDefinition => ({
  name,
  category,
  description,
  usage,
  permissions,
  cooldownSeconds,
  dashboard: true,
  options,
  examples,
});

export const COMMANDS: CommandDefinition[] = [
  command('session-start', 'roleplay', 'Start a roleplay session and publish the configured session announcement.', '/session-start [server-code] [server-name]', ['Manage Guild']),
  command('session-end', 'roleplay', 'End the active roleplay session and record its final statistics.', '/session-end', ['Manage Guild']),
  command('session-info', 'roleplay', 'Show the active session, server, player count and staff presence.', '/session-info'),
  command('session-roster', 'roleplay', 'Show the current session roster.', '/session-roster'),
  command('server-startup', 'roleplay', 'Publish a server startup announcement with configurable fields and a join button.', '/server-startup [server-code] [players]', ['Manage Guild']),
  command('server-close', 'roleplay', 'Publish the configured server close announcement.', '/server-close', ['Manage Guild']),
  command('server-status', 'roleplay', 'Show the latest known roleplay server status.', '/server-status'),
  command('server-code', 'roleplay', 'Display the configured current server code.', '/server-code'),
  command('server-full', 'roleplay', 'Publish a server-full alert when capacity is reached.', '/server-full [players]', ['Manage Guild']),
  command('player-count', 'roleplay', 'Show the latest tracked player count and capacity.', '/player-count'),
  command('staff-status', 'roleplay', 'Show whether configured staff are currently present.', '/staff-status'),
  command('staff-roster', 'roleplay', 'List staff currently participating in the session.', '/staff-roster'),
  command('staff-check', 'roleplay', 'Run a staff-presence check against the active session.', '/staff-check', ['Manage Guild']),
  command('activity', 'activity', 'Show activity for a member or the community leaderboard.', '/activity [user]'),
  command('operation-start', 'roleplay', 'Start a configurable RP operation and open its roster.', '/operation-start [name] [type]', ['Manage Guild']),
  command('operation-end', 'roleplay', 'End an active operation and record participation.', '/operation-end [operation]', ['Manage Guild']),
  command('operation-info', 'roleplay', 'Show operation details and participants.', '/operation-info [operation]'),
  command('operation-roster', 'roleplay', 'Show participants in an operation.', '/operation-roster [operation]'),
  command('operation-join', 'roleplay', 'Join an active operation roster.', '/operation-join [operation]'),
  command('operation-leave', 'roleplay', 'Leave an active operation roster.', '/operation-leave [operation]'),
  command('join-server', 'roleplay', 'Show the configured join link and current server details.', '/join-server'),

  command('department-create', 'departments', 'Create a configurable RP department.', '/department-create [name]', ['Manage Guild']),
  command('department-edit', 'departments', 'Edit a department name, role mapping or settings.', '/department-edit [department]', ['Manage Guild']),
  command('department-delete', 'departments', 'Delete a department after confirmation.', '/department-delete [department]', ['Manage Guild']),
  command('department-list', 'departments', 'List configured departments.', '/department-list'),
  command('department-info', 'departments', 'Show department configuration and roster.', '/department-info [department]'),
  command('department-roster', 'departments', 'Show members assigned to a department.', '/department-roster [department]'),
  command('department-join', 'departments', 'Join a configured department.', '/department-join [department]'),
  command('department-leave', 'departments', 'Leave a configured department.', '/department-leave [department]'),
  command('department-ranks', 'departments', 'List ranks configured for a department.', '/department-ranks [department]'),
  command('department-rank-add', 'departments', 'Add a configurable department rank.', '/department-rank-add [department] [rank]', ['Manage Guild']),
  command('department-rank-remove', 'departments', 'Remove a department rank.', '/department-rank-remove [department] [rank]', ['Manage Guild']),
  command('promote', 'departments', 'Promote a member within a configured department.', '/promote [user] [department] [rank]', ['Manage Guild']),
  command('demote', 'departments', 'Demote a member within a configured department.', '/demote [user] [department] [rank]', ['Manage Guild']),
  command('on-duty', 'departments', 'Mark yourself on duty for a department.', '/on-duty [department]'),
  command('off-duty', 'departments', 'Mark yourself off duty.', '/off-duty'),
  command('duty-status', 'departments', 'Show your current duty status.', '/duty-status'),
  command('duty-roster', 'departments', 'Show members currently on duty.', '/duty-roster [department]'),
  command('department-stats', 'departments', 'Show participation statistics for a department.', '/department-stats [department]'),

  command('ingame-ban', 'records', 'Create an RP in-game punishment record.', '/ingame-ban [player] [reason] [duration]', ['Manage Guild']),
  command('ingame-unban', 'records', 'Record an in-game unban action.', '/ingame-unban [player] [reason]', ['Manage Guild']),
  command('ingame-kick', 'records', 'Create an RP in-game kick record.', '/ingame-kick [player] [reason]', ['Manage Guild']),
  command('ingame-record', 'records', 'Show one in-game record by case or player.', '/ingame-record [case-id]'),
  command('ingame-records', 'records', 'Search in-game records.', '/ingame-records [player]'),
  command('ingame-warning', 'records', 'Create an in-game warning record.', '/ingame-warning [player] [reason]', ['Manage Guild']),
  command('ingame-search', 'records', 'Search the in-game record database.', '/ingame-search [query]', ['Manage Guild']),
  command('discord-ban', 'records', 'Create a Discord server punishment record.', '/discord-ban [user] [reason] [duration]', ['Ban Members']),
  command('discord-unban', 'records', 'Record a Discord server unban.', '/discord-unban [user] [reason]', ['Ban Members']),
  command('discord-kick', 'records', 'Create a Discord server kick record.', '/discord-kick [user] [reason]', ['Kick Members']),
  command('discord-record', 'records', 'Show one Discord record by case or user.', '/discord-record [case-id]'),
  command('discord-records', 'records', 'Search Discord server records.', '/discord-records [user]'),

  command('setup', 'configuration', 'Open the guided server configuration flow.', '/setup', ['Manage Guild']),
  command('config', 'configuration', 'Open the configuration overview.', '/config', ['Manage Guild']),
  command('channel-config', 'configuration', 'Configure channels used by announcements, logs and dashboards.', '/channel-config', ['Manage Guild']),
  command('role-config', 'configuration', 'Configure staff, department and dashboard access roles.', '/role-config', ['Manage Guild']),
  command('log-config', 'configuration', 'Configure audit and activity log destinations.', '/log-config', ['Manage Guild']),
  command('embed-config', 'configuration', 'Configure announcement embed templates.', '/embed-config', ['Manage Guild']),
  command('automation-config', 'configuration', 'Configure player, staff and session automations.', '/automation-config', ['Manage Guild']),
  command('permission-config', 'configuration', 'Configure command permissions.', '/permission-config', ['Manage Guild']),
  command('reset-config', 'configuration', 'Reset selected configuration after confirmation.', '/reset-config [section]', ['Administrator']),

  command('bot-status', 'bot', 'Show bot presence, connection, uptime and health.', '/bot-status'),
  command('health', 'bot', 'Show bot and database health.', '/health'),
  command('stats', 'statistics', 'Show community, session, staff and department statistics.', '/stats'),
  command('help', 'utility', 'Browse every command by category or inspect a single command in detail.', '/help [command]'),
  command('commands', 'utility', 'List enabled commands grouped by category.', '/commands'),
  command('command', 'utility', 'Show detailed information for one command.', '/command [name]'),
  command('ping', 'utility', 'Check Discord gateway latency.', '/ping'),
  command('botinfo', 'utility', 'Show bot version, uptime and runtime information.', '/botinfo'),
  command('serverinfo', 'utility', 'Show Discord server configuration and identifiers.', '/serverinfo'),
  command('userinfo', 'utility', 'Show public information about a Discord member.', '/userinfo [user]'),
  command('avatar', 'utility', 'Show a member avatar.', '/avatar [user]'),
  command('uptime', 'utility', 'Show bot uptime.', '/uptime'),
];

export const COMMAND_CATEGORIES = [
  { id: 'roleplay', label: '🎮 Roleplay' },
  { id: 'departments', label: '👮 Departments' },
  { id: 'records', label: '📋 Records' },
  { id: 'sessions', label: '📢 Sessions & Announcements' },
  { id: 'statistics', label: '📊 Statistics' },
  { id: 'activity', label: '🏆 Activity' },
  { id: 'configuration', label: '⚙️ Configuration' },
  { id: 'bot', label: '🤖 Bot' },
  { id: 'utility', label: '🧰 Utility' },
] as const;
