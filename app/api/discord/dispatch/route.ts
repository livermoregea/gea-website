import { after, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runDiscordJobs } from '@/lib/discord/worker';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Session-authorized website save signal; no payload or destination accepted. */
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Use GEA One to dispatch notifications.' }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const checks = await Promise.all([supabase.rpc('has_officer_access'), supabase.rpc('is_peet_admin')]);
  if (!checks.some(check => check.data === true && !check.error)) {
    const status = checks.some(check => check.error) ? 503 : 403;
    return NextResponse.json({ error: 'Officer workspace access required.' }, { status });
  }
  after(async () => {
    try { await runDiscordJobs(); }
    catch { console.error('[Discord] Website notification dispatch failed; queued jobs are retained.'); }
  });
  return NextResponse.json({ queued: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
