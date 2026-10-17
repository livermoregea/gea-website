'use client';
import { useEffect, useState, useTransition, type ReactNode, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';
import { createClient } from '@/lib/supabase/client';
import { calendarIcs, downloadFile } from '@/lib/gea-operations';
import type { OperationsData } from '@/lib/gea-operations-data';
import { schoolDate, schoolToday } from '@/lib/officer-tracking';
import { isOfficerTaskParticipant } from '@/lib/peet';
import MeetingSchedule from './MeetingSchedule';
import WorkspaceUpdates from './WorkspaceUpdates';
import { workspaceView } from '@/lib/officer-workspace-navigation';
import MeetingWorkspace from './MeetingWorkspace';
import EventPlanning from './EventPlanning';
import AccomplishmentsReport from './AccomplishmentsReport';
import s from './operations.module.css';
const views = [['overview', 'Overview'], ['tasks', 'My work'], ['calendar', 'Calendar'], ['meetings', 'Meetings'], ['events', 'Events'], ['reports', 'Reports']] as const;
export default function OperationsHub({ data, initialView = 'overview', initialEvent = '', initialTask = '', officerTools, officerOverview, embedded = false }: {
    data: OperationsData;
    initialTask?: string;
    officerTools?: ReactNode;
    officerOverview?: ReactNode;
    embedded?: boolean;
    initialView?: string;
    initialEvent?: string;
}) {
    const router = useRouter();
    const [refreshing, startTransition] = useTransition();
    const [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [dirty, setDirty] = useState(false);
    const [helpTarget, setHelpTarget] = useState(initialTask);
    const [draftEpoch, setDraftEpoch] = useState(0);
    const [dirtyScope, setDirtyScope] = useState<string | null>(null);
    const [view, setView] = useState(workspaceView(initialView, initialTask)), [eventId, setEventId] = useState(initialEvent), [kind, setKind] = useState('all'), [from, setFrom] = useState(schoolToday()), [to, setTo] = useState(''), [toolsVisited, setToolsVisited] = useState(workspaceView(initialView, initialTask) === 'tasks');
    const busy = saving || refreshing, staff = data.membership.isAdmin || data.membership.isTeacher;
    useEffect(() => {
        const next = workspaceView(initialView, initialTask);
        setView(next);
        if (next === 'tasks') setToolsVisited(true);
        setEventId(initialEvent);
        setHelpTarget(initialTask);
    }, [initialView, initialTask, initialEvent]);

    useUnsavedChanges(dirty);
    useEffect(() => { const focus = () => { if (!dirty && !saving)
        startTransition(() => router.refresh()); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [dirty, saving, router]);
    function discard() { return !dirty || window.confirm('Discard unsaved changes?'); }
    function changeView(next: string) { if (!discard())
        return; setDirty(false); setDirtyScope(null); setView(next); if (next === 'tasks') setToolsVisited(true); const url = new URL(window.location.href); url.searchParams.set('view', next); url.searchParams.delete('task'); url.searchParams.delete('topic'); window.history.replaceState(window.history.state, '', url); setMessage(''); setError(''); }
    async function save(rpc: string, args: Record<string, unknown>, success: string) {
        const scope = rpc === 'save_officer_event' ? `schedule-${args.p_event_id ?? 'new'}` : rpc === 'save_meeting_documents' ? 'documents' : rpc === 'save_meeting_notes' ? 'minutes' : rpc === 'add_meeting_agenda' ? 'agenda' : rpc === 'save_meeting_attendance' ? 'attendance' : rpc === 'assign_agenda_action' ? `action-${args.p_agenda_id}` : rpc === 'save_event_planning_document' ? 'plan' : rpc === 'save_event_checklist' ? 'checklist' : rpc === 'save_task_blocker' ? 'help' : null;
        if (dirtyScope && scope !== dirtyScope) {
            setError('Save your current changes or discard them before changing another item.');
            return false;
        }
        setSaving(true);
        setError('');
        setMessage('');
        try {
            const { error } = await createClient().rpc(rpc, args);
            if (error)
                throw error;
            setMessage(success);
            setDirty(false);
            setDirtyScope(null);
            startTransition(() => router.refresh());
            return true;
        }
        catch (e) {
            setError(e instanceof Error ? e.message : (e as {
                message?: string;
            })?.message || 'Could not save. Please try again.');
            return false;
        }
        finally {
            setSaving(false);
        }
    }
    const available = views.filter(([key]) => data.membership.isOfficer ? key !== 'tasks' || Boolean(officerTools) : ['overview', 'calendar'].includes(key));
    const unread = data.attention.filter(i => !data.readKeys.includes(i.key));
    const selectedEvent = data.events.find(e => e.id === eventId);
    const events = data.events.filter(e => view === 'meetings' ? e.kind === 'meeting' : e.kind !== 'meeting');
    const calendar = data.calendar.filter(e => (kind === 'all' || e.kind === kind) && (!from || (e.allDay ? e.start : schoolToday(new Date(e.start))) >= from) && (!to || (e.allDay ? e.start : schoolToday(new Date(e.start))) <= to));
    const liveBlockers = data.blockers.filter(b => !b.resolved_at && !data.tasks.some(t => t.id === b.task_id && (t.cancelled_at || t.status !== 'in_progress')));
    const helpTasks = data.tasks.filter(t => !t.cancelled_at && t.status === 'in_progress' && isOfficerTaskParticipant(t, data.userId));
    function openWorkspaceLink(event: MouseEvent<HTMLDivElement>) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const anchor = (event.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null;
        if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
        const current = new URL(window.location.href), target = new URL(anchor.href, current);
        if (target.origin !== current.origin || ![current.pathname, '/operations', '/officerboard'].includes(target.pathname)) return;
        if (!target.searchParams.has('view') && !target.searchParams.has('task') && !target.searchParams.has('topic')) return;
        event.preventDefault();
        const next = workspaceView(target.searchParams.get('view') ?? undefined, target.searchParams.get('task') ?? undefined, target.searchParams.get('topic') ?? undefined);
        setView(next); if (next === 'tasks') setToolsVisited(true);
        setEventId(target.searchParams.get('event') ?? '');
        setHelpTarget(target.searchParams.get('task') ?? '');
        setDirty(false); setDirtyScope(null); setMessage(''); setError('');
        target.pathname = current.pathname;
        target.searchParams.set('view', next);
        window.history.replaceState(window.history.state, '', target);
        window.dispatchEvent(new Event('gea:workspace-target'));
        startTransition(() => router.refresh());
    }
    return <div className={s.hub} data-workspace-dirty={dirty ? "true" : undefined} onClick={openWorkspaceLink}>
 {!embedded && <header className={`${s.header} ${s.noPrint}`}><div><h1>{data.membership.isOfficer ? 'Officer workspace' : 'Academy updates'}</h1><p className={s.muted}>Assignments, meetings, and everything you need for the week.</p></div><div className={s.actions}><Link className={s.button} href="/account">Home</Link>{staff && <Link className={s.button} href="/admin-portal-x7k9">Academy administration</Link>}</div></header>}
 <nav aria-label="Officer workspace sections" className={`${s.nav} ${s.noPrint}`}>{available.map(([key, label]) => <button key={key} disabled={busy} aria-pressed={view === key} onClick={() => changeView(key)}>{key === 'tasks' ? data.reviewer ? 'Officers' : 'My work' : label}{key === 'overview' && unread.length > 0 && <span className={s.navCount} aria-label={`${unread.length} new updates`}>{unread.length}</span>}</button>)}</nav>
 <div className={s.noPrint}><p role="status" className={s.status}>{busy ? 'Saving or refreshing…' : message}{dirty ? ' · Unsaved changes' : ''}</p>{dirty && <button disabled={busy} onClick={() => { if (discard()) {
        setDirty(false);
        setDirtyScope(null);
        setDraftEpoch(n => n + 1);
        router.refresh();
    } }}>Discard unsaved changes</button>}{error && <p role="alert" className={s.error}>{error}</p>}</div>
 {view === 'overview' && <>{officerOverview}<WorkspaceUpdates data={data} save={save} busy={busy}/></>}
 {officerTools && toolsVisited && <section hidden={view !== 'tasks'} aria-label="Tasks and officer progress" className={s.officerTools}>{officerTools}</section>}
 {view === 'calendar' && <section className={s.panel}><h2>Combined calendar</h2><div className={s.grid}><label>Show<select value={kind} onChange={e => setKind(e.target.value)}>{[['all', 'Everything'], ['meeting', 'Meetings'], ['volunteer', 'Volunteer'], ['outreach', 'Outreach'], ['task', 'Task deadlines'], ...(staff ? [['interview', 'Interviews']] : [])].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>Through<input type="date" min={from} value={to} onChange={e => setTo(e.target.value)}/></label></div><button onClick={() => downloadFile('gea-calendar.ics', calendarIcs(calendar), 'text/calendar;charset=utf-8')} disabled={!calendar.length}>Export filtered calendar (.ics)</button><p className={s.muted}>Import the file into your calendar. Export again after schedule changes.</p>{calendar.map(e => <article className={s.row} key={e.id}><div><span className={s.badge}>{e.kind}</span><h3><a href={e.href}>{e.title}</a></h3><p>{schoolDate(e.start, !e.allDay)}{e.location ? ` · ${e.location}` : ''}</p></div><button onClick={() => downloadFile('gea-event.ics', calendarIcs([e]), 'text/calendar;charset=utf-8')}>Add to calendar<span className="sr-only">: {e.title}</span></button></article>)}{!calendar.length && <p>No events or deadlines match these filters.</p>}</section>}
 {['meetings', 'events'].includes(view) && data.membership.isOfficer && <><section className={`${s.selectorBar} ${s.noPrint}`}><label>{view === 'meetings' ? 'Choose meeting' : 'Choose service event'}<select value={events.some(e => e.id === eventId) ? eventId : ''} disabled={busy} onChange={e => { if (discard()) {
        setDirty(false);
        setDirtyScope(null);
        if (dirty) setDraftEpoch(value => value + 1);
        setEventId(e.target.value);
        const url = new URL(window.location.href);
        if (e.target.value) url.searchParams.set('event', e.target.value); else url.searchParams.delete('event');
        window.history.replaceState(window.history.state, '', url);
        setError('');
    } }}><option value="">Select an event</option>{events.map(e => <option value={e.id} key={e.id}>{schoolDate(e.starts_at)} · {e.title}{e.cancelled ? ' · Cancelled' : ''}</option>)}</select></label>{data.reviewer && <>
      <MeetingSchedule key={`${view}-new-${draftEpoch}`} kind={view === 'meetings' ? 'meeting' : 'volunteer'} save={save} busy={busy} dirtyScope={dirtyScope} markDirty={scope => { setDirty(true); setDirtyScope(scope); }} />
      {selectedEvent && events.some(item => item.id === selectedEvent.id) && <MeetingSchedule key={`${selectedEvent.id}-${draftEpoch}`} event={selectedEvent} kind={view === 'meetings' ? 'meeting' : 'volunteer'} save={save} busy={busy} dirtyScope={dirtyScope} markDirty={scope => { setDirty(true); setDirtyScope(scope); }} />}
    </>}</section>{view === 'meetings' ? <MeetingWorkspace key={`${eventId}-${draftEpoch}`} data={data} eventId={selectedEvent?.kind === 'meeting' ? eventId : ''} save={save} busy={busy} dirtyScope={dirtyScope} markDirty={scope => { setDirty(true); setDirtyScope(scope); }}/> : <EventPlanning key={`${eventId}-${draftEpoch}`} data={data} eventId={selectedEvent?.kind !== 'meeting' ? eventId : ''} save={save} busy={busy} dirtyScope={dirtyScope} markDirty={scope => { setDirty(true); setDirtyScope(scope); }}/>}</>}
 {view === 'tasks' && data.membership.isOfficer && <details id="task-help" className={s.helpSection} open={liveBlockers.length > 0 || Boolean(helpTarget)}><summary>Need help with a task?{liveBlockers.length ? ` · ${liveBlockers.length} open requests` : ''}</summary><section className={s.panel}><h2>Blocked / need help</h2><p>Flag a task early so the team can help before its deadline.</p>{liveBlockers.map(b => <article className={s.row} key={b.task_id}><div><h3>{data.tasks.find(t => t.id === b.task_id)?.title || 'Help requested'}</h3><p className={s.prose}>{b.reason}</p><p className={s.muted}>Asked {data.people.find(p => p.id === b.helper_id)?.name || 'the review team'} for help</p>{helpTasks.some(t => t.id === b.task_id) && <button disabled={busy || dirty} onClick={() => save('save_task_blocker', { p_task_id: b.task_id, p_reason: b.reason, p_helper: b.helper_id, p_resolved: true }, 'Task marked unblocked.')}>Mark unblocked</button>}</div></article>)}{!liveBlockers.length && <p>No active help requests.</p>}</section>{helpTasks.length > 0 && <section className={s.panel}><h2>Request or update help</h2><form key={`${draftEpoch}-${helpTarget}`} onChange={() => { setDirty(true); setDirtyScope('help'); }} onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget, f = new FormData(form); if (await save('save_task_blocker', { p_task_id: f.get('task'), p_reason: f.get('reason'), p_helper: f.get('helper') || null, p_resolved: false }, 'Help request saved.'))
        form.reset(); }}><label>Task<select required name="task" defaultValue={helpTarget || undefined}>{helpTasks.map(t => <option value={t.id} key={t.id}>{t.title}</option>)}</select></label><label>What is blocking you?<textarea required name="reason" maxLength={5000}/></label><label>Ask someone for help<select name="helper"><option value="">Review team</option>{data.people.filter(p => p.id !== data.userId).map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><button className={s.primary} disabled={busy}>Save help request</button></form></section>}</details>}
 {view === 'reports' && data.membership.isOfficer && <AccomplishmentsReport data={data}/>}
 </div>;
}
