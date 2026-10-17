import type { SupabaseClient } from '@supabase/supabase-js';

/** Server-only: reserve the same identity for the roster and the future login. */
export async function reservedOfficerId(admin: SupabaseClient, email: string) {
  const { data, error } = await admin.from('officer_profiles').select('id')
    .eq('pending_email', email.trim().toLowerCase()).is('auth_user_id', null).maybeSingle();
  // Allow deployments to roll out the migration after the signup code.
  if (error && !['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error.code)) throw new Error('Could not check officer signup access.');
  return data?.id as string | undefined;
}
