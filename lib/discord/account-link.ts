import type { SupabaseClient, User } from '@supabase/supabase-js';

type IdentityUser = Pick<User, 'identities'> | null;
export function hasDiscordIdentity(user: IdentityUser) {
  return !!user?.identities?.some(identity => identity.provider === 'discord');
}

/** An OAuth error alone never proves this session owns the Discord identity. */
export async function existingDiscordDestination(db: Pick<SupabaseClient, 'rpc'>, user: IdentityUser) {
  if (!user) return '/login?discord=identity-already-linked';
  if (!hasDiscordIdentity(user)) return '/account?discord=linked-elsewhere';
  const { data: linked, error } = await db.rpc('bind_officer_discord');
  if (error) return '/account?discord=sync-failed';
  return linked ? '/account?discord=already-linked' : '/account?discord=link-required';
}
