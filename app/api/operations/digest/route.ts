import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
    const secret = process.env.GEA_DIGEST_CRON_SECRET;
    const token = request.headers.get('authorization') ?? '';
    const expected = secret ? `Bearer ${secret}` : '';
    const provided = Buffer.from(token), wanted = Buffer.from(expected);
    if (!secret || provided.length !== wanted.length || !timingSafeEqual(provided, wanted))
        return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
        return NextResponse.json({ error: 'Digest scheduler is not configured.' }, { status: 503 });
    const { data, error } = await createAdminClient().rpc('refresh_gea_weekly_digests');
    if (error)
        return NextResponse.json({ error: 'Could not generate weekly digests.' }, { status: 503 });
    return NextResponse.json({ created: data }, { headers: { 'Cache-Control': 'no-store' } });
}
