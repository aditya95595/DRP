import { NextResponse } from 'next/server';
import { prisma, ensureGuild } from '@drp/core';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.STATUS_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Server status ingestion is not configured.' }, { status: 503 });
  const supplied = request.headers.get('x-drp-status-secret');
  if (!supplied || supplied !== secret) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const body = await request.json() as { guildId?: string; serverName?: string; serverCode?: string; players?: number; capacity?: number };
    if (!body.guildId || typeof body.players !== 'number') return NextResponse.json({ error: 'guildId and players are required.' }, { status: 400 });
    const guild = await ensureGuild(body.guildId);
    const active = await prisma.session.findFirst({ where: { guildId: body.guildId, status: 'active' }, orderBy: { startedAt: 'desc' } });
    const payload = { guildId: body.guildId, serverName: body.serverName || active?.serverName || guild.name || 'RP Server', serverCode: body.serverCode || active?.serverCode || '', players: Math.max(0, Math.floor(body.players)), capacity: Math.max(1, Math.floor(body.capacity || active?.capacity || 50)) };
    await prisma.controlRequest.create({ data: { guildId: body.guildId, type: 'SERVER_STATUS_UPDATE', payload } });
    return NextResponse.json({ ok: true, queued: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid payload.' }, { status: 400 });
  }
}
