import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { accountMemberships } from '@/lib/account-landing';
import { loadOperations } from '@/lib/gea-operations-data';
export const dynamic = 'force-dynamic';
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user)
        return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    const membership = await accountMemberships(supabase, user.id);
    if (!membership.hasWorkspace)
        return NextResponse.json({ error: 'Workspace access required.' }, { status: 403 });
    try {
        const data = await loadOperations(supabase, user.id);
        return NextResponse.json({ items: data.attention, workspaceHref: data.workspaceHref }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch {
        return NextResponse.json({ error: 'Could not load next actions.' }, { status: 503 });
    }
}
