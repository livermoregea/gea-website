"use client";

import WorkspaceActivity from "@/components/WorkspaceActivity";

import ActionError from "@/components/ActionError";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { peetError, type OfficerProfile } from "@/lib/peet";
import { CONTRACT_YEAR, durationLabel, localDateInput, schoolDate, trackingSummary, eventParticipationLabel, type TrackingData, type OfficerEvent, type OfficerStrike, type VolunteerLog, type RemovalReview } from "@/lib/officer-tracking";
import Modal from "./Modal";
import OfficerEventFields from "./OfficerEventFields";
import EventParticipation from "./EventParticipation";
import styles from "./officerboard.module.css";

type Action = { kind: "event"; event?: OfficerEvent } | { kind: "attendance" | "absence" | "volunteer"; event: OfficerEvent }
  | { kind: "strike" | "generalNotes" } | { kind: "response" | "strikeDecision"; strike: OfficerStrike }
  | { kind: "volunteerReview"; log: VolunteerLog } | { kind: "removalReview"; review: RemovalReview };
const attendanceNames = { unmarked: "Not recorded", present: "Present", late: "Late", excused: "Excused absence", unexcused: "Unexcused absence" };

export default function TrackingPanel({ mode, profile, profiles, officerId, data, isSuperAdmin = false, embedded = false, academicYear, showMetrics = false }: {
  mode: "attendance" | "volunteer" | "accountability"; profile: OfficerProfile; profiles: OfficerProfile[]; officerId: string; data: TrackingData; isSuperAdmin?: boolean; embedded?: boolean; academicYear?: string; showMetrics?: boolean;
}) {
  const router = useRouter();
  const [localYear, setYear] = useState(CONTRACT_YEAR);
  const year = academicYear ?? localYear;
  const [action, setAction] = useState<Action | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const admin = isSuperAdmin || profile.role === "admin";
  const advisor = isSuperAdmin || profile.reviewer_kind === "advisor";
  const officerSubject = profiles.find(person => person.id === officerId)?.reviewer_kind !== "advisor";
  const leadershipRoster = profiles.filter(person => person.reviewer_kind !== "advisor" && !person.is_teacher && person.access_enabled !== false);
  const busy = saving || refreshing;
  const summary = trackingSummary(data, officerId, year);
  const years = [...new Set([CONTRACT_YEAR, ...data.events.map(event => event.academic_year), ...data.strikes.map(strike => strike.academic_year)])].sort().reverse();
  const events = data.events.filter(event => event.academic_year === year && (mode === "attendance" ? event.kind === "meeting" : event.kind !== "meeting"));
  const strikes = data.strikes.filter(strike => strike.officer_id === officerId && strike.academic_year === year);
  const reviews = data.reviews.filter(review => review.officer_id === officerId && review.academic_year === year);
  const eventFor = (id: string) => data.events.find(event => event.id === id);
  const officerName = (id: string) => profiles.find(person => person.id === id)?.name ?? "Officer";
  const attendanceFor = (event: OfficerEvent) => data.attendance.find(row => row.event_id === event.id && row.officer_id === officerId);
  const logFor = (event: OfficerEvent) => data.volunteerLogs.find(row => row.event_id === event.id && row.officer_id === officerId);
  const pendingLogs = data.volunteerLogs.filter(log => log.status === "pending" && (!embedded || log.officer_id === officerId) && eventFor(log.event_id)?.academic_year === year);
  const responsePending = strikes.filter(strike => strike.status === "notified");
  const generalNotes = data.generalNotes.find(record => record.officer_id === officerId && record.academic_year === year);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const iso = (value: FormDataEntryValue | null) => new Date(String(value)).toISOString();
  function open(next: Action) { setNotice(""); setError(null); setAction(next); }
  async function mutate(name: string, args: Record<string, unknown>, message: string) {
    setSaving(true); setError(null); setNotice("");
    try {
      const { error: rpcError } = await createClient().rpc(name, args);
      if (rpcError) { setError(peetError(rpcError)); return; }
      setAction(null); setNotice(message); startTransition(() => router.refresh());
    } catch { setError(peetError(null)); } finally { setSaving(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    if (!action) return;
    try {
      if (action.kind === "event") await mutate("save_officer_event", {
        p_title: fields.get("title"), p_kind: fields.get("kind"), p_year: fields.get("year"),
        p_starts_at: iso(fields.get("starts_at")), p_ends_at: iso(fields.get("ends_at")), p_location: fields.get("location"),
        p_mandatory: fields.get("mandatory") === "on", p_approved: fields.get("approved") === "on",
        p_cancelled: fields.get("cancelled") === "on", p_notes: fields.get("notes"), p_event_id: action.event?.id ?? null,
      }, "Event saved.");
      if (action.kind === "attendance") await mutate("record_officer_attendance", {
        p_event_id: action.event.id, p_officer_id: fields.get("officer"), p_status: fields.get("status"), p_notes: fields.get("notes"),
      }, "Attendance recorded. Absences do not automatically issue strikes.");
      if (action.kind === "absence") await mutate("notify_officer_absence", { p_event_id: action.event.id, p_notice: fields.get("notes") }, "Your absence notice is available to the executive team.");
      if (action.kind === "volunteer") await mutate("submit_officer_volunteer", {
        p_event_id: action.event.id, p_officer_id: officerId, p_check_in: iso(fields.get("check_in")), p_check_out: iso(fields.get("check_out")), p_notes: fields.get("notes"),
      }, "Volunteer work submitted for verification.");
      if (action.kind === "volunteerReview") await mutate("review_officer_volunteer", { p_log_id: action.log.id, p_status: fields.get("status"), p_notes: fields.get("notes") }, "Volunteer review saved.");
      if (action.kind === "strike") await mutate("create_officer_strike", {
        p_officer_id: officerId, p_year: year, p_category: fields.get("category"), p_incident_date: fields.get("incident_date"),
        p_reason: fields.get("notes"), p_response_due_at: iso(fields.get("deadline")), p_attendance_id: fields.get("attendance") || null,
      }, "Concern recorded. The officer has an in-portal notification and an opportunity to respond before confirmation.");
      if (action.kind === "response") await mutate("respond_officer_strike", { p_strike_id: action.strike.id, p_response: fields.get("notes") }, "Your explanation has been saved for review.");
      if (action.kind === "generalNotes") await mutate("save_officer_accountability_notes", { p_officer_id: officerId, p_year: year, p_notes: fields.get("notes") }, "General notes saved.");
      if (action.kind === "strikeDecision") await mutate("decide_officer_strike", { p_strike_id: action.strike.id, p_status: fields.get("status"), p_notes: fields.get("notes") }, "Strike decision recorded.");
      if (action.kind === "removalReview") await mutate("decide_officer_removal_review", { p_review_id: action.review.id, p_status: fields.get("status"), p_notes: fields.get("notes") }, "Advisor decision recorded. Leadership membership is not automatically changed.");
    } catch { setError("Check the dates and times before saving."); }
  }
  const modalError = error && <ActionError message={error} className={styles.error} />;
  const formButtons = <div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => setAction(null)}>Cancel</button><button className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>;
  function logDetails(log: VolunteerLog) {
    return <p>{schoolDate(log.check_in)} → {schoolDate(log.check_out)}<br />{durationLabel(log.minutes)} · {log.notes || "No notes"}</p>;
  }

  return <div data-workspace-busy={busy ? "true" : undefined}>
    <WorkspaceActivity saving={saving} refreshing={refreshing} />
    {!embedded && <div className={styles.filter}><label htmlFor="officer-school-year">Academic year</label><select id="officer-school-year" value={year} onChange={event => setYear(event.target.value)}>{years.map(value => <option key={value}>{value}</option>)}</select></div>}
    <p role="status" className={styles.notice}>{notice || (refreshing ? "Updating records…" : "")}</p>
    {!action && modalError}
    {mode === "attendance" && <>
      {(!embedded || showMetrics) && <div className={styles.trackingMetrics}><article><h2>Meetings attended</h2><strong>{summary.present}</strong><p>Includes recorded late arrivals</p></article><article><h2>Excused absences</h2><strong>{summary.excused}</strong><p>Reasonably excused by a reviewer</p></article><article><h2>Unexcused absences</h2><strong>{summary.unexcused}</strong><p>Each incident requires individual review</p></article></div>}
      <section className={styles.section}><div className={styles.sectionHeading}><div><h2>Leadership meetings</h2><p>Notify the executive team before a meeting when possible; explain emergencies as soon as you reasonably can.</p></div>{admin && <button className={styles.primary} onClick={() => open({ kind: "event" })}>Add meeting</button>}</div>
        {!events.length && <p className={styles.empty}>No meetings recorded for this academic year.</p>}
        {events.map(event => {
          const record = attendanceFor(event);
          return <article key={event.id} className={styles.taskRow}><div className={styles.taskCopy}><h3>{event.title}</h3><p>{schoolDate(event.starts_at)} – {schoolDate(event.ends_at)}<br />{event.location}</p><span className={styles.badge}>{event.cancelled ? "Cancelled" : event.mandatory ? "Mandatory" : "Optional"}</span> <span className={styles.badge}>{attendanceNames[record?.status ?? "unmarked"]}</span>
            {event.notes && <p>{event.notes}</p>}{record?.absence_notice && <p>Absence notice: {record.absence_notice}<br />Sent {record.notice_at ? schoolDate(record.notice_at) : "—"}</p>}{record?.reviewer_notes && <p>Reviewer notes: {record.reviewer_notes}</p>}</div>
            <div className={styles.actions}>{admin && <button className={styles.secondary} onClick={() => open({ kind: "event", event })}>Edit meeting<span className="sr-only"> {event.title}</span></button>}{!event.cancelled && <>
              {admin && <button className={styles.primary} onClick={() => open({ kind: "attendance", event })}>Record attendance<span className="sr-only"> for {event.title}</span></button>}
              {officerId === profile.id && <button className={styles.secondary} onClick={() => open({ kind: "absence", event })}>Absence notice<span className="sr-only"> for {event.title}</span></button>}
            </>}</div></article>;
        })}
      </section>
      {admin && !embedded && events.length > 0 && <section className={styles.section}><div className={styles.sectionHeading}><h2>Meeting attendance roster</h2></div><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Meeting attendance roster; scroll for all meetings"><table className={styles.table}><caption className="sr-only">Recorded attendance for the leadership roster</caption><thead><tr><th scope="col">Officer</th>{events.map(event => <th scope="col" key={event.id}>{event.title}<span>{schoolDate(event.starts_at,false)}</span></th>)}</tr></thead><tbody>{leadershipRoster.map(person => <tr key={person.id}><th scope="row">{person.name}<span>{person.position}</span></th>{events.map(event => <td key={event.id}>{event.cancelled ? "Cancelled" : attendanceNames[data.attendance.find(row => row.officer_id === person.id && row.event_id === event.id)?.status ?? "unmarked"]}</td>)}</tr>)}</tbody></table></div></section>}
    </>}

    {mode === "volunteer" && <>
      {(!embedded || showMetrics) && <div className={styles.trackingMetrics}><article><h2>Approved events</h2><strong>{summary.volunteerEvents}{officerSubject ? "/2" : ""}</strong><p>{!officerSubject ? "Advisor account · officer minimum does not apply" : summary.volunteerEvents >= 2 ? "Contract minimum met" : `${Math.max(0,2-summary.volunteerEvents)} more approved events needed`}</p></article><article><h2>Verified volunteer time</h2><strong>{durationLabel(summary.volunteerMinutes)}</strong><p>Approved logs at GEA-approved events</p></article></div>}
      <section className={styles.section}><div className={styles.sectionHeading}><div><h2>Outreach & volunteer events</h2><p>Request to participate or receive a reviewer assignment. Requests and assignments are separate from verified participation. Check-in/check-out times determine service hours.</p></div>{admin && <button className={styles.primary} onClick={() => open({ kind: "event" })}>Add event</button>}</div>
        {!events.length && <p className={styles.empty}>No service events recorded for this academic year.</p>}
        {events.map(event => {
          const log = logFor(event);
          return <article key={event.id} className={styles.taskRow}><div className={styles.taskCopy}><h3>{event.title}</h3><p>{schoolDate(event.starts_at)} – {schoolDate(event.ends_at)}<br />{event.location}</p><span className={styles.badge}>{event.cancelled ? "Cancelled" : event.gea_approved ? "GEA-approved" : "Not yet GEA-approved"}</span>
            {event.notes && <p>{event.notes}</p>}
            <EventParticipation key={`${event.id}-${officerId}`} event={event} officerId={officerId} name={officerName(officerId)} signup={data.signups.find(row => row.event_id === event.id && row.officer_id === officerId)} canManage={admin && leadershipRoster.some(person => person.id === officerId)} isSelf={officerId === profile.id && leadershipRoster.some(person => person.id === officerId)} disabled={busy} />
            {log && <><p><strong>{log.status === "approved" ? "Verified" : log.status === "rejected" ? "Returned for correction" : "Awaiting verification"}</strong> · {durationLabel(log.minutes)}</p>{logDetails(log)}{log.review_notes && <p>Reviewer feedback: {log.review_notes}</p>}</>}</div>
            <div className={styles.actions}>{admin && <button className={styles.secondary} onClick={() => open({ kind: "event", event })}>Edit event<span className="sr-only"> {event.title}</span></button>}{!event.cancelled && <>
              {log?.status !== "approved" && (admin || officerId === profile.id) && <button className={styles.primary} onClick={() => open({ kind: "volunteer", event })}>{log ? "Edit service log" : "Log service"}<span className="sr-only"> for {event.title}</span></button>}
              {admin && log?.status === "approved" && <button className={styles.secondary} onClick={() => open({ kind: "volunteerReview", log })}>Review verified log<span className="sr-only"> for {event.title}</span></button>}
            </>}</div></article>;
        })}
      </section>
      {admin && (!embedded || pendingLogs.length > 0) && <section className={styles.section}><div className={styles.sectionHeading}><h2>Service verification queue</h2><span className={styles.badge}>{pendingLogs.length} pending</span></div>{!pendingLogs.length && <p className={styles.empty}>No service logs awaiting verification.</p>}{pendingLogs.map(log => <article className={styles.taskRow} key={log.id}><div><h3>{officerName(log.officer_id)} · {eventFor(log.event_id)?.title}</h3>{logDetails(log)}</div><button className={styles.primary} onClick={() => open({ kind: "volunteerReview", log })}>Verify service<span className="sr-only"> for {officerName(log.officer_id)} at {eventFor(log.event_id)?.title}</span></button></article>)}</section>}
      {admin && !embedded && events.length > 0 && <section className={styles.section}><div className={styles.sectionHeading}><h2>Volunteer participation roster</h2></div><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Volunteer participation roster; scroll for all events"><table className={styles.table}><caption className="sr-only">Leadership event requests, assignments, and verified service</caption><thead><tr><th scope="col">Officer</th>{events.map(event => <th scope="col" key={event.id}>{event.title}<span>{schoolDate(event.starts_at,false)}</span></th>)}<th scope="col">Approved events</th><th scope="col">Verified time</th></tr></thead><tbody>{leadershipRoster.map(person => {
        const total=trackingSummary(data,person.id,year);
        return <tr key={person.id}><th scope="row">{person.name}<span>{person.position}</span></th>{events.map(event=>{
          const log=data.volunteerLogs.find(row=>row.officer_id===person.id && row.event_id===event.id);
          const signup=data.signups.find(row=>row.officer_id===person.id && row.event_id===event.id);
          return <td key={event.id}>{log?.status==='approved' ? `Verified · ${durationLabel(log.minutes)}` : log?.status==='pending' ? "Awaiting verification" : eventParticipationLabel(signup)}</td>;
        })}<td>{total.volunteerEvents}/2</td><td>{durationLabel(total.volunteerMinutes)}</td></tr>;
      })}</tbody></table></div></section>}
    </>}

    {mode === "accountability" && <>
      {(!embedded || showMetrics) && <div className={styles.trackingMetrics}><article><h2>Attendance strikes</h2><strong>{summary.attendanceStrikes}/3</strong><p>{summary.attendanceStrikes >= 3 ? "Formal review required" : summary.attendanceStrikes === 2 ? "Advisor review stage" : summary.attendanceStrikes === 1 ? "Peer review stage" : "No confirmed strikes"}</p></article><article><h2>Conduct & professionalism</h2><strong>{summary.conductStrikes}/3</strong><p>{summary.conductStrikes >= 3 ? "Formal review required" : summary.conductStrikes === 2 ? "Advisor review stage" : summary.conductStrikes === 1 ? "Peer review stage" : "No confirmed strikes"}</p></article></div>}
      <p className={styles.warning}>The two categories are independent. Low PEET scores and recorded absences do not automatically issue strikes. Three confirmed strikes in either category initiate formal review; removal requires Academy Advisor approval.</p>
      <section className={styles.section}><div className={styles.sectionHeading}><h2>General notes</h2>{admin && <button className={styles.secondary} onClick={() => open({kind:"generalNotes"})}>Edit general notes</button>}</div><p className={styles.empty}>{generalNotes?.notes || "No general notes recorded."}</p></section>
      <section className={styles.section}><div className={styles.sectionHeading}><div><h2>Concerns & strike history</h2><p>Officers can explain their circumstances before a concern is confirmed.</p></div>{admin && officerSubject && <button className={styles.primary} onClick={() => open({ kind: "strike" })}>Document concern</button>}</div>
        {!strikes.length && <p className={styles.empty}>No concerns or strikes recorded for this academic year.</p>}
        {strikes.map(strike => <article key={strike.id} className={styles.taskRow}><div className={styles.taskCopy}><span className={styles.badge}>{strike.category === "attendance" ? "Attendance" : "Conduct / professionalism"}</span> <span className={styles.badge}>{strike.status === "notified" ? "Awaiting response / review" : strike.status}</span><h3>{schoolDate(strike.incident_date,false)}</h3><p>{strike.reason}</p><p>Notification: {schoolDate(strike.notified_at)}<br />Response opportunity until {schoolDate(strike.response_due_at)}</p>{strike.officer_response && <p><strong>Officer explanation:</strong> {strike.officer_response}</p>}{strike.decision_notes && <p><strong>Review decision:</strong> {strike.decision_notes}</p>}</div><div className={styles.actions}>
          {strike.status === "notified" && strike.officer_id === profile.id && <button className={styles.primary} onClick={() => open({ kind: "response", strike })}>Explain circumstances<span className="sr-only"> for incident {strike.incident_date}</span></button>}
          {admin && ["notified","confirmed"].includes(strike.status) && <button className={styles.secondary} onClick={() => open({ kind: "strikeDecision", strike })}>{strike.status === "confirmed" ? "Revoke strike" : "Review concern"}<span className="sr-only"> for incident {strike.incident_date}</span></button>}
        </div></article>)}
      </section>
      {(!embedded || reviews.length > 0) && <section className={styles.section}><div className={styles.sectionHeading}><h2>Formal removal reviews</h2></div>{!reviews.length && <p className={styles.empty}>A review opens automatically when either category reaches three confirmed strikes. There is no automatic removal.</p>}{reviews.map(review=><article key={review.id} className={styles.taskRow}><div><span className={styles.badge}>{review.status.replaceAll('_',' ')}</span><h3>{review.category === "attendance" ? "Attendance" : "Conduct"} review · {schoolDate(review.opened_at,false)}</h3><p>PEET at opening: {review.context_snapshot.peet_score === null ? "Not yet evaluated" : `${Number(review.context_snapshot.peet_score).toFixed(1)}/100`} · {review.context_snapshot.confirmed_strikes?.length ?? 0} documented strikes</p>{review.advisor_notes && <p>Advisor decision: {review.advisor_notes}</p>}</div>{advisor && review.status === "pending" && <button className={styles.primary} onClick={() => open({ kind: "removalReview", review })}>Record advisor decision</button>}</article>)}</section>}
      {admin && !embedded && <section className={styles.section}><div className={styles.sectionHeading}><h2>Accountability roster</h2></div><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Accountability roster"><table className={styles.table}><caption className="sr-only">Separate confirmed strike categories for leadership members</caption><thead><tr><th scope="col">Officer</th><th scope="col">Attendance strikes</th><th scope="col">Conduct strikes</th><th scope="col">Pending concerns</th></tr></thead><tbody>{leadershipRoster.map(person=>{
        const total=trackingSummary(data,person.id,year);
        return <tr key={person.id}><th scope="row">{person.name}<span>{person.position}</span></th><td>{total.attendanceStrikes}/3</td><td>{total.conductStrikes}/3</td><td>{data.strikes.filter(strike=>strike.officer_id===person.id&&strike.academic_year===year&&strike.status==='notified').length}</td></tr>;
      })}</tbody></table></div></section>}
      {responsePending.length > 0 && officerId === profile.id && <p className={styles.notice}>Your explanation is saved to the database and is visible to the designated reviewers.</p>}
    </>}

    {action && <Modal title="Officer tracking record" onClose={() => setAction(null)} busy={busy}>
      {modalError}<form onSubmit={submit} className={styles.form}><fieldset disabled={busy}>
        {action.kind === "event" && <>
          <h2 className={styles.modalTitle}>{action.event ? "Edit event" : "Schedule an event"}</h2>
          <OfficerEventFields event={action.event} kind={mode === "attendance" ? "meeting" : "volunteer"} year={year} />
        </>}
        {action.kind === "attendance" && <>
          <h2 className={styles.modalTitle}>Record attendance</h2><p>{action.event.title}</p>
          {embedded ? <><input type="hidden" name="officer" value={officerId} /><p>Recording for {officerName(officerId)}</p></> : <label>Officer<select name="officer" defaultValue={officerId}>{leadershipRoster.map(person=><option value={person.id} key={person.id}>{person.name}</option>)}</select></label>}
          <label>Attendance status<select name="status" defaultValue={attendanceFor(action.event)?.status ?? "unmarked"}>{Object.entries(attendanceNames).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
          <label>Reviewer notes<textarea name="notes" rows={3} maxLength={10000} defaultValue={attendanceFor(action.event)?.reviewer_notes} /></label><p>Saving an unexcused absence does not issue a strike. Review the circumstances before documenting a concern.</p>
        </>}
        {action.kind === "absence" && <><h2 className={styles.modalTitle}>Explain an absence</h2><p>{action.event.title}. This notice does not automatically excuse an absence. The executive team will review your circumstances.</p><label>Absence notice<textarea name="notes" required rows={4} maxLength={10000} defaultValue={attendanceFor(action.event)?.absence_notice} /></label></>}
        {action.kind === "volunteer" && <>
          <h2 className={styles.modalTitle}>Log volunteer service</h2><p>{action.event.title} · {officerName(officerId)}</p><p>Enter actual times in your device’s time zone: {timezone}. Early setup time is allowed; a reviewer verifies the log.</p>
          <label>Check-in<input name="check_in" type="datetime-local" required defaultValue={localDateInput(logFor(action.event)?.check_in ?? action.event.starts_at)} /></label><label>Check-out<input name="check_out" type="datetime-local" required defaultValue={localDateInput(logFor(action.event)?.check_out ?? action.event.ends_at)} /></label><label>Service notes<textarea name="notes" rows={3} maxLength={10000} defaultValue={logFor(action.event)?.notes} /></label>
        </>}
        {action.kind === "volunteerReview" && <><h2 className={styles.modalTitle}>Verify volunteer service</h2><p>{officerName(action.log.officer_id)} · {eventFor(action.log.event_id)?.title}</p>{logDetails(action.log)}<label>Verification decision<select name="status" defaultValue="approved"><option value="approved">Approve service</option><option value="rejected">Return for correction</option></select></label><label>Review notes<textarea name="notes" rows={4} maxLength={10000} defaultValue={action.log.review_notes} /></label><p>Only verified time at GEA-approved events counts toward the two-event requirement.</p></>}
        {action.kind === "strike" && <>
          <h2 className={styles.modalTitle}>Document a concern</h2><p>{officerName(officerId)} · {year}. This is a notification for review, not a confirmed strike.</p>
          <label>Category<select name="category" defaultValue="conduct"><option value="attendance">Meeting attendance</option><option value="conduct">Leadership conduct & professionalism</option></select></label>
          <label>Incident date<input name="incident_date" type="date" required /></label>
          <label>Linked unexcused absence (optional for historical records)<select name="attendance" defaultValue=""><option value="">No linked record</option>{data.attendance.filter(row=>row.officer_id===officerId&&row.status==='unexcused'&&eventFor(row.event_id)?.mandatory&&eventFor(row.event_id)?.academic_year===year).map(row=><option value={row.id} key={row.id}>{eventFor(row.event_id)?.title}</option>)}</select></label>
          <label>Documented concern and circumstances<textarea name="notes" required minLength={10} rows={4} maxLength={10000} /></label>
          <label>Response deadline ({timezone})<input name="deadline" type="datetime-local" required /></label>
          <p>The concern appears in the officer’s portal. Give a reasonable opportunity to explain the incident before confirming; use the official channels to draw their attention to this notice.</p>
        </>}
        {action.kind === "response" && <><h2 className={styles.modalTitle}>Your circumstances matter.</h2><p>{action.strike.reason}</p><label>Your explanation<textarea name="notes" required rows={5} maxLength={10000} defaultValue={action.strike.officer_response} /></label></>}
        {action.kind === "generalNotes" && <><h2 className={styles.modalTitle}>General accountability notes</h2><p>These notes are visible to this officer and designated reviewers.</p><label>General notes<textarea name="notes" rows={5} maxLength={10000} defaultValue={generalNotes?.notes} /></label></>}
        {action.kind === "strikeDecision" && <>
          <h2 className={styles.modalTitle}>Review the circumstances</h2><p>{action.strike.reason}</p><p>Officer explanation: {action.strike.officer_response || "No explanation submitted yet."}<br />Response opportunity until {schoolDate(action.strike.response_due_at)}</p>
          <label>Decision<select name="status" defaultValue={action.strike.status === "confirmed" ? "revoked" : "dismissed"}>{action.strike.status === "confirmed" ? <option value="revoked">Revoke confirmed strike</option> : <><option value="dismissed">Dismiss concern</option><option value="confirmed" disabled={!action.strike.responded_at && new Date(action.strike.response_due_at).getTime()>Date.now()}>Confirm strike after individual review</option></>}</select></label>
          <label>Decision and review notes<textarea name="notes" required minLength={10} rows={4} maxLength={10000} /></label>
          <p>Consider academic conflicts, emergencies, communication, and recurring patterns. Confirmation is blocked until the officer responds or the response deadline passes.</p>
        </>}
        {action.kind === "removalReview" && <><h2 className={styles.modalTitle}>Academy Advisor review</h2><p>Review the documented strikes, the officer’s task-by-task PEET history, and efforts to improve before recording an outcome.</p><label>Advisor decision<select name="status"><option value="retained">Retain officer</option><option value="removal_approved">Approve removal following review</option></select></label><label>Advisor reasoning<textarea name="notes" required minLength={10} rows={5} maxLength={10000} /></label><p>This records advisor approval; it does not automatically remove an account or leadership listing.</p></>}
      </fieldset>{formButtons}</form>
    </Modal>}
  </div>;
}
