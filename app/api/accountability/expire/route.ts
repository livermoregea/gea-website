import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cronAuthorized } from '@/lib/discord/worker';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await createAdminClient().rpc('expire_officer_strike_responses');
  if (error) return NextResponse.json({ error: 'Could not process response deadlines' }, { status: 503 });
  return NextResponse.json({ confirmed: data });
}
