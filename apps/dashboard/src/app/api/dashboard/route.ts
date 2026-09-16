import { NextResponse } from 'next/server';
import { prisma, ensureGuild, DEFAULT_CONFIG } from '@drp/core';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canManageGuild } from '@/lib/discord';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get('guildId');
  if (!guildId) return NextResponse.json({ error: 'guildId is required' }, { status: 400 });

  const session = await getServerSession(authOptions);
  const authenticated = Boolean(session?.user);
  const authorized = authenticated ? await canManageGuild(guildId) : false;

  const guild = await ensureGuild(guildId);
  const latest = await prisma.configVersion.findFirst({ where: { guildId }, orderBy: { version: 'desc' } });
  const config = (latest?.data || DEFAULT_CONFIG) as typeof DEFAULT_CONFIG;
  const heartbeat = await prisma.botHeartbeat.findUnique({ where: { guildId } });
  const activeSession = await prisma.session.findFirst({ where: { guildId, status: 'active' }, orderBy: { startedAt: 'desc' } });
  const [sessions, operations, records, staff, departments] = await Promise.all([
    prisma.session.count({ where: { guildId } }),
    prisma.operation.count({ where: { guildId } }),
    prisma.record.count({ where: { guildId } }),
    prisma.member.count({ where: { guildId, staff: true } }),
    prisma.department.count({ where: { guildId, enabled: true } }),
  ]);

  const recentActivity = await prisma.auditLog.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, take: 8 });
  const configVersions = await prisma.configVersion.findMany({ where: { guildId }, orderBy: { version: 'desc' }, take: 8, select: { version: true, savedBy: true, createdAt: true } });

  return NextResponse.json({
    authenticated,
    authorized,
    guild: { ...guild, configVersion: guild.configVersion },
    config,
    heartbeat,
    activeSession,
    metrics: { sessions, operations, records, staff, departments },
    recentActivity,
    configVersions,
  });
}
