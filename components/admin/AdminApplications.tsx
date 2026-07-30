"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Application = {
  id: string;
  role: string;
  name: string;
  display_username: string | null;
  graduating_class_year: number | null;
  student_id_number: string | null;
  school_email: string;
  why_apply: string;
  why_fit: string;
  proof_of_work: string | null;
  status: string;
  booked_slot_id: string | null;
  created_at: string;
};

type InterviewSlot = {
  id: string;
  label: string;
  slot_time: string;
  application_id: string | null;
  is_booked: boolean;
};

type InterviewDraft = {
  bookingLink: string;
  email: {
    subject: string;
    body: string;
  };
};

const STATUSES = ["pending", "reviewing", "invited", "interview_booked", "approved", "rejected"];

export default function AdminApplications() {
  const [apps, setApps] = useState<Application[]>([]);
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, InterviewDraft>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    if (!hasSupabaseConfig()) {
      setApps([]);
      setSlots([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [{ data: appData }, { data: slotData }] = await Promise.all([
      supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false }),
      supabase
        .from("interview_slots")
        .select("id, label, slot_time, application_id, is_booked")
        .order("slot_time", { ascending: true }),
    ]);
    setApps((appData as Application[]) ?? []);
    setSlots((slotData as InterviewSlot[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: string) {
    if (!hasSupabaseConfig()) return;
    const supabase = createClient();
    await supabase.from("applications").update({ status }).eq("id", id);
    load();
  }

  async function generateInviteDraft(id: string) {
    if (!hasSupabaseConfig()) {
      setMessage("Interview drafts are disabled in demo mode.");
      return;
    }
    setBusyId(id);
    setMessage(null);
    const res = await fetch("/api/send-interview-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: id }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setMessage(data.error ?? "Something went wrong generating the draft.");
    } else {
      setDrafts((current) => ({
        ...current,
        [id]: data as InterviewDraft,
      }));
      setMessage("Interview draft generated. Copy the email below and send it manually.");
    }
    load();
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, 1500);
  }

  if (loading) return <p className="text-sm text-graphite/50">Loading applications...</p>;

  const slotById = new Map(slots.map((slot) => [slot.id, slot]));

  function formatSlotTime(slotTime: string) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(slotTime));
  }

  return (
    <div className="space-y-6">
      {message && (
        <p className="break-all rounded-sm bg-forest/[0.05] p-4 text-xs text-graphite/80 ring-1 ring-forest/10" role="alert">
          {message}
        </p>
      )}
      {apps.length === 0 && <p className="text-sm text-graphite/50">No applications yet.</p>}
      {apps.map((a) => (
        <div key={a.id} className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">{a.role}</p>
              <p className="mt-1 font-display text-lg text-forest">{a.name}</p>
              <p className="text-xs text-graphite/60">{a.school_email}</p>
            </div>
            <select
              aria-label={`Change status for ${a.name}`}
              value={a.status}
              onChange={(e) => updateStatus(a.id, e.target.value)}
              className="min-h-11 rounded-sm border border-forest/15 bg-paper px-3 py-2 font-mono text-xs uppercase tracking-[0.1em]"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-graphite/80 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">Why apply</p>
              <p>{a.why_apply}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">Why a good fit</p>
              <p>{a.why_fit}</p>
            </div>
            {a.proof_of_work && (
              <div className="sm:col-span-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                  Proof of work
                </p>
                <p>{a.proof_of_work}</p>
              </div>
            )}
            {a.student_id_number && (
              <div className="sm:col-span-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                  Student ID on file
                </p>
                <p>{a.student_id_number}</p>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-sm bg-paper/70 p-4 ring-1 ring-forest/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
              Interview booking
            </p>
            {a.booked_slot_id ? (
              (() => {
                const bookedSlot = slotById.get(a.booked_slot_id);
                return bookedSlot ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-medium text-graphite">
                      {a.name} booked {bookedSlot.label}
                    </p>
                    <p className="text-xs text-graphite/60">{formatSlotTime(bookedSlot.slot_time)}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-graphite/70">
                    {a.name} has booked an interview, but the slot record is missing.
                  </p>
                );
              })()
            ) : (
              <p className="mt-2 text-sm text-graphite/70">
                {a.name} has not booked an interview yet.
              </p>
            )}
          </div>

          <div className="mt-4">
            <button
              onClick={() => generateInviteDraft(a.id)}
              disabled={busyId === a.id}
              className="rounded-sm bg-forest px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
            >
              {busyId === a.id ? "Generating..." : "Generate Interview Draft"}
            </button>
          </div>

          {drafts[a.id] && (
            <div className="mt-4 space-y-3 rounded-sm border border-forest/10 bg-paper/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                  Copy this email
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyText(drafts[a.id].email.subject, `${a.id}-subject`)}
                    className="rounded-sm border border-forest/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-forest transition hover:bg-forest/5"
                  >
                    {copiedKey === `${a.id}-subject` ? "Copied subject" : "Copy subject"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        `Subject: ${drafts[a.id].email.subject}\n\n${drafts[a.id].email.body}`,
                        `${a.id}-email`
                      )
                    }
                    className="rounded-sm border border-forest/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-forest transition hover:bg-forest/5"
                  >
                    {copiedKey === `${a.id}-email` ? "Copied email" : "Copy email"}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(drafts[a.id].bookingLink, `${a.id}-link`)}
                    className="rounded-sm border border-forest/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-forest transition hover:bg-forest/5"
                  >
                    {copiedKey === `${a.id}-link` ? "Copied link" : "Copy link"}
                  </button>
                </div>
              </div>
              <div className="space-y-2 text-sm text-graphite/80">
                <p>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                    Subject
                  </span>
                  <br />
                  {drafts[a.id].email.subject}
                </p>
                <p>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                    Booking link
                  </span>
                  <br />
                  <a
                    href={drafts[a.id].bookingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-forest underline decoration-forest/30 underline-offset-2"
                  >
                    {drafts[a.id].bookingLink}
                  </a>
                </p>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                    Email body
                  </span>
                  <textarea
                    readOnly
                    value={drafts[a.id].email.body}
                    className="mt-1 min-h-56 w-full rounded-sm border border-forest/10 bg-paper p-3 font-sans text-sm leading-6 text-graphite outline-none"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
