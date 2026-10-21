import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
// Retire old clients without queuing work or contacting an AI provider.
export async function POST() {
  return NextResponse.json({ disabled: true, error: 'AI workspace summaries have been removed.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
