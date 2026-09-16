import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'drp-dashboard',
    database: Boolean(process.env.DATABASE_URL),
    timestamp: new Date().toISOString(),
  });
}
