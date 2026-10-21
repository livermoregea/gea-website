import { createAdminClient } from '@/lib/supabase/admin';
import { discordReply, sendDiscordEmbed, type DiscordTopic } from '@/lib/discord';
import { DiscordInputError, handleInteraction } from './service';
import type { Interaction } from './protocol';
import { timingSafeEqual } from 'node:crypto';
export function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const actualBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return !!secret && actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
export async function enqueueInteraction(i: Interaction) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Discord database is not configured.');
  const { error } = await createAdminClient().from('discord_jobs').upsert({ id: i.id, kind: 'interaction', payload: i }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error('Could not queue Discord interaction.');
}
export async function runDiscordJobs() {
  const db = createAdminClient();
  const { data: jobs, error } = await db.rpc('claim_discord_jobs');
  if (error) throw new Error('Could not claim Discord jobs.');
  let completed = 0;
  // Bounded concurrency; claims use SKIP LOCKED and expiring leases.
  await Promise.all((jobs || []).map(async (job: any) => {
    let terminal = false;
    try {
      if (job.kind === 'notification') {
        await sendDiscordEmbed(job.payload.topic as DiscordTopic, { title: job.payload.title, description: job.payload.description || 'Open GEA One for the full record.' });
      } else {
        // Discord tokens expire in 15 minutes. Discard expired tokens, retain
        // durable drafts/actions; officers can safely start a fresh command.
        const issuedAt = Number((BigInt(job.id) >> BigInt(22)) + BigInt(1420070400000));
        if (Date.now() - issuedAt > 14 * 60000) terminal = true;
        else await handleInteraction(job.payload);
      }
      const { error: finishError } = await db.from('discord_jobs').update({ finished_at: new Date().toISOString(), failed: terminal, payload: {} }).eq('id', job.id);
      if (finishError) throw new Error('Could not finish job.');
      completed++;
    } catch (error) {
      terminal = error instanceof DiscordInputError || job.attempts >= 5;
      if (job.kind === 'interaction') {
        try { await discordReply(job.payload.token, { content: error instanceof DiscordInputError ? error.message : 'Processing could not finish. Saved work is retained. Please retry the command; no score was automatically approved.', components: [] }); } catch { /* Token or delivery unavailable; retain queue state. */ }
      }
      const { error: retryError } = await db.from('discord_jobs').update({ leased_until: null, failed: terminal,
        available_at: new Date(Date.now() + Math.min(600, 15 * 2 ** job.attempts) * 1000).toISOString(),
        ...(terminal ? { payload: {} } : {}),
      }).eq('id', job.id);
      if (retryError) console.error('Discord queue state update failed.');
    }
  }));
  return { claimed: jobs?.length || 0, completed };
}
