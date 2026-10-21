import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Older external schedulers may still call this URL. Never claim queued jobs.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(secret ? `Bearer ${secret}` : '');
  const headers = { 'Cache-Control': 'no-store' };
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) return NextResponse.json({ error: 'Not authorized.' }, { status: 401, headers });
  return NextResponse.json({ disabled: true, attempted: 0, updated: 0 }, { status: 410, headers });
}
export const POST = GET;
