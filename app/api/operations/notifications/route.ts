import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { accountMemberships } from '@/lib/account-landing';
import { allRows } from '@/lib/gea-operations-data';
export const dynamic = 'force-dynamic';
async function session() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user)
    return null; const m = await accountMemberships(supabase, user.id); return m.isAdmin || m.isTeacher ? supabase : null; }
export async function GET() { const supabase = await session(); if (!supabase)
    return NextResponse.json({ error: 'Staff access required.' }, { status: 403 }); try {
    const rows = await allRows<{
        notification_key: string;
    }>((f, t) => supabase.from('gea_notification_reads').select('notification_key').like('notification_key', 'admin:%').order('notification_key').range(f, t));
    return NextResponse.json({ keys: rows.map(r => r.notification_key) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
catch {
    return NextResponse.json({ error: 'Could not load saved notifications.' }, { status: 503 });
} }
export async function POST(request: Request) { if (request.headers.get('origin') !== new URL(request.url).origin)
    return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403 }); const supabase = await session(); if (!supabase)
    return NextResponse.json({ error: 'Staff access required.' }, { status: 403 }); try {
    const body = await request.json();
    if (!Array.isArray(body.keys) || body.keys.length > 10000 || body.keys.some((k: unknown) => typeof k !== 'string' || !/^admin:[a-z-]+:[a-f0-9-]{36}$/.test(k)))
        return NextResponse.json({ error: 'Invalid notification keys.' }, { status: 400 });
    const { error } = await supabase.rpc('mark_gea_notifications', { p_keys: body.keys });
    if (error)
        throw error;
    return NextResponse.json({ ok: true });
}
catch {
    return NextResponse.json({ error: 'Could not save read status.' }, { status: 503 });
} }
