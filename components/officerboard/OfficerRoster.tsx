"use client";

import WorkspaceActivity from "@/components/WorkspaceActivity";

import ActionError from "@/components/ActionError";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { peetError, taskOfficers, type OfficerProfile } from "@/lib/peet";
import { durationLabel, localDateInput, schoolDate, trackingSummary, eventParticipationLabel, type OfficerAttendance, type OfficerEvent, type TrackingData, type VolunteerLog } from "@/lib/officer-tracking";
import VolunteerServiceRoster from "./VolunteerServiceRoster";
import OfficerAttendanceCards from "./OfficerAttendanceCards";
import OfficerEventFields from "./OfficerEventFields";
import Modal from "./Modal";
import styles from "./officerboard.module.css";

type AttendanceDraft = {status: OfficerAttendance["status"]; notes: string};
type Action = {kind:"event"; event?: OfficerEvent} | {kind:"notes"; person: OfficerProfile; event: OfficerEvent} | {kind:"service"; person: OfficerProfile; event: OfficerEvent; log?: VolunteerLog} | {kind:"verify"; person: OfficerProfile; event: OfficerEvent; log: VolunteerLog};
const statuses = [["present","Present"],["late","Late"],["excused","Excused"],["unexcused","Unexcused"]] as const;
const keyFor = (eventId: string, officerId: string) => `${eventId}:${officerId}`;

export default function OfficerRoster({profiles,data,year,years,onYearChange,onOpenOfficer,onDirtyChange,rosterMode,initialEventId}: {
  initialEventId?: string;
  rosterMode?: "attendance" | "volunteer";
  profiles: OfficerProfile[]; data: TrackingData; year: string; years: string[]; onYearChange: (year: string)=>void; onOpenOfficer: (id: string)=>void; onDirtyChange: (dirty: boolean)=>void;
}) {
  const router = useRouter();
  const [localMode,setMode] = useState<"attendance"|"volunteer">("attendance");
  const mode = rosterMode ?? localMode;
  const [eventId,setEventId] = useState(initialEventId ?? "");
  useEffect(() => { if (initialEventId) setEventId(initialEventId); }, [initialEventId]);
  const [search,setSearch] = useState("");
  const [drafts,setDrafts] = useState<Record<string,AttendanceDraft>>({});
  const [action,setAction] = useState<Action|null>(null);
  const [saving,setSaving] = useState(false);
  const [refreshing,startTransition] = useTransition();
  const [error,setError] = useState<string|null>(null);
  const [notice,setNotice] = useState("");
  const [serviceDirty,setServiceDirty] = useState(false);
  const [bulkStatus,setBulkStatus] = useState<typeof statuses[number][0]>("present");
  const busy = saving || refreshing;
  const officers = taskOfficers(profiles);
  const shown = officers.filter(person=>`${person.name} ${person.email ?? ""} ${person.position ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const events = data.events.filter(event=>event.academic_year === year && (mode === "attendance" ? event.kind === "meeting" : event.kind !== "meeting"));
  const nearest = events.filter(event=>!event.cancelled).reduce<OfficerEvent|undefined>((best,event)=>!best || Math.abs(Date.parse(event.starts_at)-Date.now()) < Math.abs(Date.parse(best.starts_at)-Date.now()) ? event : best,undefined) ?? events[0];
  const event = events.find(event=>event.id === eventId) ?? nearest;
  const allEvents = mode === "volunteer" && eventId === "all";
  const attendance = (eventId: string,personId: string) => data.attendance.find(row=>row.event_id===eventId && row.officer_id===personId);
  const draftFor = (eventId: string,personId: string): AttendanceDraft => drafts[keyFor(eventId,personId)] ?? {status:attendance(eventId,personId)?.status ?? "unmarked",notes:attendance(eventId,personId)?.reviewer_notes ?? ""};
  const dirty = event ? officers.filter(person=>{const draft=drafts[keyFor(event.id,person.id)]; const saved=attendance(event.id,person.id); return draft && (draft.status !== (saved?.status ?? "unmarked") || draft.notes !== (saved?.reviewer_notes ?? ""));}) : [];
  const outstanding = Object.keys(drafts).filter(key=>{const [eventId,personId]=key.split(":");const row=attendance(eventId,personId);return drafts[key].status !== (row?.status ?? "unmarked") || drafts[key].notes !== (row?.reviewer_notes ?? "");}).length;
  const logFor = (eventId: string,personId: string) => data.volunteerLogs.find(log=>log.event_id===eventId && log.officer_id===personId);
  const logStatus = (log?: VolunteerLog) => !log ? "Not recorded" : log.status === "approved" ? "Verified" : log.status === "pending" ? "Awaiting verification" : "Returned for correction";
  const identity = (person: OfficerProfile) => `${person.name}${person.email ? ` (${person.email})` : ""}`;
  const iso = (value: FormDataEntryValue|null) => new Date(String(value)).toISOString();

  // Acknowledged server records replace the local draft; failed rows stay available to retry.
  useEffect(()=>{setDrafts(current=>Object.fromEntries(Object.entries(current).filter(([key,draft])=>{const [eventId,personId]=key.split(":");const row=data.attendance.find(row=>row.event_id===eventId&&row.officer_id===personId);return draft.status !== (row?.status ?? "unmarked") || draft.notes !== (row?.reviewer_notes ?? "");})));},[data.attendance]);
  useUnsavedChanges(outstanding > 0 || serviceDirty, "You have unsaved roster changes. Leave the roster and discard them?");
  useEffect(()=>{onDirtyChange(outstanding>0 || serviceDirty);return()=>onDirtyChange(false);},[outstanding,serviceDirty,onDirtyChange]);
  function open(next:Action) {setError(null);setNotice("");setAction(next);}
  function setStatus(personId:string,status:OfficerAttendance["status"]) {if(!event)return;setError(null);setNotice("");setDrafts(current=>({...current,[keyFor(event.id,personId)]:{...draftFor(event.id,personId),status}}));}
  function changeMode(next: typeof mode) {setMode(next);setEventId("");setError(null);setNotice("");}
  function markUnrecordedAttendance() {
    if (!event) return;
    setDrafts(current => ({...current, ...Object.fromEntries(shown.filter(person => draftFor(event.id, person.id).status === "unmarked").map(person => [keyFor(event.id, person.id), {...draftFor(event.id, person.id), status: bulkStatus}]))}));
  }
  function discardMeetingChanges() {
    if (!event) return;
    setDrafts(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${event.id}:`))));
  }
  async function saveAttendance() {
    if(!event || !dirty.length)return;
    setSaving(true);setError(null);setNotice("");
    let saved=0;const failed:string[]=[];
    const client=createClient();
    for(const person of dirty){const draft=draftFor(event.id,person.id);try{const result=await client.rpc("record_officer_attendance",{p_event_id:event.id,p_officer_id:person.id,p_status:draft.status,p_notes:draft.notes});if(result.error)failed.push(`${identity(person)}: ${peetError(result.error)}`);else saved++;}catch{failed.push(`${identity(person)}: Check your connection and retry.`);}}
    if(failed.length)setError(`${saved} of ${dirty.length} records saved. Unsaved choices are retained. ${failed.join(" ")}`);
    else setNotice(`Attendance saved for ${saved} ${saved===1?"officer":"officers"}.`);
    startTransition(()=>router.refresh());setSaving(false);
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!action)return;const fields=new FormData(event.currentTarget);
    if(action.kind === "notes") {setDrafts(current=>({...current,[keyFor(action.event.id,action.person.id)]:{...draftFor(action.event.id,action.person.id),notes:String(fields.get("notes")??"")}}));setAction(null);setNotice("Notes added. Save attendance to record your changes.");return;}
    setSaving(true);setError(null);
    try {
      let name:string;let args:Record<string,unknown>;
      if(action.kind === "event"){name="save_officer_event";args={p_public_volunteering:fields.get("kind")!=="meeting"&&fields.get("public_volunteering")==="on",p_public_description:fields.has("public_description")?fields.get("public_description"):null,p_public_signup_open:fields.has("public_description")?fields.get("public_signup_open")==="on":null,p_public_capacity:fields.get("public_capacity")?Number(fields.get("public_capacity")):null,p_title:fields.get("title"),p_kind:fields.get("kind"),p_year:fields.get("year"),p_starts_at:iso(fields.get("starts_at")),p_ends_at:iso(fields.get("ends_at")),p_location:fields.get("location"),p_mandatory:fields.get("mandatory")==="on",p_approved:fields.get("approved")==="on",p_cancelled:fields.get("cancelled")==="on",p_notes:fields.get("notes"),p_event_id:action.event?.id??null};}
      else if(action.kind === "service"){name="submit_officer_volunteer";args={p_event_id:action.event.id,p_officer_id:action.person.id,p_check_in:iso(fields.get("check_in")),p_check_out:iso(fields.get("check_out")),p_notes:fields.get("notes")};}
      else{name="review_officer_volunteer";args={p_log_id:action.log.id,p_status:fields.get("status"),p_notes:fields.get("notes")};}
      const result=await createClient().rpc(name,args);if(result.error){setError(peetError(result.error));return;}
      if(action.kind === "event") {if(typeof result.data === "string")setEventId(result.data);setMode(fields.get("kind")==="meeting"?"attendance":"volunteer");onYearChange(String(fields.get("year")));}
      setAction(null);setNotice(action.kind === "event"?"Event saved.":action.kind === "service"?"Service log submitted for verification.":"Volunteer review saved.");startTransition(()=>router.refresh());
    }catch{setError("Check the dates and your connection, then try again.");}finally{setSaving(false);}
  }

  return <section aria-labelledby="team-roster-heading" data-workspace-busy={busy ? "true" : undefined}>
    <WorkspaceActivity saving={saving} refreshing={refreshing} />
    <div className={styles.topicHeading}><div><h2 id="team-roster-heading">{rosterMode === "attendance" ? "Attendance" : rosterMode === "volunteer" ? "Volunteer service" : "Attendance & volunteer roster"}</h2><p>Track leadership participation here. Events can be leadership-only or open to public volunteers and leadership; public signups and attendance are managed in Administration → Public Volunteering.</p></div><button className={styles.primary} disabled={busy || serviceDirty} onClick={()=>open({kind:"event"})}>{mode === "attendance"?"Add meeting":"Add event"}</button></div>
    <div className={styles.rosterControls}>
      {!rosterMode && <nav className={styles.topicNavigation} aria-label="Roster topics"><button aria-current={mode === "attendance"?"page":undefined} disabled={busy || serviceDirty} onClick={()=>changeMode("attendance")}>Attendance</button><button aria-current={mode === "volunteer"?"page":undefined} disabled={busy || serviceDirty} onClick={()=>changeMode("volunteer")}>Volunteer</button></nav>}
      <label>Academic year<select aria-label="Roster academic year" disabled={busy || serviceDirty} value={year} onChange={e=>onYearChange(e.target.value)}>{years.map(year=><option key={year}>{year}</option>)}</select></label>
      <label>{mode === "attendance"?"Meeting":"Volunteer event"}<select aria-label={mode === "attendance"?"Roster meeting":"Roster volunteer event"} disabled={busy || serviceDirty || !events.length} value={allEvents?"all":event?.id??""} onChange={e=>{setEventId(e.target.value);setError(null);setNotice("");}}>{!events.length&&<option value="">No events recorded</option>}{mode === "volunteer"&&<option value="all">All events · year overview</option>}{events.map(event=><option value={event.id} key={event.id}>{event.title} · {schoolDate(event.starts_at,false)}{event.cancelled?" (cancelled)":""}</option>)}</select></label>
    </div>
    <div className={styles.rosterToolbar}><label className={styles.search}>Search roster<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, email, or position" /></label><span>{shown.length} of {officers.length} officers</span>{event&&!allEvents&&<button className={styles.secondary} disabled={busy || serviceDirty} onClick={()=>open({kind:"event",event})}>Edit {mode === "attendance"?"meeting":"event"}</button>}</div>
    <p role="status" className={styles.notice}>{notice || (refreshing?"Updating roster…":"")}</p>{error&&!action&&<ActionError message={error} className={styles.error} />}
    {outstanding>0&&<p className={styles.warning}>{outstanding} unsaved attendance {outstanding===1?"change":"changes"}. Changes stay here when you switch events or roster topics; save each event before leaving the roster. <button className={styles.link} disabled={busy} onClick={()=>setDrafts({})}>Discard all attendance changes</button></p>}
    {!events.length?<p className={styles.empty}>Add a {mode === "attendance"?"meeting":"volunteer event"} to start tracking the roster.</p>:<>
      {event&&!allEvents&&<p className={styles.rosterEvent}>{schoolDate(event.starts_at)} – {schoolDate(event.ends_at)} · {event.location||"No location specified"}{event.cancelled&&" · Cancelled"}{mode === "volunteer"&&` · ${event.gea_approved?"GEA-approved":"Not yet GEA-approved"}`}</p>}
      {event&&!allEvents&&<>
        <div className={styles.rosterSaveBar}>
          <p>Mark each officer, then save. Each unexcused absence automatically counts as a strike. Attendance does not award service hours.</p>
          <div className={styles.actions}>
            <label className={styles.bulkStatus}>Bulk status<select aria-label="Bulk attendance status" value={bulkStatus} disabled={busy || event.cancelled} onChange={e=>setBulkStatus(e.target.value as typeof bulkStatus)}>{statuses.map(([status,label])=><option value={status} key={status}>{label}</option>)}</select></label>
            <button type="button" className={styles.secondary} disabled={busy || event.cancelled || (bulkStatus !== "excused" && Date.parse(event.starts_at) > Date.now()) || !shown.some(person => draftFor(event.id, person.id).status === "unmarked")} onClick={markUnrecordedAttendance}>{`Mark unrecorded ${bulkStatus}`}</button>
            <span className={styles.desktopAttendanceActions}>
              <button type="button" className={styles.secondary} disabled={busy || !dirty.length} onClick={discardMeetingChanges}>Discard changes</button>
              <button type="button" className={styles.primary} disabled={busy || event.cancelled || !dirty.length} onClick={saveAttendance}>{saving ? "Saving…" : `Save attendance${dirty.length ? ` (${dirty.length})` : ""}`}</button>
            </span>
          </div>
          <span className={styles.mobileAttendanceHint}>Bulk marking only changes displayed, unrecorded officers.</span>
        </div>
        <OfficerAttendanceCards
          rows={shown.map(person => {
            const draft = draftFor(event.id, person.id);
            const record = attendance(event.id, person.id);
            return { person, status: draft.status, changed: draft.status !== (record?.status ?? "unmarked") || draft.notes !== (record?.reviewer_notes ?? ""), hasNotes: Boolean(draft.notes), hasAbsenceNotice: Boolean(record?.absence_notice) };
          })}
          busy={busy} cancelled={event.cancelled} hasUnsavedChanges={outstanding > 0 || serviceDirty}
          onStatusChange={setStatus} onOpenOfficer={onOpenOfficer}
          onNotes={person => open({kind: "notes", person, event})}
        />
        {(shown.length > 0 || dirty.length > 0) && <div className={styles.mobileAttendanceSave} aria-label={mode === "attendance" ? "Save meeting attendance" : "Save event attendance"}>
          <div><strong>{dirty.length ? `${dirty.length} unsaved ${dirty.length === 1 ? "change" : "changes"}` : "No unsaved changes"}</strong>
            <button type="button" className={styles.link} disabled={busy || !dirty.length} onClick={discardMeetingChanges}>Discard changes</button>
          </div>
          <button type="button" className={styles.primary} disabled={busy || event.cancelled || !dirty.length} onClick={saveAttendance}>{saving ? "Saving…" : "Save attendance"}</button>
        </div>}
        <div className={`${styles.tableScroll} ${styles.desktopAttendanceTable}`} role="region" tabIndex={0} aria-label="Attendance roster; scroll horizontally for all statuses"><table className={styles.rosterTable}><caption className="sr-only">Attendance for {event.title}; changes are saved with Save attendance</caption><thead><tr><th scope="col">Officer</th>{statuses.map(([status,label])=><th scope="col" key={status}>{label}</th>)}<th scope="col">Notes / reset</th></tr></thead><tbody>{shown.map(person=>{const draft=draftFor(event.id,person.id);const record=attendance(event.id,person.id);const changed=draft.status !== (record?.status??"unmarked") || draft.notes !== (record?.reviewer_notes??"");return <tr key={person.id} data-pending={changed||undefined}><th scope="row"><button className={styles.rosterPerson} disabled={busy||outstanding>0||serviceDirty} onClick={()=>onOpenOfficer(person.id)}>{person.name}</button><span>{person.email||person.position}</span>{draft.status==="unmarked"&&<small>Not recorded</small>}{record?.absence_notice&&<small>Absence notice received</small>}{changed&&<small>Unsaved changes</small>}</th>{statuses.map(([status,label])=><td key={status}><label className={styles.attendanceChoice}><input type="radio" name={`attendance-${event.id}-${person.id}`} aria-label={`${identity(person)} — ${label}`} checked={draft.status===status} disabled={busy||event.cancelled} onChange={()=>setStatus(person.id,status)} /><span aria-hidden="true">{label}</span></label></td>)}<td><div className={styles.actions}><button className={styles.secondary} disabled={busy||event.cancelled} onClick={()=>open({kind:"notes",person,event})}>{draft.notes||record?.absence_notice?"View / edit notes":"Notes"}<span className="sr-only"> for {identity(person)}</span></button><button className={styles.secondary} disabled={busy||event.cancelled||draft.status==="unmarked"} onClick={()=>setStatus(person.id,"unmarked")}>Clear<span className="sr-only"> attendance for {identity(person)}</span></button></div></td></tr>;})}</tbody></table></div>
      </>}
      {mode === "volunteer"&&event&&!allEvents&&<VolunteerServiceRoster key={event.id} event={event} people={shown} logs={data.volunteerLogs} signups={data.signups} locked={busy} onDirtyChange={setServiceDirty} onReview={(person,log)=>open({kind:"verify",person,event,log})} />}
      {mode === "volunteer"&&allEvents&&<div className={styles.tableScroll} role="region" tabIndex={0} aria-label="Volunteer year overview; scroll horizontally for all events"><table className={`${styles.rosterTable} ${styles.volunteerTable}`}>
        <caption className="sr-only">Volunteer participation and verified hours for {year}</caption>
        <thead><tr><th scope="col">Officer</th>{events.map(event=><th scope="col" key={event.id}>{event.title}<span>{schoolDate(event.starts_at,false)}{event.cancelled?" · Cancelled":!event.gea_approved?" · Not GEA-approved":""}</span></th>)}<th scope="col">Approved events / year</th><th scope="col">Verified time / year</th></tr></thead>
        <tbody>{shown.map(person=>{const summary=trackingSummary(data,person.id,year);return <tr key={person.id}>
          <th scope="row"><button className={styles.rosterPerson} disabled={busy||outstanding>0||serviceDirty} onClick={()=>onOpenOfficer(person.id)}>{person.name}</button><span>{person.email||person.position}</span></th>
          {events.map(event=>{const log=logFor(event.id,person.id);const signup=data.signups.find(row=>row.event_id===event.id&&row.officer_id===person.id);return <td key={event.id}>{event.cancelled?"Cancelled":log?<><span className={styles.serviceBadge} data-status={log.status}><span aria-hidden="true">{log.status==="approved"?"✓":log.status==="pending"?"◷":"↩"}</span><span>{log.status==="pending"?"Pending verification":logStatus(log)}</span></span><span className={styles.serviceTableDuration}>{durationLabel(log.minutes)}</span></>:eventParticipationLabel(signup)}</td>;})}
          <td>{summary.volunteerEvents}/2</td><td>{durationLabel(summary.volunteerMinutes)}</td>
        </tr>;})}</tbody>
      </table></div>}

      {mode === "volunteer"&&<p className={styles.rosterEvent}>Year totals include verified time at GEA-approved events that have not been cancelled. Requests and assignments alone do not count toward the two-event minimum.</p>}
      {!shown.length&&<p className={styles.empty}>No officers match your search.</p>}
    </>}
    {action&&<Modal title={action.kind==="event"?action.event?"Edit event":"Add event":`${action.kind==="notes"?"Attendance notes":action.kind==="service"?"Volunteer service":"Verify volunteer service"}: ${action.person.name}`} busy={busy} onClose={()=>setAction(null)}><form className={styles.form} onSubmit={submit}>{error&&<ActionError message={error} className={styles.error} />}<fieldset disabled={busy}>
      {action.kind==="event"?<OfficerEventFields event={action.event} kind={mode==="attendance"?"meeting":"volunteer"} year={year}/>:<><p>{identity(action.person)} · {action.event.title}</p>
        {action.kind==="notes"&&<>{attendance(action.event.id,action.person.id)?.absence_notice&&<p>Officer’s absence notice: {attendance(action.event.id,action.person.id)?.absence_notice}</p>}<label>Reviewer notes<textarea name="notes" maxLength={10000} rows={4} defaultValue={draftFor(action.event.id,action.person.id).notes}/></label></>}
        {action.kind==="service"&&<><p>Enter actual times in your device’s time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. A reviewer verifies this service.</p><label>Check-in<input name="check_in" type="datetime-local" required defaultValue={localDateInput(action.log?.check_in??action.event.starts_at)}/></label><label>Check-out<input name="check_out" type="datetime-local" required defaultValue={localDateInput(action.log?.check_out??action.event.ends_at)}/></label><label>Service notes<textarea name="notes" maxLength={10000} rows={3} defaultValue={action.log?.notes}/></label></>}
        {action.kind==="verify"&&<><p>{schoolDate(action.log.check_in)} → {schoolDate(action.log.check_out)} · {durationLabel(action.log.minutes)}</p><p>{action.log.notes||"No service notes"}</p><label>Verification decision<select name="status" aria-label="Verification decision" defaultValue="approved"><option value="approved">Approve service</option><option value="rejected">Return for correction</option></select></label><label>Review notes<textarea name="notes" maxLength={10000} rows={3} defaultValue={action.log.review_notes}/></label><p>Returning a log requires at least 10 characters explaining the correction. Only verified work at approved events counts toward the minimum.</p></>}
      </>}
    </fieldset><div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={busy} onClick={()=>setAction(null)}>Cancel</button><button className={styles.primary} disabled={busy}>{busy?"Saving…":action.kind==="notes"?"Apply notes":"Save"}</button></div></form></Modal>}
  </section>;
}
