"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import AdminLoading from "@/components/admin/AdminLoading";
import { getRoleLabel } from "@/lib/roles";
import { markAdminNotificationSeen } from "@/lib/admin-notifications";

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
  created_at: string;
};

type Slot = { id: string; label: string; slot_time: string; application_id: string | null };
type ApplicationSummary = { id: string; name: string };
type InterviewDraft = {
  bookingLink: string;
  email: { subject: string; body: string };
};

const STATUSES = ["pending", "reviewing", "invited", "interview_booked", "approved", "rejected"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

export default function AdminApplicationDetail({ applicationId }: { applicationId: string }) {
  const [application, setApplication] = useState<Application | null>(null);
  const [applicationSummaries, setApplicationSummaries] = useState<ApplicationSummary[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<InterviewDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    if (!hasSupabaseConfig()) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const [{ data: appData }, { data: allApps }, { data: slotData }] = await Promise.all([
      supabase.from("applications").select("*").eq("id", applicationId).maybeSingle(),
      supabase.from("applications").select("id, name").order("created_at", { ascending: false }),
      supabase.from("interview_slots").select("id, label, slot_time, application_id").eq("application_id", applicationId),
    ]);

    setApplication((appData as Application | null) ?? null);
    setApplicationSummaries((allApps as ApplicationSummary[]) ?? []);
    setSlots((slotData as Slot[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    markAdminNotificationSeen("applications", applicationId);
    load();
  }, [applicationId]);

  const position = application ? applicationSummaries.findIndex((item) => item.id === application.id) : -1;
  const previousApplication = position > 0 ? applicationSummaries[position - 1] : null;
  const nextApplication = position >= 0 && position < applicationSummaries.length - 1 ? applicationSummaries[position + 1] : null;
  const bookedSlot = useMemo(() => slots[0] ?? null, [slots]);

  async function updateStatus(status: string) {
    if (!application || !hasSupabaseConfig()) return;
    setSaving(true);
    const { error } = await createClient().from("applications").update({ status }).eq("id", application.id);
    setSaving(false);
    setMessage(error?.message ?? "Application status updated.");
    if (!error) setApplication({ ...application, status });
  }

  async function generateInviteDraft() {
    if (!application || !hasSupabaseConfig()) {
      setMessage("Interview drafts are disabled in demo mode.");
      return;
    }

    setDraftLoading(true);
    setMessage(null);
    const response = await fetch("/api/send-interview-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: application.id }),
    });
    const data = await response.json();
    setDraftLoading(false);

    if (!response.ok) {
      setMessage(data.error ?? "Could not generate the interview draft.");
      return;
    }

    setDraft(data as InterviewDraft);
    setMessage("Interview draft ready. Copy it and send it manually.");
  }

  async function copyText(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
  }

  if (loading) return <AdminLoading detail />;
  if (!application) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-graphite/60">This application could not be found.</p>
        <Link href="/admin-portal-x7k9/applications" className="font-mono text-xs uppercase tracking-[0.15em] text-forest underline">
          Back to applications
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-forest/10 pb-5">
          <Link href="/admin-portal-x7k9/applications" className="font-mono text-xs uppercase tracking-[0.15em] text-forest hover:text-forestdeep">
          ← Back to admin panel
        </Link>
        <div className="flex items-center gap-2">
          {previousApplication ? (
            <Link href={`/admin-portal-x7k9/applications/${previousApplication.id}`} className="max-w-48 rounded-sm border border-forest/15 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-forest hover:bg-forest/[0.04]">
              <span className="block text-[9px] text-graphite/45">Previous</span>
              <span className="block truncate">{previousApplication.name}</span>
            </Link>
          ) : null}
          {nextApplication ? (
            <Link href={`/admin-portal-x7k9/applications/${nextApplication.id}`} className="max-w-48 rounded-sm bg-forest px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-gold hover:bg-forestdeep">
              <span className="block text-[9px] text-gold/65">Next</span>
              <span className="block truncate">{nextApplication.name}</span>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <main className="space-y-6">
          <header>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Application review</p>
            <h1 className="mt-2 font-display text-3xl text-forest sm:text-4xl">{application.name}</h1>
            <p className="mt-3 text-sm text-graphite/60">Submitted {formatDate(application.created_at)}</p>
          </header>

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-sm bg-forest/[0.04] p-4"><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">Position</p><p className="mt-2 text-sm text-forest">{getRoleLabel(application.role)}</p></div>
            <div className="rounded-sm bg-forest/[0.04] p-4"><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">Class year</p><p className="mt-2 text-sm text-forest">{application.graduating_class_year ?? "Not provided"}</p></div>
            <div className="rounded-sm bg-forest/[0.04] p-4"><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">Email</p><p className="mt-2 break-all text-sm text-forest">{application.school_email}</p></div>
          </section>

          <section className="space-y-6 rounded-sm border border-forest/10 bg-paper p-5 sm:p-7">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">Why apply</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-graphite/80">{application.why_apply}</p></div>
            <div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">Why are you a good fit?</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-graphite/80">{application.why_fit}</p></div>
            {application.proof_of_work ? <div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">Proof of work</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-graphite/80">{application.proof_of_work}</p></div> : null}
          </section>
        </main>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <section className="rounded-sm bg-forest/[0.04] p-5 ring-1 ring-forest/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">Review actions</p>
            <p className="mt-4 text-sm text-graphite/70">Progress</p>
            <div className="mt-2 grid gap-2">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={saving || application.status === status}
                  onClick={() => updateStatus(status)}
                  className={`min-h-10 rounded-sm border px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.1em] transition ${
                    application.status === status
                      ? "border-forest bg-forest text-gold shadow-[0_0_0_2px_rgba(18,53,36,0.12)]"
                      : "border-forest/20 bg-paper text-forest hover:border-forest hover:bg-forest/[0.05]"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {label(status)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={generateInviteDraft}
              disabled={draftLoading}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-forest px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-gold transition hover:bg-forestdeep disabled:cursor-not-allowed disabled:opacity-60"
            >
              {draftLoading ? "Generating..." : "Generate Interview Link"}
            </button>
            {message ? <p className="mt-3 text-xs text-graphite/65">{message}</p> : null}
          </section>
          {draft ? (
            <section className="rounded-sm border border-forest/10 bg-paper p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">Interview draft</p>
                <button type="button" onClick={() => copyText(draft.bookingLink, "link")} className="font-mono text-[10px] uppercase tracking-[0.1em] text-forest underline underline-offset-4">
                  {copied === "link" ? "Copied" : "Copy link"}
                </button>
              </div>
              <a href={draft.bookingLink} target="_blank" rel="noreferrer" className="mt-3 block break-all text-xs text-forest underline decoration-gold underline-offset-2">
                {draft.bookingLink}
              </a>
              <button type="button" onClick={() => copyText(`Subject: ${draft.email.subject}\n\n${draft.email.body}`, "email")} className="mt-4 w-full rounded-sm border border-forest/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-forest hover:bg-forest/[0.04]">
                {copied === "email" ? "Copied email" : "Copy email"}
              </button>
              <p className="mt-4 text-xs font-medium text-graphite/70">{draft.email.subject}</p>
              <textarea readOnly value={draft.email.body} className="mt-2 min-h-40 w-full rounded-sm border border-forest/10 bg-forest/[0.02] p-3 text-xs leading-5 text-graphite/75 outline-none" aria-label="Interview email draft" />
            </section>
          ) : null}
          <section className="rounded-sm border border-forest/10 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">Profile</p>
            <div className="mt-3 space-y-2 text-sm text-graphite/75">
              <p>Username: {application.display_username ?? "None"}</p>
              <p>Student ID: {application.student_id_number ?? "None"}</p>
              <p>Interview: {bookedSlot?.label ?? "Not booked"}</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
