import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

export async function getDiscordGuilds(): Promise<DiscordGuild[]> {
  const session = await getServerSession(authOptions);
  const token = (session as typeof session & { discordAccessToken?: string } | null)?.discordAccessToken;
  if (!token) return [];
  const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) return [];
  return response.json();
}

export async function canManageGuild(guildId: string) {
  const guilds = await getDiscordGuilds();
  const guild = guilds.find((item) => item.id === guildId);
  if (!guild) return false;
  const permissions = BigInt(guild.permissions || '0');
  return guild.owner || (permissions & BigInt(0x20)) !== BigInt(0) || (permissions & BigInt(0x8)) !== BigInt(0);
}

export async function requireManagedGuild(guildId: string) {
  const ok = await canManageGuild(guildId);
  if (!ok) throw new Error('You do not have Manage Server access to this guild.');
}
