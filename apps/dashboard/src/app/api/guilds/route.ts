import { NextResponse } from 'next/server';
import { getDiscordGuilds } from '@/lib/discord';

export async function GET() {
  try {
    const guilds = await getDiscordGuilds();
    return NextResponse.json({ guilds });
  } catch {
    return NextResponse.json({ guilds: [] }, { status: 200 });
  }
}
