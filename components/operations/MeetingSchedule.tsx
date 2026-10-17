'use client';
import VolunteerAudienceFields from '@/components/officerboard/VolunteerAudienceFields';
import { useState } from 'react';
import { CONTRACT_YEAR, localDateInput, type OfficerEvent } from '@/lib/officer-tracking';
import type { SaveAction } from './MeetingWorkspace';
import s from './operations.module.css';

/** Edit the schedule where the meeting/event is being used, without another workspace. */
export default function MeetingSchedule({ event, kind, save, busy, dirtyScope, markDirty }: {
  event?: OfficerEvent; kind: 'meeting' | 'volunteer'; save: SaveAction; busy: boolean;
  dirtyScope: string | null; markDirty: (scope: string) => void;
}) {
  const scope = `schedule-${event?.id ?? 'new'}`;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  return <details className={s.schedule} open={editing} onToggle={e => setEditing(e.currentTarget.open)}>
    <summary>{event ? 'Edit schedule' : kind === 'meeting' ? 'Schedule a meeting' : 'Schedule an event'}</summary>
    <form className={s.scheduleForm} key={event?.id ?? kind} onChange={() => { markDirty(scope); setError(''); }} onSubmit={async e => {
      e.preventDefault();
      const form = e.currentTarget, f = new FormData(form);
      const start = new Date(String(f.get('starts_at'))), end = new Date(String(f.get('ends_at')));
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) { setError('Choose an end time after the start time.'); return; }
      const saved = await save('save_officer_event', {
        p_title: f.get('title'), p_kind: f.get('kind') || 'meeting', p_year: f.get('year'),
        p_starts_at: start.toISOString(), p_ends_at: end.toISOString(), p_location: f.get('location'),
        p_mandatory: kind === 'meeting' ? f.get('mandatory') === 'on' : event?.mandatory ?? false, p_approved: kind !== 'meeting' ? f.get('approved') === 'on' : event?.gea_approved ?? false,
        p_public_volunteering: kind !== 'meeting' && f.get('public_volunteering') === 'on',
        p_public_description: f.has('public_description') ? f.get('public_description') : null,
        p_public_signup_open: f.has('public_description') ? f.get('public_signup_open') === 'on' : null,
        p_public_capacity: f.get('public_capacity') ? Number(f.get('public_capacity')) : null,
        p_notes: event?.notes ?? '', p_event_id: event?.id ?? null, p_cancelled: f.get('cancelled') === 'on',
      }, event ? 'Schedule updated.' : kind === 'meeting' ? 'Meeting scheduled. Choose it above to add documents or take attendance.' : 'Event scheduled. Choose it above to plan it.');
      if (saved) { setEditing(false); if (!event) form.reset(); }
    }}>
      <fieldset disabled={busy || Boolean(dirtyScope && dirtyScope !== scope)}>
        <label>{kind === 'meeting' ? 'Meeting title' : 'Event title'}<input name="title" defaultValue={event?.title} required maxLength={200} /></label>
        <div className={s.grid}>
          {kind !== 'meeting' && <label>Event type<select name="kind" defaultValue={event?.kind ?? 'volunteer'}><option value="volunteer">Volunteer</option><option value="outreach">Outreach</option></select></label>}
          <label>Academic year<input name="year" defaultValue={event?.academic_year ?? CONTRACT_YEAR} required pattern="[0-9]{4}-[0-9]{4}" /></label>
          <label>Location<input name="location" defaultValue={event?.location} maxLength={500} /></label>
        </div>
        <p className={s.muted}>Enter times in {Intl.DateTimeFormat().resolvedOptions().timeZone}. The workspace displays Pacific time.</p>
        <div className={s.grid}>
          <label>Starts<input type="datetime-local" name="starts_at" defaultValue={event && localDateInput(event.starts_at)} required /></label>
          <label>Ends<input type="datetime-local" name="ends_at" defaultValue={event && localDateInput(event.ends_at)} required /></label>
        </div>
        {kind === 'meeting' ? <label className={s.check}><input type="checkbox" name="mandatory" defaultChecked={event?.mandatory ?? true} />Required leadership meeting</label> : <label className={s.check}><input type="checkbox" name="approved" defaultChecked={event?.gea_approved ?? true} />GEA-approved volunteer or outreach event</label>}
        {kind !== 'meeting' && <VolunteerAudienceFields event={event} checkboxClass={s.check}/>}
        {event && <label className={s.check}><input type="checkbox" name="cancelled" defaultChecked={event.cancelled} />Cancel this event and keep its records</label>}
        {error && <p role="alert" className={s.error}>{error}</p>}
        <button className={s.primary} disabled={busy}>{event ? 'Save schedule' : kind === 'meeting' ? 'Schedule meeting' : 'Schedule event'}</button>
      </fieldset>
    </form>
  </details>;
}
