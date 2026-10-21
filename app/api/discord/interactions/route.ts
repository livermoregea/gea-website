import { after, NextResponse } from 'next/server';
import { verifyKey } from 'discord-interactions';
import { actorId, modalResponse, type Interaction } from '@/lib/discord/protocol';
import { enqueueInteraction, runDiscordJobs } from '@/lib/discord/worker';
import { loadDiscordForm } from '@/lib/discord/form-drafts';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const key = process.env.DISCORD_PUBLIC_KEY;
  if (!key) return new Response('Discord is not configured', { status: 503 });
  const timestamp = request.headers.get('x-signature-timestamp') || '';
  const signature = request.headers.get('x-signature-ed25519') || '';
  if (Number(request.headers.get('content-length') || 0) > 64000) return new Response('Too large', { status: 413 });
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let raw = '', bytes = 0;
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 64000) {
          void reader.cancel().catch(() => {});
          return new Response('Too large', { status: 413 });
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
  }
  try {
    if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !await verifyKey(raw, signature, timestamp, key)) return new Response('Invalid signature', { status: 401 });
  } catch { return new Response('Invalid signature', { status: 401 }); }
  let i: Interaction;
  try { i = JSON.parse(raw); } catch { return new Response('Invalid JSON', { status: 400 }); }
  if (i.type === 1) return NextResponse.json({ type: 1 });
  if (i.application_id !== process.env.DISCORD_APPLICATION_ID || (i.guild_id && i.guild_id !== process.env.DISCORD_GUILD_ID) || !actorId(i)) return NextResponse.json({ type: 4, data: { content: 'This GEA One server is not authorized.', flags: 64 } });
  if (![2, 3, 5].includes(i.type)) return NextResponse.json({ type: 4, data: { content: 'Unsupported interaction.', flags: 64 } });
  const modal = modalResponse(i);
  if (modal) {
    try { return NextResponse.json(modalResponse(i, await loadDiscordForm(i))); }
    catch { return NextResponse.json({ type: 4, data: { content: 'Could not load your saved form. Please click the button again to retry.', flags: 64 } }); }
  }
  // No AI, Discord network calls, or database mutations on the ACK path.
  after(async () => {
    try { await enqueueInteraction(i); await runDiscordJobs(); }
    catch { console.error('Discord background processing failed; inspect discord_jobs.'); }
  });
  if (i.type === 3 && i.data?.custom_id?.startsWith('roll:')) return NextResponse.json({ type: 6 });
  return NextResponse.json({ type: 5, data: { flags: 64 } });
}
