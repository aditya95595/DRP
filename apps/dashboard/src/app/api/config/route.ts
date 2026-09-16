import { NextResponse } from 'next/server';
import { DEFAULT_CONFIG, GuildConfigSchema, ensureGuild, prisma, writeAudit } from '@drp/core';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireManagedGuild } from '@/lib/discord';

export const runtime = 'nodejs';

async function actorId() {
  const session = await getServerSession(authOptions);
  return session?.user?.name || session?.user?.email || null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { guildId?: string; action?: string; config?: unknown; restoreVersion?: number };
    if (!body.guildId) return NextResponse.json({ error: 'guildId is required' }, { status: 400 });
    await requireManagedGuild(body.guildId);
    const actor = await actorId();
    const guild = await ensureGuild(body.guildId);

    if (body.action === 'restore') {
      if (!body.restoreVersion) return NextResponse.json({ error: 'restoreVersion is required' }, { status: 400 });
      const previous = await prisma.configVersion.findUnique({ where: { guildId_version: { guildId: body.guildId, version: body.restoreVersion } } });
      if (!previous) return NextResponse.json({ error: 'Configuration version not found' }, { status: 404 });
      body.config = previous.data;
    }

    if (body.action === 'maintenance-on' || body.action === 'maintenance-off') {
      await prisma.controlRequest.create({ data: { guildId: body.guildId, type: body.action === 'maintenance-on' ? 'MAINTENANCE_ON' : 'MAINTENANCE_OFF', requestedBy: actor } });
      await writeAudit(body.guildId, actor, body.action.toUpperCase(), undefined, {});
      return NextResponse.json({ ok: true });
    }

    const parsed = GuildConfigSchema.parse(body.config || DEFAULT_CONFIG);
    const version = guild.configVersion + 1;
    await prisma.$transaction([
      prisma.configVersion.create({ data: { guildId: body.guildId, version, data: parsed, savedBy: actor } }),
      prisma.guild.update({ where: { id: body.guildId }, data: { configVersion: version } }),
      prisma.auditLog.create({ data: { guildId: body.guildId, actorId: actor, action: 'CONFIG_SAVED', target: `v${version}` } }),
    ]);

    let restartQueued = false;
    if (body.action === 'save-restart') {
      await prisma.controlRequest.create({ data: { guildId: body.guildId, type: 'RESTART', payload: { configVersion: version }, requestedBy: actor } });
      restartQueued = true;
    }

    return NextResponse.json({ ok: true, version, restartQueued });
  } catch (error) {
    console.error('[DRP dashboard] config save failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Configuration save failed' }, { status: 400 });
  }
}
