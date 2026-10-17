'use client';
import type { OperationsData } from '@/lib/gea-operations-data';
import { schoolDate } from '@/lib/officer-tracking';
import type { SaveAction } from './MeetingWorkspace';
import s from './operations.module.css';
export default function EventPlanning({ data, eventId, save, busy, markDirty, dirtyScope }: {
    data: OperationsData;
    eventId: string;
    save: SaveAction;
    busy: boolean;
    dirtyScope: string | null;
    markDirty: (scope: string) => void;
}) {
    const event = data.events.find(e => e.id === eventId && e.kind !== 'meeting');
    if (!event)
        return <p>Select an event to open its plan.</p>;
    const plan = data.plans.find(p => p.event_id === eventId), editable = !event.cancelled && (data.reviewer || plan?.organizer_id === data.userId);
    return <><section className={s.panel}><h2>{event.title}</h2><p>{schoolDate(event.starts_at)} · {event.location}{event.cancelled ? ' · Cancelled' : ''}</p><p>{event.notes}</p><a className={s.button} href={`${data.taskHref}?view=tasks`}>Open participation & hours</a></section>
 <div className={s.grid}><section className={s.panel}><h2>Event plan</h2>{editable ? <form key={`${eventId}-${plan?.version ?? 0}`} onChange={() => markDirty('plan')} onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await save('save_event_plan', { p_event_id: eventId, p_organizer: f.get('organizer') || null, p_staffing: f.get('staffing'), p_supplies: f.get('supplies'), p_recap: f.get('recap'), p_version: plan?.version ?? 0 }, 'Event plan saved.'); }}><fieldset disabled={busy || Boolean(dirtyScope && dirtyScope !== 'plan')}><label>Organizer<select name="organizer" defaultValue={plan?.organizer_id ?? ''}>{data.reviewer ? <><option value="">Not assigned</option>{data.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</> : <option value={data.userId}>You</option>}</select></label><label>Staffing needs<textarea name="staffing" defaultValue={plan?.staffing} maxLength={5000}/></label><label>Supplies<textarea name="supplies" defaultValue={plan?.supplies} maxLength={5000}/></label><label>Post-event recap<textarea name="recap" defaultValue={plan?.recap} maxLength={10000}/></label><button className={s.primary} disabled={busy}>Save event plan</button></fieldset></form> : <><p>Organizer: {data.people.find(p => p.id === plan?.organizer_id)?.name || 'Not assigned'}</p>{[['Staffing', plan?.staffing], ['Supplies', plan?.supplies], ['Recap', plan?.recap]].map(([label, value]) => <div className="mt-4" key={label}><h3>{label}</h3><p className={s.prose}>{value || 'No details yet.'}</p></div>)}{!plan && <p className={s.muted}>A reviewer can assign an organizer and start this plan.</p>}</>}</section>
 <section className={s.panel}><h2>Preparation checklist</h2>{data.checklist.filter(c => c.event_id === eventId).map(c => <label className={s.check} key={c.id}><input type="checkbox" checked={c.done} disabled={!editable || busy || Boolean(dirtyScope)} onChange={e => save('save_event_checklist', { p_event_id: eventId, p_title: c.title, p_done: e.target.checked, p_id: c.id }, 'Checklist updated.')}/><span>{c.title}{c.done ? ' · Done' : ''}</span></label>)}{!data.checklist.some(c => c.event_id === eventId) && <p>No preparation items yet.</p>}{editable && <form onChange={() => markDirty('checklist')} onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget, f = new FormData(form); if (await save('save_event_checklist', { p_event_id: eventId, p_title: f.get('title') }, 'Checklist item added.'))
        form.reset(); }}><fieldset disabled={busy || Boolean(dirtyScope && dirtyScope !== 'checklist')}><label>New preparation item<input required name="title" maxLength={200}/></label><button disabled={busy}>Add checklist item</button></fieldset></form>}</section></div></>;
}
