'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OperationsData } from '@/lib/gea-operations-data';
import { schoolDate } from '@/lib/officer-tracking';
import s from './operations.module.css';
import { googleDocLink } from '@/lib/meeting-documents';
export type SaveAction = (rpc: string, args: Record<string, unknown>, message: string) => Promise<boolean>;
type Roll = {
    officer_id: string;
    name: string;
    position: string;
    status: string;
};
export default function MeetingWorkspace({ data, eventId, save, busy, markDirty, dirtyScope }: {
    data: OperationsData;
    eventId: string;
    save: SaveAction;
    busy: boolean;
    dirtyScope: string | null;
    markDirty: (scope: string) => void;
}) {
    const event = data.events.find(e => e.id === eventId && e.kind === 'meeting');
    const note = data.notes.find(n => n.event_id === eventId);
    const [roll, setRoll] = useState<Roll[]>([]), [draft, setDraft] = useState<Record<string, string>>({}), [rollError, setRollError] = useState(''), [linkError, setLinkError] = useState('');
    useEffect(() => { let active = true; setRoll([]); setDraft({}); setRollError(''); if (data.canMeetings && eventId)
        createClient().rpc('meeting_roll_call', { p_event_id: eventId }).then(({ data: rows, error }: {
            data: Roll[] | null;
            error: {
                message: string;
            } | null;
        }) => { if (active) {
            if (error)
                setRollError(error.message);
            else
                setRoll(rows ?? []);
        } }); return () => { active = false; }; }, [eventId, data.canMeetings, data]);
    if (!event)
        return <p>Select a meeting to view its agenda and minutes.</p>;
    const agenda = data.agenda.filter(a => a.event_id === eventId);
    const unmarkedCount = roll.filter(row => (draft[row.officer_id] ?? row.status) === 'unmarked').length;
    const changedCount = roll.filter(row => (draft[row.officer_id] ?? row.status) !== row.status).length;
    const meetingHasStarted = new Date(event.starts_at).getTime() <= Date.now();
    function markAllPresent() {
        setDraft(current => {
            const next = { ...current };
            for (const row of roll) {
                if ((current[row.officer_id] ?? row.status) === 'unmarked') next[row.officer_id] = 'present';
            }
            return next;
        });
        markDirty('attendance');
    }
    return <>
  <section className={s.panel}><h2>{event.title}</h2><p>{schoolDate(event.starts_at)} · {event.location || 'Location to be announced'}{event.cancelled ? ' · Cancelled' : ''}</p></section>
  <div className={data.canMeetings ? s.meetingColumns : s.readingColumn}>
  <section className={s.panel}>
    <h2>Meeting documents</h2>
    <div className={s.documentLinks}>
      {googleDocLink(note?.agenda_doc_url) ? <a className={s.button} href={googleDocLink(note?.agenda_doc_url)!} target="_blank" rel="noopener noreferrer">Open agenda ↗</a> : <p className={s.muted}>No agenda document linked yet.</p>}
      {googleDocLink(note?.notes_doc_url) ? <a className={s.button} href={googleDocLink(note?.notes_doc_url)!} target="_blank" rel="noopener noreferrer">Open meeting notes ↗</a> : <p className={s.muted}>No meeting notes document linked yet.</p>}
    </div>
    {data.canMeetings && !event.cancelled && <details className={s.documentEditor} open={!note?.agenda_doc_url || !note?.notes_doc_url}><summary>{note?.agenda_doc_url || note?.notes_doc_url ? 'Edit document links' : 'Add document links'}</summary><form key={`${eventId}-${note?.version ?? 0}`} onChange={() => { markDirty('documents'); setLinkError(''); }} onSubmit={async e => {
      e.preventDefault();
      const fields = new FormData(e.currentTarget);
      const agendaInput = String(fields.get('agenda_doc_url') ?? '').trim();
      const notesInput = String(fields.get('notes_doc_url') ?? '').trim();
      const agendaUrl = googleDocLink(agendaInput), notesUrl = googleDocLink(notesInput);
      if ((agendaInput && !agendaUrl) || (notesInput && !notesUrl)) { setLinkError('Enter a Google Docs document link beginning with https://docs.google.com/document/.'); return; }
      await save('save_meeting_documents', { p_event_id: eventId, p_agenda_url: agendaUrl, p_notes_url: notesUrl, p_version: note?.version ?? 0 }, 'Meeting document links saved.');
    }}>
      <fieldset disabled={busy || Boolean(dirtyScope && dirtyScope !== 'documents')}>
        <label>Agenda Google Doc<input name="agenda_doc_url" type="url" maxLength={2048} defaultValue={note?.agenda_doc_url ?? ''} placeholder="https://docs.google.com/document/d/…" /></label>
        <label>Meeting notes Google Doc<input name="notes_doc_url" type="url" maxLength={2048} defaultValue={note?.notes_doc_url ?? ''} placeholder="https://docs.google.com/document/d/…" /></label>
        <p className={s.muted}>Keep the agenda and notes in Google Docs. Share each document with the officers who need access. Leave a field blank to remove its link.</p>
        {linkError && <p role="alert" className={s.error}>{linkError}</p>}
        <button className={s.primary} disabled={busy}>Save document links</button>
        {note && <p className={s.muted}>Last saved {schoolDate(note.updated_at)}</p>}
      </fieldset>
    </form></details>}
    {(note?.minutes || note?.decisions || agenda.length > 0) && <details>
      <summary>Previously recorded agenda &amp; notes</summary>
      {agenda.map(item => <article className={s.row} key={item.id}><div><h3>{item.title}</h3><p className={s.prose}>{item.details}</p>{item.task_id && <a href={`${data.taskHref}?task=${item.task_id}`}>Open assigned task</a>}</div></article>)}
      {note?.minutes && <><h3>Notes</h3><p className={s.prose}>{note.minutes}</p></>}
      {note?.decisions && <><h3>Decisions</h3><p className={s.prose}>{note.decisions}</p></>}
    </details>}
  </section>
  {data.canMeetings && <section className={s.panel}><h2>Meeting attendance</h2><p className={s.muted}>Secretary and reviewers can record roll call. Private explanations and reviewer notes stay in the officer workspace.</p>{rollError && <p role="alert" className={s.error}>{rollError}</p>}{!roll.length && !rollError && <p role="status">Loading roll call…</p>}
   {!event.cancelled && <div className={s.actions}>
     <button type="button" disabled={busy || !meetingHasStarted || !unmarkedCount || Boolean(dirtyScope && dirtyScope !== 'attendance')} onClick={markAllPresent}>Mark all present</button>
     <p className={s.muted}>{meetingHasStarted ? 'Fills unmarked officers only. Existing statuses stay as entered. Choose Save attendance to apply your changes.' : 'Attendance can be marked present after the meeting begins.'}</p>
   </div>}
   {roll.map(r => <div className={s.attendanceRow} key={r.officer_id}><div><strong>{r.name}</strong><p className={s.muted}>{r.position}</p></div><label><span className="sr-only">Attendance for {r.name}</span><select disabled={busy || event.cancelled || Boolean(dirtyScope && dirtyScope !== 'attendance')} value={draft[r.officer_id] ?? r.status} onChange={e => { setDraft({ ...draft, [r.officer_id]: e.target.value }); markDirty('attendance'); }}>{['unmarked', 'present', 'late', 'excused', 'unexcused'].map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label></div>)}
   {!event.cancelled && roll.length > 0 && <div className={s.saveBar}><p className={s.muted} role="status">{changedCount ? `${changedCount} unsaved ${changedCount === 1 ? 'change' : 'changes'}` : 'No unsaved attendance changes'}</p><button className={s.primary} disabled={busy || !changedCount} onClick={() => save('save_meeting_attendance', { p_event_id: eventId, p_rows: roll.filter(r => draft[r.officer_id] && draft[r.officer_id] !== r.status).map(r => ({ officer_id: r.officer_id, status: draft[r.officer_id], original_status: r.status })) }, 'Attendance saved for this meeting.')}>Save attendance</button></div>}
  </section>}
  </div>
 </>;
}
