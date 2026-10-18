import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { accountMemberships } from '@/lib/account-landing';
import { loadOperations } from '@/lib/gea-operations-data';
import { schoolToday } from '@/lib/officer-tracking';
import { geaiSources, geaiSnapshot, type GeaiBrief } from '@/lib/geai';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

// Page loads only read the cache and enqueue fresh, permission-filtered facts.
// There is deliberately no model/provider import or call in this route.
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers });
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401, headers });
    const membership = await accountMemberships(supabase, user.id);
    if (!membership.hasWorkspace) return NextResponse.json({ error: 'Workspace access required.' }, { status: 403, headers });
    const data = await loadOperations(supabase, user.id);
    const today = schoolToday(), sources = geaiSources(data, today);
    const fallback = geaiSnapshot(sources, data.workspaceHref);
    fallback.aiStatus = process.env.GROQ_API_KEY && process.env.CRON_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'pending' : 'not_configured';
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return NextResponse.json(fallback, { headers });
    // Only the three visible, rule-selected items need generated descriptions.
    // Versioning invalidates old caches that let AI choose the item list.
    const snapshot = { version: 2, today, reviewer: data.reviewer, sources: sources.slice(0, 3), workspaceHref: data.workspaceHref };
    const fingerprint = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    const { data: cached, error } = await createAdminClient().rpc('queue_gea_geai_brief', {
      p_user_id: user.id, p_fingerprint: fingerprint, p_snapshot: snapshot,
    });
    if (error) {
      fallback.aiStatus = ['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code || '') ? 'setup_required' : 'unavailable';
      return NextResponse.json(fallback, { headers });
    }
    if (!cached) return NextResponse.json(fallback, { headers });
    // The RPC returns only a matching cached summary. Never show an AI summary
    // generated for older facts or a different permission scope.
    return NextResponse.json(cached as GeaiBrief, { headers });
  } catch {
    return NextResponse.json({ error: 'Could not load your workspace briefing.' }, { status: 503, headers });
  }
}
