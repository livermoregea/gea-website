import { NextResponse } from 'next/server';
import { cronAuthorized, runDiscordJobs } from '@/lib/discord/worker';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json(await runDiscordJobs()); }
  catch { return NextResponse.json({ error: 'Discord worker unavailable' }, { status: 503 }); }
}
export const POST = GET;
