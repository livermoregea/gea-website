'use client';
import { useState } from 'react';
import type { OperationsData } from '@/lib/gea-operations-data';
import { googleDocLink } from '@/lib/meeting-documents';
import { schoolDate } from '@/lib/officer-tracking';
import type { SaveAction } from './MeetingWorkspace';
import s from './operations.module.css';
import EventParticipation from '@/components/officerboard/EventParticipation';

export default function EventPlanning({ data, eventId, save, busy, markDirty, dirtyScope }: {
    data: OperationsData;
    eventId: string;
    save: SaveAction;
    busy: boolean;
    dirtyScope: string | null;
    markDirty: (scope: string) => void;
}) {
    const [linkError, setLinkError] = useState('');
    const [search, setSearch] = useState('');
    const event = data.events.find(e => e.id === eventId && e.kind !== 'meeting');
    if (!event) return <p>Select an event to open its plan.</p>;
    const plan = data.plans.find(p => p.event_id === eventId);
    const editable = !event.cancelled && (data.reviewer || plan?.organizer_id === data.userId);
    const documentUrl = googleDocLink(plan?.planning_doc_url);

    return <>
        <section className={s.panel}>
            <h2>{event.title}</h2>
            <p>{schoolDate(event.starts_at)} · {event.location}{event.cancelled ? ' · Cancelled' : ''}</p>
            <p>{event.notes}</p>
            <a className={s.button} href={`${data.taskHref}?view=volunteer&event=${event.id}`}>Open participation &amp; hours</a>
        </section>
        <section className={`${s.panel} ${s.readingColumn}`}>
            <h2>Planning sheet</h2>
            <p className={s.muted}>Keep staffing needs, supplies, preparation items, and the post-event recap together in a Google Doc.</p>
            <p>Organizer: {data.people.find(p => p.id === plan?.organizer_id)?.name || 'Not assigned'}</p>
            <div className={s.documentLinks}>
                {documentUrl ? <a className={s.button} href={documentUrl} target="_blank" rel="noopener noreferrer">Open planning sheet ↗</a> : <p className={s.muted}>No planning sheet linked yet.</p>}
            </div>
            {editable && <form key={`${eventId}-${plan?.version ?? 0}`} onChange={() => { markDirty('plan'); setLinkError(''); }} onSubmit={async e => {
                e.preventDefault();
                const fields = new FormData(e.currentTarget);
                const input = String(fields.get('planning_doc_url') ?? '').trim();
                const url = googleDocLink(input);
                if (input && !url) {
                    setLinkError('Enter a Google Docs document link beginning with https://docs.google.com/document/.');
                    return;
                }
                await save('save_event_planning_document', {
                    p_event_id: eventId,
                    p_organizer: fields.get('organizer') || null,
                    p_document_url: url,
                    p_version: plan?.version ?? 0,
                }, 'Planning sheet link saved.');
            }}>
                <fieldset disabled={busy || Boolean(dirtyScope && dirtyScope !== 'plan')}>
                    <label>Organizer<select name="organizer" defaultValue={plan?.organizer_id ?? ''}>
                        {data.reviewer ? <><option value="">Not assigned</option>{data.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</> : <option value={data.userId}>You</option>}
                    </select></label>
                    <label>Google Doc planning sheet<input name="planning_doc_url" type="url" maxLength={2048} defaultValue={plan?.planning_doc_url ?? ''} placeholder="https://docs.google.com/document/d/…" /></label>
                    <p className={s.muted}>Share the document in Google Docs with the officers who need access. Leave the link blank to remove it.</p>
                    {linkError && <p role="alert" className={s.error}>{linkError}</p>}
                    <button className={s.primary} disabled={busy}>Save planning sheet link</button>
                </fieldset>
            </form>}
            {!plan && !editable && <p className={s.muted}>A reviewer can assign an organizer and add a planning sheet.</p>}
        </section>
        <section className={s.panel}>
            <h2>Event participants</h2>
            <p className={s.muted}>Officers can request or withdraw participation. Reviewers can assign or unassign officers and edit their role and notes.</p>
            {data.reviewer && <label>Find officers<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or position" /></label>}
            {data.people.filter(person => (data.reviewer || person.id === data.userId) && `${person.name} ${person.position ?? ''}`.toLowerCase().includes(search.toLowerCase())).map(person => <article className={s.row} key={`${event.id}-${person.id}`}>
                <div><h3>{person.name}</h3><p className={s.muted}>{person.position}</p>
                    <EventParticipation event={event} officerId={person.id} name={person.name} signup={data.signups?.find(row => row.event_id === eventId && row.officer_id === person.id)} canManage={data.reviewer} isSelf={person.id === data.userId} disabled={busy || Boolean(dirtyScope)} />
                </div>
            </article>)}
            {!data.people.some(person => data.reviewer || person.id === data.userId) && <p className={s.muted}>No active officers available.</p>}
        </section>
    </>;
}
