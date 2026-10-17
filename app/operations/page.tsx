import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { accountMemberships } from '@/lib/account-landing';
import { loadOperations } from '@/lib/gea-operations-data';
import { legacyPlanningHref } from '@/lib/officer-workspace-navigation';
import OperationsHub from '@/components/operations/OperationsHub';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Workspace updates · GEA One', robots: { index: false, follow: false } };
export default async function OperationsPage({ searchParams }: {
    searchParams: Promise<{
        view?: string;
        event?: string;
        task?: string;
        topic?: string;
    }>;
}) {
    if (!hasSupabaseConfig())
        return <p className="mx-auto max-w-3xl p-8">GEA One is awaiting account setup.</p>;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user)
        redirect('/login');
    const membership = await accountMemberships(supabase, user.id);
    if (!membership.hasWorkspace)
        redirect('/account');
    const params = await searchParams;
    if (membership.isOfficer) redirect(legacyPlanningHref(membership.isAdmin || membership.isTeacher, params));
    try {
        let data = await loadOperations(supabase, user.id);
        if (data.digestEnabled) {
            const { error } = await supabase.rpc('save_gea_digest', { p_items: data.attention });
            if (error)
                throw new Error(error.message);
            data = await loadOperations(supabase, user.id);
        }
        const allowed = membership.isOfficer ? ['today', 'calendar', 'meetings', 'events', 'blockers', 'inbox', 'reports'] : ['today', 'calendar', 'inbox'];
        return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8"><OperationsHub data={data} initialView={allowed.includes(params.view ?? '') ? params.view : 'today'} initialEvent={params.event}/></div>;
    }
    catch (error) {
        const failure = error as { code?: string; message?: string };
        console.error('[GEA operations] Planning load failed', { code: failure.code, message: failure.message });
        const missingSetup = ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(failure.code ?? '');
        return <div className="mx-auto max-w-2xl p-8"><h1 className="text-2xl font-semibold text-forest">Workspace updates unavailable</h1><p className="my-4">{missingSetup ? 'A required workspace table or function is unavailable. Ask an advisor to check the database update.' : 'Workspace updates could not load. Try again; if the problem continues, ask an advisor to check the server error log.'}</p><Link className="underline" href="/account">Back to GEA One</Link></div>;
    }
}
