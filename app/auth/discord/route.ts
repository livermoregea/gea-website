import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/discord/protocol';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { existingDiscordDestination, hasDiscordIdentity } from '@/lib/discord/account-link';
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!hasSupabaseConfig()) return NextResponse.redirect(new URL('/login?discord=unavailable', url.origin));
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (hasDiscordIdentity(user)) return NextResponse.redirect(new URL(await existingDiscordDestination(db, user), url.origin));
  const callback = new URL('/auth/callback', url.origin);
  callback.searchParams.set('next', safeNext(url.searchParams.get('next')));
  const options = { redirectTo: callback.toString(), scopes: 'identify email' };
  const result = user
    ? await db.auth.linkIdentity({ provider: 'discord', options })
    : await db.auth.signInWithOAuth({ provider: 'discord', options });
  if (result.error?.code === 'identity_already_exists') return NextResponse.redirect(new URL(await existingDiscordDestination(db, user), url.origin));
  if (result.error || !result.data.url) return NextResponse.redirect(new URL('/login?discord=unavailable', url.origin));
  return NextResponse.redirect(result.data.url);
}
