import { createAdminClient } from '@/lib/supabase/admin';
import { discordFetch, safeMessage } from '@/lib/discord';
import { row } from './protocol';

const updates = {
  dm_sent: 'Notice delivered by DM.',
  not_linked: 'DM unavailable: this officer has not linked Discord. A channel alert will be attempted. They must finish GEA One signup, then connect Discord from Account Home. The notice remains on the website.',
  notices_sent: 'DM blocked or unavailable (including unlinked accounts). A fallback alert was posted in notices or the officer position channel.',
  delivery_failed: 'Notice delivery failed: the DM was unavailable and the notices-channel fallback failed. Check the delivery queue; the website notice remains available.',
  responded: 'The officer submitted an explanation. It is ready for review on the GEA website.',
} as const;
export async function sendPresidentNoticeUpdate(payload: {
  officer_id: string; strike_id: string; status: keyof typeof updates; occurred_at: string; response_due_at: string;
}) {
  const channel = process.env.DISCORD_CHANNEL_PRESIDENT;
  if (!channel || !/^\d{17,20}$/.test(channel)) throw new Error('Configure DISCORD_CHANNEL_PRESIDENT for notice updates.');
  if (!Object.hasOwn(updates, payload.status)) throw new Error('Invalid president notice update.');
  const { data: officer, error } = await createAdminClient().from('officer_profiles')
    .select('name,position').eq('id', payload.officer_id).maybeSingle();
  if (error || !officer) throw new Error('Could not load the notice officer.');
  const components: unknown[] = [];
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    const website = new URL('/admin-portal-x7k9/officers', process.env.NEXT_PUBLIC_SITE_URL);
    if (!['https:', 'http:'].includes(website.protocol)) throw new Error('Invalid GEA website URL.');
    website.searchParams.set('topic', 'accountability');
    website.searchParams.set('officer', payload.officer_id);
    components.push(row({ type: 2, style: 5, label: 'Review on GEA website', url: website.href }));
  }
  await discordFetch(`channels/${channel}/messages`, safeMessage({
    embeds: [{ title: 'Officer notice update', description: updates[payload.status], fields: [
      { name: 'Officer', value: `${officer.name}${officer.position ? ` · ${officer.position}` : ''}` },
      { name: 'Update time', value: payload.occurred_at },
      { name: 'Response deadline', value: payload.response_due_at },
    ] }], components,
  }));
}
