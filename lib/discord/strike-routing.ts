import { createAdminClient } from '@/lib/supabase/admin';
import { discordDM, discordFetch } from '@/lib/discord';
import { button, row } from './protocol';

export async function sendStrikeResponseRequest(payload: { strike_id: string; officer_id: string; reissued?: boolean }) {
  const db = createAdminClient();
  // Read current ownership and state so queued requests respect corrections,
  // completed responses, disabled accounts, and changes to Discord links.
  const { data: strike, error } = await db.from('officer_strikes')
    .select('id,officer_id,category,incident_date,status,responded_at,response_due_at,notified_at').eq('id', payload.strike_id).eq('officer_id', payload.officer_id).maybeSingle();
  if (error) throw new Error('Could not load response request.');
  if (!strike || strike.status !== 'notified' || strike.responded_at || new Date(strike.response_due_at).getTime() <= Date.now()) return;
  const { data: officer, error: profileError } = await db.from('officer_profiles')
    .select('discord_id,access_enabled').eq('id', strike.officer_id).maybeSingle();
  if (profileError) throw new Error('Could not load response recipient.');
  if (!officer?.access_enabled || !officer.discord_id) return;
  if (!/^\d{17,20}$/.test(officer.discord_id)) throw new Error('Invalid response recipient.');
  const recordDelivery = async (status: 'dm_sent' | 'notices_sent' | 'delivery_failed') => {
    const { error: receiptError } = await db.rpc('record_discord_notice_delivery', {
      p_strike_id: strike.id, p_notice_at: strike.notified_at, p_status: status,
    });
    if (receiptError) throw new Error('Could not queue president notice update.');
  };
  let dmFailed = false;
  try {
    await discordDM(officer.discord_id, {
      content: `${payload.reissued ? 'This existing incident has been reopened under the new notice system. Please submit or confirm your explanation again. ' : ''}An ${strike.category === 'attendance' ? 'unexcused absence' : 'incident involving conduct'} was recorded for ${strike.incident_date}. Respond by <t:${Math.floor(new Date(strike.response_due_at).getTime() / 1000)}:F> (<t:${Math.floor(new Date(strike.response_due_at).getTime() / 1000)}:R>). No response within 24 hours means an automatic strike. A timely explanation waits for reviewer judgment. Please share your side of the story and any circumstances reviewers should consider. Your explanation is shared with authorized reviewers. You can read the full record and respond in GEA One → Concerns & notes, or use the form below.`,
      components: [row(button('Explain your circumstances', `officer:form:strike:${strike.id}`), button('Read incident details', `officer:record:conduct:${strike.id}:0`, 2))],
    });
  } catch { dmFailed = true; }
  if (!dmFailed) { await recordDelivery('dm_sent'); return; }
  try {
    // A blocked DM must still reach the member without publishing the incident.
    // Throw on fallback failure so the durable outbox retries delivery.
    const channel = process.env.DISCORD_NOTICES_CHANNEL_ID;
    if (!channel || !/^\d{17,20}$/.test(channel)) throw new Error('Configure DISCORD_NOTICES_CHANNEL_ID for notice delivery when DMs fail.');
    const components: unknown[] = [];
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      const website = new URL('/officerboard?topic=accountability', process.env.NEXT_PUBLIC_SITE_URL);
      if (!['https:', 'http:'].includes(website.protocol)) throw new Error('Invalid GEA website URL.');
      components.push(row({ type: 2, style: 5, label: 'Open GEA website', url: website.href }));
    }
    await discordFetch(`channels/${channel}/messages`, {
      content: `<@${officer.discord_id}>, please check the GEA website for a notice.`,
      components,
      allowed_mentions: { parse: [], users: [officer.discord_id], roles: [] },
    });
  } catch (error) {
    await recordDelivery('delivery_failed');
    throw error;
  }
  await recordDelivery('notices_sent');
}
