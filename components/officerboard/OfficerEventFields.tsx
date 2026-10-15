"use client";

import { localDateInput, type OfficerEvent } from "@/lib/officer-tracking";
import styles from "./officerboard.module.css";

export default function OfficerEventFields({ event, kind, year }: {event?: OfficerEvent; kind: "meeting" | "volunteer"; year: string}) {
  return <>
    <label>Event title<input name="title" required maxLength={200} defaultValue={event?.title} /></label>
    <label>Event type<select name="kind" defaultValue={event?.kind ?? kind}><option value="meeting">Leadership meeting</option><option value="volunteer">Volunteer event</option><option value="outreach">Outreach event</option></select></label>
    <label>Academic year<input name="year" required pattern="[0-9]{4}-[0-9]{4}" defaultValue={event?.academic_year ?? year} /></label>
    <p>Enter times in your device’s time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Schedules display in Pacific Time.</p>
    <label>Start<input name="starts_at" type="datetime-local" required defaultValue={event && localDateInput(event.starts_at)} /></label>
    <label>End<input name="ends_at" type="datetime-local" required defaultValue={event && localDateInput(event.ends_at)} /></label>
    <label>Location<input name="location" maxLength={500} defaultValue={event?.location} /></label>
    <label className={styles.checkbox}><input name="mandatory" type="checkbox" defaultChecked={event?.mandatory ?? kind === "meeting"} />Mandatory leadership meeting</label>
    <label className={styles.checkbox}><input name="approved" type="checkbox" defaultChecked={event?.gea_approved ?? kind === "volunteer"} />GEA-approved volunteer / outreach event</label>
    <label className={styles.checkbox}><input name="cancelled" type="checkbox" defaultChecked={event?.cancelled} />Cancelled (retain historical records)</label>
    <label>Event notes<textarea name="notes" maxLength={10000} rows={3} defaultValue={event?.notes} /></label>
  </>;
}
