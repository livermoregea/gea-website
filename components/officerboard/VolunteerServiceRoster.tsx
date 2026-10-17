"use client";

import WorkspaceActivity from "@/components/WorkspaceActivity";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { peetError, type OfficerProfile } from "@/lib/peet";
import { durationLabel, localDateInput, type OfficerEvent, type VolunteerLog, type EventSignup } from "@/lib/officer-tracking";
import Modal from "./Modal";
import EventParticipation from "./EventParticipation";
import styles from "./officerboard.module.css";

type Draft = { check_in: string; check_out: string; notes: string };
const fromLog = (log: VolunteerLog): Draft => ({ check_in: localDateInput(log.check_in), check_out: localDateInput(log.check_out), notes: log.notes });

export default function VolunteerServiceRoster({ event, people, logs, signups, locked, onDirtyChange, onReview }: {
  event: OfficerEvent; people: OfficerProfile[]; logs: VolunteerLog[]; signups: EventSignup[]; locked: boolean;
  onDirtyChange: (dirty: boolean) => void; onReview: (person: OfficerProfile, log: VolunteerLog) => void;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const busy = locked || saving || refreshing || event.cancelled;
  const logFor = (id: string) => logs.find(log => log.event_id === event.id && log.officer_id === id);
  const dirtyIds = Object.keys(drafts);
  const pending = people.map(person => logFor(person.id)).filter((log): log is VolunteerLog => Boolean(log?.status === "pending"));
  const selected = pending.filter(log => !excluded.includes(log.id));
  const activeIndex = people.findIndex(person => person.id === activeId);
  const activePerson = people[activeIndex];
  const activeLog = activePerson ? logFor(activePerson.id) : undefined;
  const activeValues = activePerson ? drafts[activePerson.id] ?? (activeLog ? fromLog(activeLog) : { check_in: localDateInput(event.starts_at), check_out: localDateInput(event.ends_at), notes: "" }) : undefined;
  const statusFor = (log?: VolunteerLog) => !log ? "Not recorded" : log.status === "approved" ? "Verified" : log.status === "pending" ? "Pending" : "Returned";
  useEffect(() => { onDirtyChange(dirtyIds.length > 0 || saving || refreshing); return () => onDirtyChange(false); }, [dirtyIds.length, saving, refreshing, onDirtyChange]);

  function edit(id: string, patch: Partial<Draft>) {
    const log = logFor(id);
    setDrafts(current => ({ ...current, [id]: { ...(current[id] ?? (log ? fromLog(log) : { check_in: localDateInput(event.starts_at), check_out: localDateInput(event.ends_at), notes: "" })), ...patch } }));
    setError(""); setNotice("");
  }
  async function saveLogs() {
    setSaving(true); setError(""); setNotice("");
    const failed: string[] = []; let saved = 0;
    for (const id of dirtyIds) {
      const draft = drafts[id];
      try {
        if (!draft.check_in || !draft.check_out || !Number.isFinite(Date.parse(draft.check_in)) || !Number.isFinite(Date.parse(draft.check_out))) throw new Error("Enter a valid check-in and check-out time.");
        const result = await createClient().rpc("submit_officer_volunteer", { p_event_id: event.id, p_officer_id: id, p_check_in: new Date(draft.check_in).toISOString(), p_check_out: new Date(draft.check_out).toISOString(), p_notes: draft.notes });
        if (result.error) throw new Error(peetError(result.error));
        saved++;
        setDrafts(current => { const next = { ...current }; delete next[id]; return next; });
      } catch (cause) { failed.push(`${people.find(person => person.id === id)?.name ?? "Officer"}: ${cause instanceof Error ? cause.message : "Check your connection and retry."}`); }
    }
    setNotice(`${saved} service logs saved for verification.`);
    if (failed.length) setError(`Unsaved details are retained. ${failed.join(" ")}`);
    startTransition(() => router.refresh()); setSaving(false);
  }
  async function verify() {
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await createClient().rpc("verify_officer_event_service", { p_event_id: event.id, p_logs: selected });
      if (result.error) { setError(peetError(result.error)); return; }
      setNotice(`Verified service for ${selected.length} officers.`);
      setExcluded([]); startTransition(() => router.refresh());
    } catch { setError("Check your connection and retry."); }
    finally { setSaving(false); }
  }
  return <section className={styles.serviceRoster} aria-label="Event service logs" data-workspace-busy={saving || refreshing ? "true" : undefined}>
    <WorkspaceActivity saving={saving} refreshing={refreshing} />
    <div className={styles.rosterSaveBar}>
      <div><h3>Service hours & verification</h3><p>Tap a row to edit details. Select pending logs to verify together.</p></div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} disabled={busy || !people.some(person => !logFor(person.id) && !drafts[person.id]) || Date.parse(event.ends_at) > Date.now()} onClick={() => people.filter(person => !logFor(person.id) && !drafts[person.id]).forEach(person => edit(person.id, {}))}>Fill missing service times</button>
        <button type="button" className={styles.primary} disabled={busy || !dirtyIds.length} onClick={saveLogs}>{saving ? "Saving…" : `Save service logs (${dirtyIds.length})`}</button>
        <button type="button" className={styles.secondary} disabled={busy || !dirtyIds.length} onClick={() => setDrafts({})}>Discard service edits</button>
        <button type="button" className={styles.primary} disabled={busy || !!dirtyIds.length || !selected.length} onClick={verify}>Verify all selected ({selected.length})</button>
      </div>
      <details className={styles.serviceBulkHelp}><summary>How bulk service works</summary><p>Fill missing times uses the event schedule as a draft for displayed officers without logs. Adjust actual times, save, then verify pending service. Existing logs keep their details. Attendance alone does not award hours.</p><p>Saving includes all drafts, including officers hidden by search. Verification applies to displayed, selected pending logs. Returned and verified logs are excluded.</p></details>
    </div>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
    {pending.length > 0 && <button type="button" className={styles.link} disabled={busy} onClick={() => setExcluded(selected.length === pending.length ? pending.map(log => log.id) : [])}>{selected.length === pending.length ? "Deselect pending logs" : "Select all pending logs"}</button>}
    <ul className={styles.serviceRows} aria-label="Volunteer service roster">{people.map(person => {
      const log = logFor(person.id), draft = drafts[person.id];
      const minutes = draft ? Math.floor((Date.parse(draft.check_out) - Date.parse(draft.check_in)) / 60000) : log?.minutes;
      const signup = signups.find(row => row.event_id === event.id && row.officer_id === person.id);
      return <li key={person.id} className={styles.serviceRow} data-pending={!!draft || undefined}>
        <label className={styles.serviceSelection}>
          <input type="checkbox" aria-label={`Include ${person.name} in verification`} checked={log?.status === "pending" && !excluded.includes(log.id)} disabled={busy || !!draft || log?.status !== "pending"} onChange={e => { if (log) setExcluded(current => e.target.checked ? current.filter(id => id !== log.id) : [...current, log.id]); }} />
        </label>
        <button type="button" className={styles.serviceRowButton} disabled={saving || refreshing || locked} aria-label={`Edit service details for ${person.name}`} aria-haspopup="dialog" onClick={() => setActiveId(person.id)}>
          <span className={styles.serviceRowIdentity}><strong>{person.name}</strong><span>{person.position || person.email || (signup?.assigned ? "Assigned" : signup?.committed ? "Requested" : "No assignment")}</span></span>
          <span className={styles.serviceRowStatus}><strong>{minutes !== undefined && Number.isFinite(minutes) && minutes > 0 ? durationLabel(minutes) : "—"}</strong><span>{draft ? "Unsaved" : statusFor(log)}</span></span>
          <span aria-hidden="true" className={styles.serviceChevron}>›</span>
        </button>
      </li>;
    })}</ul>
    {activePerson && activeValues && <Modal title={`Service details: ${activePerson.name}`} busy={saving || refreshing} onClose={() => setActiveId(null)}>
      <h2 className={styles.modalTitle} aria-live="polite">{activePerson.name}</h2>
      <p>{activePerson.email || activePerson.position}</p>
      <p>{event.title} · {statusFor(activeLog)}{drafts[activePerson.id] ? " · Unsaved edits" : ""}</p>
      <p className={styles.serviceEditorHint}>Edits stay in the roster until you save service logs. You can move to the next officer without losing your changes.</p>
      <div className={styles.form}>
        <fieldset disabled={busy || activeLog?.status === "approved"}>
          <p>Actual times in your device’s time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
          <label>Check-in for {activePerson.name}<input type="datetime-local" value={activeValues.check_in} onChange={e => edit(activePerson.id, { check_in: e.target.value })} /></label>
          <label>Check-out for {activePerson.name}<input type="datetime-local" value={activeValues.check_out} onChange={e => edit(activePerson.id, { check_out: e.target.value })} /></label>
          <label>Service notes for {activePerson.name}<textarea rows={3} maxLength={10000} value={activeValues.notes} onChange={e => edit(activePerson.id, { notes: e.target.value })} /></label>
        </fieldset>
        {activeLog?.review_notes && <p>Review notes: {activeLog.review_notes}</p>}
        <details className={styles.serviceParticipation}><summary>Participation & assignment</summary><EventParticipation event={event} officerId={activePerson.id} name={activePerson.name} signup={signups.find(row => row.event_id === event.id && row.officer_id === activePerson.id)} canManage disabled={busy || !!dirtyIds.length} /></details>
        {activeLog && <button type="button" className={styles.secondary} disabled={busy || !!dirtyIds.length} onClick={() => { setActiveId(null); onReview(activePerson, activeLog); }}>{activeLog.status === "approved" ? "Review / return for correction" : "Review individually"}</button>}
        <nav className={styles.serviceEditorNavigation} aria-label="Move between officers">
          <button type="button" className={styles.secondary} disabled={saving || refreshing || activeIndex <= 0} onClick={() => setActiveId(people[activeIndex - 1].id)}>Previous</button>
          <span aria-live="polite">{activeIndex + 1} of {people.length}</span>
          <button type="button" className={styles.secondary} disabled={saving || refreshing || activeIndex >= people.length - 1} onClick={() => setActiveId(people[activeIndex + 1].id)}>Next</button>
        </nav>
        <div className={styles.modalActions}><button type="button" className={styles.primary} disabled={saving || refreshing} onClick={() => { if (!activeLog && !drafts[activePerson.id] && !busy) edit(activePerson.id, {}); setActiveId(null); }}>{!activeLog && !drafts[activePerson.id] && !busy ? "Add service draft" : "Done"}</button></div>
      </div>
    </Modal>}
  </section>;
}
