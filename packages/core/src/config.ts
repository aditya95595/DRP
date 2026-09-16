import { z } from 'zod';

export const PresenceSchema = z.object({
  status: z.enum(['online', 'idle', 'dnd', 'invisible']).default('online'),
  activityType: z.enum(['playing', 'watching', 'listening', 'streaming', 'custom']).default('playing'),
  activityText: z.string().max(128).default('Emergency Hamburg RP'),
  streamUrl: z.string().url().optional().or(z.literal('')),
  rotationEnabled: z.boolean().default(false),
  rotationSeconds: z.number().int().min(5).max(3600).default(30),
});

export const AutomationSchema = z.object({
  lowPlayerEnabled: z.boolean().default(true),
  lowPlayerThreshold: z.number().int().min(0).max(100).default(8),
  lowPlayerCooldownMinutes: z.number().int().min(1).max(1440).default(15),
  noStaffEnabled: z.boolean().default(true),
  noStaffDelayMinutes: z.number().int().min(1).max(240).default(5),
  fullServerEnabled: z.boolean().default(true),
  startupEnabled: z.boolean().default(true),
  staffPresenceEnabled: z.boolean().default(true),
});

export const EmbedTemplateSchema = z.object({
  enabled: z.boolean().default(true),
  title: z.string().max(256),
  description: z.string().max(4096),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#5865F2'),
  footer: z.string().max(2048).default('DRP Control'),
  joinButtonLabel: z.string().max(80).default('Join Server ↗'),
  joinUrl: z.string().url().optional().or(z.literal('')),
});

export const GuildConfigSchema = z.object({
  guildName: z.string().max(100).default('District Roleplay'),
  serverName: z.string().max(100).default('District Roleplay'),
  serverCode: z.string().max(64).default(''),
  serverCapacity: z.number().int().min(1).max(1000).default(50),
  joinUrl: z.string().url().optional().or(z.literal('')),
  staffRoleIds: z.array(z.string()).default([]),
  announcementChannelId: z.string().default(''),
  logChannelId: z.string().default(''),
  presence: PresenceSchema,
  automation: AutomationSchema,
  embeds: z.object({
    startup: EmbedTemplateSchema,
    lowPlayers: EmbedTemplateSchema,
    serverFull: EmbedTemplateSchema,
    noStaff: EmbedTemplateSchema,
    staffRestored: EmbedTemplateSchema,
    staffLost: EmbedTemplateSchema,
    sessionStart: EmbedTemplateSchema,
    sessionEnd: EmbedTemplateSchema,
    operationStart: EmbedTemplateSchema,
    operationEnd: EmbedTemplateSchema,
  }),
});

export type GuildConfig = z.infer<typeof GuildConfigSchema>;

export const DEFAULT_CONFIG: GuildConfig = GuildConfigSchema.parse({
  guildName: 'District Roleplay',
  serverName: 'District Roleplay',
  serverCode: '',
  serverCapacity: 50,
  joinUrl: '',
  staffRoleIds: [],
  announcementChannelId: '',
  logChannelId: '',
  presence: {
    status: 'online',
    activityType: 'playing',
    activityText: 'Emergency Hamburg RP',
    streamUrl: '',
    rotationEnabled: false,
    rotationSeconds: 30,
  },
  automation: {},
  embeds: {
    startup: { title: '🟢 SERVER STARTUP', description: '**{serverName}** is now online.\n\nServer Owner: **{owner}**\nServer Code: **{serverCode}**\nStarted By: **{startedBy}**\nPlayers: **{players} / {capacity}**', color: '#35C759', footer: 'DRP • Server Status', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    lowPlayers: { title: '🟠 LOW PLAYER COUNT', description: 'The current roleplay session has a low player count.\n\nConsider joining the server and helping bring the session to life!\n\nServer Owner: **{owner}**\nServer Code: **{serverCode}**\nServer: **{serverName}**', color: '#FF9F0A', footer: 'DRP • Player Activity', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    serverFull: { title: '🔴 SERVER FULL', description: 'The current Emergency Hamburg RP server is full.\n\nPlayers: **{players}/{capacity}**\nServer: **{serverName}**\nServer Code: **{serverCode}**', color: '#FF453A', footer: 'DRP • Server Status', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    noStaff: { title: '⚠️ NO STAFF ONLINE', description: 'The roleplay server is running without staff.\n\nPlayers: **{players}/{capacity}**\nStaff: **0**\n\nA staff member should join.', color: '#FFD60A', footer: 'DRP • Staff Presence', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    staffRestored: { title: '🟢 STAFF PRESENCE RESTORED', description: 'Staff presence has been restored for the active roleplay session.\n\nPlayers: **{players}/{capacity}**\nStaff online: **{staff}**', color: '#30D158', footer: 'DRP • Staff Presence', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    staffLost: { title: '⚠️ STAFF PRESENCE LOST', description: 'No configured staff are currently present in the active roleplay session.\n\nPlayers: **{players}/{capacity}**', color: '#FF9F0A', footer: 'DRP • Staff Presence', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    sessionStart: { title: '🎮 ROLEPLAY SESSION STARTED', description: 'A new roleplay session is now active.', color: '#5865F2', footer: 'DRP • Sessions', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    sessionEnd: { title: '🏁 ROLEPLAY SESSION ENDED', description: 'The active roleplay session has ended.', color: '#8E8E93', footer: 'DRP • Sessions', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    operationStart: { title: '🚨 OPERATION STARTED', description: 'A new roleplay operation has started.', color: '#AF52DE', footer: 'DRP • Operations', joinButtonLabel: 'VIEW ROSTER', joinUrl: '' },
    operationEnd: { title: '✅ OPERATION COMPLETED', description: 'The roleplay operation has ended.', color: '#32D74B', footer: 'DRP • Operations', joinButtonLabel: 'VIEW REPORT', joinUrl: '' },
  },
});

export function mergeConfig(data: unknown): GuildConfig {
  return GuildConfigSchema.parse({ ...DEFAULT_CONFIG, ...(data as object) });
}
