import { createAdminClient } from '@/lib/supabase/admin';
import { discordReply, sendDiscordEmbed, type DiscordTopic } from '@/lib/discord';
import { DiscordInputError, handleInteraction } from './service';
import { button, row, type Interaction } from './protocol';
import { discordFailureCode, discordFailureMessage } from './failures';
import { timingSafeEqual } from 'node:crypto';
import { sendTaskNotification } from './task-routing';
import { sendAttendanceNotification } from './attendance-routing';
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
  const started = Date.now();
  let claimed = 0, completed = 0;
  // Drain every ready batch, including notifications created by commands.
  // A full roll call generates two jobs per officer; a fixed batch count
  // silently strands the end of the roster. Keep the time budget instead.
  do {
    const result = await runDiscordBatch();
    claimed += result.claimed; completed += result.completed;
    if (!result.claimed) break;
  } while (Date.now() - started < 30000);
  return { claimed, completed };
}
async function runDiscordBatch() {
  const db = createAdminClient();
  const { data: jobs, error } = await db.rpc('claim_discord_jobs');
  if (error) throw new Error('Could not claim Discord jobs.');
  let completed = 0;
  // Bounded concurrency; claims use SKIP LOCKED and expiring leases.
  await Promise.all((jobs || []).map(async (job: any) => {
    let terminal = false;
    try {
      if (job.kind === 'notification') {
        if (job.payload.topic === 'tasks') await sendTaskNotification(job.payload);
        else if (job.payload.topic === 'attendance_receipt') {
          // Retire older private-DM jobs; new receipts target position channels.
          if (job.payload.officer_position) await sendAttendanceNotification(job.payload);
        }
        else if (job.payload.topic === 'attendance') {
          if (process.env.DISCORD_ATTENDANCE_OVERVIEW === 'true') await sendDiscordEmbed('attendance', { title: job.payload.title, description: job.payload.description });
        }
        else await sendDiscordEmbed(job.payload.topic as DiscordTopic, { title: job.payload.title, description: job.payload.description || 'Open GEA One for the full record.' });
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
      const failureCode = discordFailureCode(error);
      console.error('[Discord] Job failed', { jobId: job.id, kind: job.kind, code: failureCode });
      terminal = error instanceof DiscordInputError || job.attempts >= 5;
      if (job.kind === 'interaction') {
        const component = job.payload.data?.custom_id || '';
        const submissionId = /^(?:submit|resume):([0-9a-f-]{36})$/i.exec(component)?.[1];
        const edit = job.payload.type === 5 && /^(submit|clarify|reviewanswers|assign|absence|manual|revision|reject):/.test(component);
        const controls = [
          ...(submissionId && !(error instanceof DiscordInputError) ? [button('Resume submission', `resume:${submissionId}`)] : []),
          ...(edit ? [button('Edit submitted form', component, 2)] : []),
        ];
        try { await discordReply(job.payload.token, {
          content: error instanceof DiscordInputError ? error.message : `${discordFailureMessage(failureCode)} No score was automatically approved.`,
          components: controls.length ? [row(...controls)] : [],
        }); } catch { /* Token or delivery unavailable; retain queue state. */ }
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
