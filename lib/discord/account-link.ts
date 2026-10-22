import type { SupabaseClient, User } from '@supabase/supabase-js';

type IdentityUser = Pick<User, 'identities'> | null;
export function hasDiscordIdentity(user: IdentityUser) {
  return !!user?.identities?.some(identity => identity.provider === 'discord');
}

/** Use current server membership; staff/student access alone does not qualify. */
export async function hasDiscordOfficerAccess(db: Pick<SupabaseClient, 'rpc'>) {
  const { data, error } = await db.rpc('has_officer_access');
  return !error && data === true;
}

/** An OAuth error alone never proves this session owns the Discord identity. */
export async function existingDiscordDestination(db: Pick<SupabaseClient, 'rpc'>, user: IdentityUser) {
  if (!user) return '/login?discord=officer-sign-in';
  if (!await hasDiscordOfficerAccess(db)) return '/account?discord=officer-only';
  if (!hasDiscordIdentity(user)) return '/account?discord=linked-elsewhere';
  const { data: linked, error } = await db.rpc('bind_officer_discord');
  if (error) return '/account?discord=sync-failed';
  return linked ? '/account?discord=already-linked' : '/account?discord=link-required';
}
