"use client";

import { useEffect, useState } from "react";

type Target = { kind: "question"; board: string } | { kind: "answer"; questionId: string; parentAnswerId: string | null };

export default function ForumSafetyOverride({ text, target, onPublished, onBusyChange }: {
  text: string;
  target: Target;
  onPublished: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const targetKey = JSON.stringify(target);

  useEffect(() => {
    let active = true;
    fetch("/api/forum/override", { cache: "no-store" }).then(r => r.json()).then(data => {
      if (active) setEligible(data.eligible === true);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setConfirmed(false);
    setPassword("");
    setOpen(false);
    setError("");
  }, [text, targetKey]);

  async function publish() {
    if (busy || !confirmed || !password || reason.trim().length < 10) return;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      const response = await fetch("/api/forum/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, text, password, reason, confirmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Verification failed.");
      onPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify. Please try again.");
    } finally {
      setPassword("");
      setConfirmed(false);
      setBusy(false);
      onBusyChange(false);
    }
  }

  if (!eligible) return null;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-sm text-forest underline">Review admin override</button>;
  return (
    <fieldset disabled={busy} className="space-y-3 rounded-xl border border-gold p-4" onKeyDown={e => {
      if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
    }}>
      <legend className="px-2 font-semibold">Verify admin publication</legend>
      <p className="text-sm">Review this content before publishing. This exception applies only to this submission. Your name, reason, and the content will be recorded.</p>
      <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-forest/15 p-3 text-sm">{text}</div>
      <label className="block text-sm">Reason for the exception
        <textarea value={reason} onChange={e => setReason(e.target.value)} minLength={10} maxLength={500} className="mt-1 block w-full rounded border p-2" />
      </label>
      <label className="block text-sm">Re-enter your admin password
        <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full rounded border p-2" />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
        I reviewed this content and authorize publishing it despite the filter.
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-4">
        <button type="button" disabled={busy || !confirmed || !password || reason.trim().length < 10} onClick={publish} className="rounded bg-forest px-4 py-2 text-paper disabled:opacity-50">{busy ? "Verifying…" : "Verify and publish"}</button>
        <button type="button" onClick={() => { setOpen(false); setPassword(""); setConfirmed(false); }} className="text-sm underline">Cancel</button>
      </div>
    </fieldset>
  );
}
