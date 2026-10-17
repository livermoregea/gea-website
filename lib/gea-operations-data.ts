import { createClient } from './supabase/server';
import { accountMemberships } from './account-landing';
import { legacyPlanningHref, officerWorkspaceHref } from './officer-workspace-navigation';
import { BUILDERS_ENABLED } from './site-features';
import { taskAttention, type AttentionItem, type CalendarItem, type MeetingNotes, type AgendaItem, type EventPlan, type Blocker, type Digest } from './gea-operations';
import type { OfficerTask, TaskTeammate } from './peet';
import { schoolToday, type OfficerEvent, type OfficerAttendance, type VolunteerLog, type EventSignup } from './officer-tracking';
export async function allRows<T>(query: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: {
        message: string;
        code?: string;
    } | null;
}>) {
    const rows: T[] = [];
    for (let from = 0;; from += 100) {
        const result = await query(from, from + 99);
        if (result.error)
            throw Object.assign(new Error(result.error.message), { code: result.error.code });
        rows.push(...result.data ?? []);
        if ((result.data?.length ?? 0) < 100)
            return rows;
    }
}
export type OfficerOperationsSeed = {
    tasks: OfficerTask[]; events: OfficerEvent[]; attendance: OfficerAttendance[];
    logs: VolunteerLog[]; signups?: EventSignup[]; people: TaskTeammate[];
};
// The unified workspace has already read these permission-filtered officer records.
export async function loadOperations(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, seed?: OfficerOperationsSeed) {
    const membership = await accountMemberships(supabase, userId);
    const staff = membership.isAdmin || membership.isTeacher;
    const taskHref = staff ? '/admin-portal-x7k9/officers' : '/officerboard';
    const [reviewerResult, secretaryResult] = membership.isOfficer ? await Promise.all([supabase.rpc('is_peet_admin'), supabase.rpc('can_manage_meetings')]) : [{ data: false, error: null }, { data: false, error: null }];
    if (reviewerResult.error || secretaryResult.error)
        throw new Error('The operations database update is required.');
    const reviewer = Boolean(reviewerResult.data), canMeetings = Boolean(secretaryResult.data);
    const [tasks, events, attendance, logs, signups, people, notes, agenda, plans, blockers, reads, prefs, digests, cancellations, concerns] = await Promise.all([
        seed ? Promise.resolve(seed.tasks) : allRows<OfficerTask>((f, t) => supabase.from('tasks').select('id,title,description,assigned_to,created_by,due_date,status,cancelled_at,submitted_at,completed_at,created_at,officer_task_members(officer_id)').order('id').range(f, t)),
        seed ? Promise.resolve(seed.events) : allRows<OfficerEvent>((f, t) => supabase.from('officer_events').select('*').order('starts_at').order('id').range(f, t)),
        seed ? Promise.resolve(seed.attendance) : allRows<OfficerAttendance>((f, t) => supabase.from('officer_attendance').select('id,event_id,officer_id,status').order('id').range(f, t)),
        seed ? Promise.resolve(seed.logs) : allRows<VolunteerLog>((f, t) => supabase.from('officer_volunteer_logs').select('id,event_id,officer_id,status,minutes,check_in').order('id').range(f, t)),
        seed?.signups ? Promise.resolve(seed.signups) : membership.isOfficer ? allRows<EventSignup>((f, t) => supabase.from('officer_event_signups').select('id,event_id,officer_id,committed,assigned,participation_role,participation_notes,version').order('id').range(f, t)) : Promise.resolve([]),
        seed ? Promise.resolve(seed.people) : membership.isOfficer ? allRows<TaskTeammate>((f, t) => supabase.rpc('officer_task_teammates').order('id').range(f, t)) : Promise.resolve([]),
        allRows<MeetingNotes>((f, t) => supabase.from('gea_meeting_notes').select('*').order('id').range(f, t)),
        allRows<AgendaItem>((f, t) => supabase.from('gea_agenda_items').select('*').order('created_at').order('id').range(f, t)),
        allRows<EventPlan>((f, t) => supabase.from('gea_event_plans').select('id,event_id,organizer_id,planning_doc_url,version').order('id').range(f, t)),
        allRows<Blocker>((f, t) => supabase.from('gea_task_blockers').select('*').order('id').range(f, t)),
        allRows<{
            notification_key: string;
        }>((f, t) => supabase.from('gea_notification_reads').select('notification_key').order('notification_key').range(f, t)),
        supabase.from('gea_digest_preferences').select('enabled').eq('user_id', userId).maybeSingle(),
        allRows<Digest>((f, t) => supabase.from('gea_weekly_digests').select('id,week_of,items').order('week_of', { ascending: false }).order('id').range(f, t)),
        allRows<{
            id: string;
            task_id: string;
            status: string;
        }>((f, t) => supabase.from('officer_task_cancellation_requests').select('id,task_id,status').eq('status', 'pending').order('id').range(f, t)),
        allRows<{
            id: string;
            officer_id: string;
            response_due_at: string;
        }>((f, t) => supabase.from('officer_strikes').select('id,officer_id,response_due_at').eq('status', 'notified').eq('officer_id', userId).order('id').range(f, t)),
    ]);
    if (prefs.error)
        throw new Error(prefs.error.message);
    const attention: AttentionItem[] = taskAttention(tasks, reviewer, taskHref);
    const ownSubmitted = tasks.filter(t => !t.cancelled_at && t.status === 'submitted' && !reviewer);
    for (const t of ownSubmitted)
        attention.push({ key: `submitted:${t.id}:${t.submitted_at}`, title: t.title, detail: 'Your work is awaiting review', href: `${taskHref}?task=${t.id}`, category: 'Tasks' });
    for (const c of cancellations)
        if (reviewer)
            attention.push({ key: `cancellation:${c.id}`, title: tasks.find(t => t.id === c.task_id)?.title || 'Task cancellation', detail: 'Cancellation request awaiting review', href: `${taskHref}?task=${c.task_id}`, category: 'Review' });
    for (const c of concerns)
        attention.push({ key: `concern:${c.id}`, title: 'Accountability notice', detail: 'Review the notice and explain your circumstances', date: c.response_due_at, href: `${taskHref}?topic=accountability`, category: 'Response' });
    const calendar: CalendarItem[] = events.filter(e => !e.cancelled).map(e => ({ id: e.id, title: e.title, start: e.starts_at, end: e.ends_at, kind: e.kind, location: e.location, href: `/operations?view=${e.kind === 'meeting' ? 'meetings' : 'events'}&event=${e.id}` }));
    for (const t of tasks)
        if (t.due_date && !t.cancelled_at && t.status !== 'completed')
            calendar.push({ id: `task-${t.id}`, title: t.title, start: t.due_date, allDay: true, kind: 'task', href: `${taskHref}?task=${encodeURIComponent(t.id)}` });
    const today = schoolToday();
    const soon = new Date(`${today}T12:00:00Z`);
    soon.setUTCDate(soon.getUTCDate() + 7);
    const last = soon.toISOString().slice(0, 10);
    for (const e of events.filter(e => !e.cancelled && e.ends_at >= new Date().toISOString() && schoolToday(new Date(e.starts_at)) <= last))
        attention.push({ key: `event:${e.id}:${e.starts_at}`, title: e.title, detail: e.location || 'Upcoming event', date: e.starts_at, href: `/operations?view=${e.kind === 'meeting' ? 'meetings' : 'events'}&event=${e.id}`, category: 'Calendar' });
    for (const log of logs.filter(l => l.status === 'pending' && reviewer))
        attention.push({ key: `service:${log.id}`, title: events.find(e => e.id === log.event_id)?.title || 'Volunteer log', detail: 'Service hours awaiting verification', href: taskHref, category: 'Review' });
    for (const b of blockers.filter(b => !b.resolved_at)) {
        const t = tasks.find(t => t.id === b.task_id);
        if (t && (t.cancelled_at || t.status !== 'in_progress'))
            continue;
        attention.push({ key: `blocker:${b.task_id}:${b.updated_at}`, title: t?.title || 'Help requested on a task', detail: b.reason, href: '/operations?view=blockers', category: 'Help' });
    }
    const adminKinds = [
        ['applications', 'applications', 'Leadership application', 'name', '/admin-portal-x7k9/applications', true],
        ['profile_change_requests', 'profile-changes', 'Profile change', 'requested_by_name', '/admin-portal-x7k9/profile-changes', true],
        ['builder_submissions', 'builders', 'Builder submission', 'title', '/admin-portal-x7k9/builders', true],
        ['qa_questions', 'forum-questions', 'Forum question', 'asked_by_name', '/admin-portal-x7k9/forum', true],
        ['qa_answers', 'forum-answers', 'Forum answer', 'answered_by_name', '/admin-portal-x7k9/forum', true],
        ['student_profiles', 'students', 'New student', 'full_name', '/admin-portal-x7k9/students', false],
    ] as const;
    if (staff) {
        const queues = await Promise.all(adminKinds.filter(([table]) => table !== 'builder_submissions' || BUILDERS_ENABLED).map(async ([table, kind, title, label, href, pending]) => ({ kind, title, href, pending, rows: await allRows<{
                id: string;
                label: string;
            }>((f, t) => {
                let query = supabase.from(table).select(`id,label:${label}`).order('id').range(f, t);
                if (pending)
                    query = query.eq('status', 'pending');
                return query;
            }) })));
        for (const q of queues)
            for (const row of q.rows) {
                const key = `admin:${q.kind}:${row.id}`;
                if (!q.pending && reads.some(r => r.notification_key === key))
                    continue;
                attention.push({ key, title: `${q.title} · ${row.label || 'Unnamed'}`, detail: q.pending ? 'Awaiting review' : 'New student profile', href: q.kind === 'applications' ? `${q.href}/${row.id}` : q.href, category: 'Administration' });
            }
        const slots = await allRows<{
            id: string;
            label: string;
            slot_time: string;
            is_booked: boolean;
        }>((f, t) => supabase.from('interview_slots').select('id,label,slot_time,is_booked').order('id').range(f, t));
        for (const s of slots)
            calendar.push({ id: s.id, title: `${s.is_booked ? 'Booked interview' : 'Interview availability'} · ${s.label}`, start: s.slot_time, kind: 'interview', href: '/admin-portal-x7k9/slots' });
    }
    const workspaceHref = membership.isOfficer ? officerWorkspaceHref(staff) : '/operations';
    if (membership.isOfficer) {
        for (const item of [...attention, ...calendar]) {
            if (item.href.startsWith('/operations?')) {
                const params = Object.fromEntries(new URLSearchParams(item.href.split('?')[1]));
                item.href = legacyPlanningHref(staff, params);
            }
        }
    }
    return { workspaceHref, userId, membership, reviewer, canMeetings, taskHref, tasks, events, attendance, logs, signups, people, notes, agenda, plans, blockers, readKeys: reads.map(r => r.notification_key), digestEnabled: Boolean(prefs.data?.enabled), digests, attention, calendar: calendar.sort((a, b) => a.start.localeCompare(b.start)) };
}
export type OperationsData = Awaited<ReturnType<typeof loadOperations>>;
