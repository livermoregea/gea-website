"use client";
import { dispatchDiscordNotifications } from '@/lib/discord-notifications';

import WorkspaceActivity from "@/components/WorkspaceActivity";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { peetError } from "@/lib/peet";
import { eventParticipationLabel, type EventSignup, type OfficerEvent } from "@/lib/officer-tracking";
import Modal from "./Modal";
import styles from "./officerboard.module.css";

export default function EventParticipation({ event, officerId, name, signup, canManage, isSelf = false, disabled = false }: {
  event: OfficerEvent; officerId: string; name: string; signup?: EventSignup; canManage: boolean; isSelf?: boolean; disabled?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [snapshot, setSnapshot] = useState<EventSignup | undefined>(undefined);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = saving || refreshing;
  const locked = busy || disabled || event.cancelled;
  useUnsavedChanges(dirty);

  function close() {
    if (dirty && !window.confirm("Discard unsaved participation details?")) return;
    setEditing(false); setDirty(false); setError("");
  }
  async function mutate(rpc: string, args: Record<string, unknown>, message: string) {
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await createClient().rpc(rpc, args);
      if (result.error) { setError(peetError(result.error)); return; }
      dispatchDiscordNotifications();
      setDirty(false); setEditing(false); setNotice(message);
      startTransition(() => router.refresh());
    } catch { setError("Check your connection and try again."); }
    finally { setSaving(false); }
  }
  function saveAssignment(assigned: boolean, role = signup?.participation_role ?? "", notes = signup?.participation_notes ?? "", version = signup?.version ?? 0, message?: string) {
    return mutate("save_officer_event_assignment", {
      p_event_id: event.id, p_officer_id: officerId, p_assigned: assigned,
      p_role: role, p_notes: notes, p_version: version,
    }, message ?? (assigned ? "Event assignment saved." : "Assignment removed. Participation requests are kept."));
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    await saveAssignment(Boolean(snapshot?.assigned), String(fields.get("role") ?? ""), String(fields.get("notes") ?? ""), snapshot?.version ?? 0, "Participation details saved.");
  }

  return <div data-workspace-busy={busy ? "true" : undefined}>
    <WorkspaceActivity saving={saving} refreshing={refreshing} />
    <p><strong>{eventParticipationLabel(signup)}</strong></p>
    {signup?.participation_role && <p>Role: {signup.participation_role}</p>}
    {signup?.participation_notes && <p className="whitespace-pre-wrap">{signup.participation_notes}</p>}
    <div className={styles.actions}>
      {isSelf && <button type="button" className={styles.secondary} disabled={locked} onClick={() => void mutate("set_officer_event_signup", { p_event_id: event.id, p_committed: !signup?.committed }, signup?.committed ? "Participation request withdrawn. Reviewer assignments are kept." : "Participation requested.")}>{signup?.committed ? "Withdraw request" : "Request to participate"}<span className="sr-only"> in {event.title}</span></button>}
      {canManage && <>
        <button type="button" className={styles.secondary} disabled={locked} onClick={() => void saveAssignment(!signup?.assigned)}>{signup?.assigned ? "Unassign" : "Assign"}<span className="sr-only"> {name} {signup?.assigned ? "from" : "to"} {event.title}</span></button>
        <button type="button" className={styles.secondary} disabled={locked} onClick={() => { setSnapshot(signup); setEditing(true); setError(""); setNotice(""); }}>Edit details<span className="sr-only"> for {name} at {event.title}</span></button>
      </>}
    </div>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {error && !editing && <p role="alert" className={styles.error}>{error}</p>}
    {editing && <Modal title={`Participation details: ${name}`} busy={busy} onClose={close}>
      <h2 className={styles.modalTitle}>Participation details</h2>
      <p>{name} · {event.title}</p>
      <form className={styles.form} onSubmit={submit} onChange={() => setDirty(true)}>
        <fieldset disabled={locked}>
          <label>Role / responsibility<input name="role" maxLength={200} defaultValue={snapshot?.participation_role ?? ""} /></label>
          <label>Participation notes<textarea name="notes" maxLength={5000} rows={4} defaultValue={snapshot?.participation_notes ?? ""} /></label>
          <p>These details are visible to this officer and reviewers.</p>
        </fieldset>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={busy} onClick={close}>Cancel</button><button className={styles.primary} disabled={locked}>{busy ? "Saving…" : "Save details"}</button></div>
      </form>
    </Modal>}
  </div>;
}
