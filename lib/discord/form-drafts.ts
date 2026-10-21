import { createAdminClient } from '@/lib/supabase/admin';
import { actorId, type Interaction } from './protocol';

export type DiscordFormValues = Record<string, string>;

/** Preserve original text, including invalid fields, before business validation. */
export async function saveDiscordForm(i: Interaction) {
  if (i.type !== 5 || !i.data?.custom_id) return true;
  const fields = Object.fromEntries((i.data.components || []).flatMap(row => row.components || []).map(field => [field.custom_id, field.value]));
  const { data, error } = await createAdminClient().rpc('save_discord_form', {
    p_discord_id: actorId(i), p_custom_id: i.data.custom_id, p_fields: fields, p_interaction_id: i.id,
  });
  if (error) throw Object.assign(new Error('Could not preserve the submitted form.'), { code: error.code });
  return data === true;
}

/** Reads only; the signed interaction identifies the owner of the private form. */
export async function loadDiscordForm(i: Interaction): Promise<DiscordFormValues> {
  const { data, error } = await createAdminClient().from('discord_form_drafts').select('fields')
    .eq('discord_id', actorId(i)).eq('custom_id', i.data!.custom_id!)
    .abortSignal(AbortSignal.timeout(1200)).maybeSingle();
  if (error) throw Object.assign(new Error('Could not reopen the saved form.'), { code: error.code });
  return data?.fields || {};
}
