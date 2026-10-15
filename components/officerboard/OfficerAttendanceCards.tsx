"use client";

import type { OfficerProfile } from "@/lib/peet";
import type { OfficerAttendance } from "@/lib/officer-tracking";
import styles from "./officerboard.module.css";

export type AttendanceCardRow = {
  person: OfficerProfile;
  status: OfficerAttendance["status"];
  changed: boolean;
  hasNotes: boolean;
  hasAbsenceNotice: boolean;
};

export default function OfficerAttendanceCards({ rows, busy, cancelled, hasUnsavedChanges, onStatusChange, onOpenOfficer, onNotes }: {
  rows: AttendanceCardRow[];
  busy: boolean;
  cancelled: boolean;
  hasUnsavedChanges: boolean;
  onStatusChange: (officerId: string, status: OfficerAttendance["status"]) => void;
  onOpenOfficer: (officerId: string) => void;
  onNotes: (person: OfficerProfile) => void;
}) {
  return <div className={styles.attendanceCards} aria-label="Officer attendance">
    {rows.map(({ person, status, changed, hasNotes, hasAbsenceNotice }) => <article key={person.id} className={styles.attendanceCard} data-pending={changed || undefined}>
      <div className={styles.attendanceCardHeader}>
        <div>
          <button type="button" className={styles.rosterPerson} disabled={busy || hasUnsavedChanges} onClick={() => onOpenOfficer(person.id)}>{person.name}</button>
          <p>{person.email || person.position}</p>
        </div>
        {changed && <span className={styles.badge}>Unsaved</span>}
      </div>
      <label className={styles.attendanceStatus}>
        <span>Status</span>
        <select aria-label={`Attendance status for ${person.name}${person.email ? ` (${person.email})` : ""}`} value={status} disabled={busy || cancelled} onChange={event => onStatusChange(person.id, event.target.value as OfficerAttendance["status"])}>
          <option value="unmarked">Not recorded</option>
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="excused">Excused absence</option>
          <option value="unexcused">Unexcused absence</option>
        </select>
      </label>
      <div className={styles.attendanceCardNotes}>
        <button type="button" className={styles.link} disabled={busy || cancelled} onClick={() => onNotes(person)}>
          {hasNotes || hasAbsenceNotice ? "View / edit notes" : "Add notes"}<span className="sr-only"> for {person.name}</span>
        </button>
        {hasAbsenceNotice && <span>Absence notice received</span>}
      </div>
    </article>)}
  </div>;
}
