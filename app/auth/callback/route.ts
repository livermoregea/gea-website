import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/discord/protocol';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const db = await createClient();
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/login?discord=failed', url.origin));
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/login?discord=failed', url.origin));
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login?discord=failed', url.origin));
  if (user.identities?.some((identity: { provider: string }) => identity.provider === 'discord')) {
    const { data: linked, error: bindingError } = await db.rpc('bind_officer_discord');
    if (bindingError || !linked) return NextResponse.redirect(new URL('/account?discord=link-required', url.origin));
  }
  return NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')), url.origin));
}
