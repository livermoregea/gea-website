"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRoleLabel, ROLES } from "@/lib/roles";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { isAdminNotificationSeen, markAdminNotificationSeen } from "@/lib/admin-notifications";

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
  interview_token: string | null;
  invite_sent_at: string | null;
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

type ApplicationStatus = "pending" | "reviewing" | "invited" | "interview_booked" | "approved" | "rejected";
type RoleFilter = "all" | (typeof ROLES)[number]["slug"];
type StatusFilter = "all" | ApplicationStatus;
type SortMode = "newest" | "oldest";

const STATUSES: ApplicationStatus[] = [
  "pending",
  "reviewing",
  "invited",
  "interview_booked",
  "approved",
  "rejected",
];
const CSV_HEADERS = [
  "id",
  "role",
  "name",
  "display_username",
  "graduating_class_year",
  "student_id_number",
  "school_email",
  "status",
  "why_apply",
  "why_fit",
  "proof_of_work",
  "booked_slot_label",
  "booked_slot_time",
  "created_at",
  "invite_sent_at",
  "interview_token",
] as const;
const APPLICATIONS_PAGE_SIZE = 20;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatRelativeDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusLabel(status: ApplicationStatus) {
  return status.replaceAll("_", " ");
}

export default function AdminApplications() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, InterviewDraft>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [page, setPage] = useState(1);
  const [quickActionId, setQuickActionId] = useState<string | null>(null);

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

  function escapeCsvValue(value: string | number | null | undefined) {
    const stringValue = value == null ? "" : String(value);
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  function buildApplicationsCsv() {
    const rows = apps.map((app) => {
      const bookedSlot = app.booked_slot_id ? slotById.get(app.booked_slot_id) : null;
      return [
        app.id,
        app.role,
        app.name,
        app.display_username,
        app.graduating_class_year,
        app.student_id_number,
        app.school_email,
        app.status,
        app.why_apply,
        app.why_fit,
        app.proof_of_work,
        bookedSlot?.label ?? "",
        bookedSlot?.slot_time ?? "",
        app.created_at,
        app.invite_sent_at,
        app.interview_token,
      ];
    });

    return [
      CSV_HEADERS.map(escapeCsvValue).join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");
  }

  function downloadApplicationsCsv() {
    const csv = buildApplicationsCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Intl.DateTimeFormat("en-CA").format(new Date());

    link.href = url;
    link.download = `applications-export-${dateStamp}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const stats = useMemo(() => {
    const counts = {
      total: apps.length,
      pending: 0,
      reviewing: 0,
      invited: 0,
      interview_booked: 0,
      approved: 0,
      rejected: 0,
    };

    for (const app of apps) {
      counts[app.status as ApplicationStatus] += 1;
    }

    return counts;
  }, [apps]);

  const visibleApps = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = apps.filter((app) => {
      if (roleFilter !== "all" && app.role !== roleFilter) return false;
      if (statusFilter !== "all" && app.status !== statusFilter) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        app.role,
        app.name,
        app.display_username ?? "",
        app.school_email,
        app.student_id_number ?? "",
        app.why_apply,
        app.why_fit,
        app.proof_of_work ?? "",
        app.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return filtered.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return sortMode === "newest" ? bTime - aTime : aTime - bTime;
    });
  }, [apps, roleFilter, searchQuery, sortMode, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleApps.length / APPLICATIONS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * APPLICATIONS_PAGE_SIZE;
  const pagedApps = visibleApps.slice(startIndex, startIndex + APPLICATIONS_PAGE_SIZE);
  const showingStart = visibleApps.length === 0 ? 0 : startIndex + 1;
  const showingEnd = Math.min(startIndex + APPLICATIONS_PAGE_SIZE, visibleApps.length);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, searchQuery, sortMode, statusFilter]);

  function formatSlotTime(slotTime: string) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(slotTime));
  }

  if (loading) return <p className="text-sm text-graphite/50">Loading applications...</p>;

  return (
    <div className="space-y-8">
      <section className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Applications</p>
            <h3 className="mt-2 font-display text-2xl text-forest">Application queue</h3>
            <p className="mt-3 text-sm leading-relaxed text-graphite/70">
              Applications are shown in a compact list. Open a row for details.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadApplicationsCsv}
              disabled={apps.length === 0}
              className="rounded-sm bg-forest px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">Total</p>
            <p className="mt-2 text-2xl font-semibold text-forest">{stats.total}</p>
          </div>
          <div className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">Pending</p>
            <p className="mt-2 text-2xl font-semibold text-forest">{stats.pending}</p>
          </div>
          <div className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">Interview booked</p>
            <p className="mt-2 text-2xl font-semibold text-forest">{stats.interview_booked}</p>
          </div>
          <div className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">Approved</p>
            <p className="mt-2 text-2xl font-semibold text-forest">{stats.approved}</p>
          </div>
        </div>
      </section>

      <section className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex-1">
            <label htmlFor="applications-search" className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/50">
              Search
            </label>
            <input
              id="applications-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, role, email, or answer text"
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm text-graphite outline-none placeholder:text-graphite/40 focus:border-gold"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSortMode("newest")}
              className={`rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] transition ${
                sortMode === "newest" ? "bg-forest text-gold" : "bg-paper text-forest hover:bg-forest/[0.03]"
              }`}
            >
              Newest
            </button>
            <button
              type="button"
              onClick={() => setSortMode("oldest")}
              className={`rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] transition ${
                sortMode === "oldest" ? "bg-forest text-gold" : "bg-paper text-forest hover:bg-forest/[0.03]"
              }`}
            >
              Oldest
            </button>
          </div>
        </div>
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/50">
            Position
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRoleFilter("all")}
              className={`rounded-sm border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition ${
                roleFilter === "all"
                  ? "border-gold/40 bg-gold/10 text-forest"
                  : "border-forest/10 bg-paper text-forest hover:bg-forest/[0.03]"
              }`}
            >
              All Positions
            </button>
            {ROLES.map((role) => (
              <button
                key={role.slug}
                type="button"
                onClick={() => setRoleFilter(role.slug)}
                className={`rounded-sm border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition ${
                  roleFilter === role.slug
                    ? "border-gold/40 bg-gold/10 text-forest"
                    : "border-forest/10 bg-paper text-forest hover:bg-forest/[0.03]"
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/50">
            Status
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["all", ...STATUSES] as StatusFilter[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-sm border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition ${
                  statusFilter === status
                    ? "border-gold/40 bg-gold/10 text-forest"
                    : "border-forest/10 bg-paper text-forest hover:bg-forest/[0.03]"
                }`}
              >
                {status === "all" ? "All" : getStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {message && (
        <p className="break-all rounded-sm bg-forest/[0.05] p-4 text-xs text-graphite/80 ring-1 ring-forest/10" role="alert">
          {message}
        </p>
      )}
      <div className="space-y-4">
        {visibleApps.length > 0 && (
          <div className="flex flex-col gap-3 rounded-sm bg-paper px-4 py-3 ring-1 ring-forest/10 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/50">
              Showing {showingStart}-{showingEnd} of {visibleApps.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
                className="rounded-sm border border-forest/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-forest transition hover:bg-forest/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/50">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-sm border border-forest/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-forest transition hover:bg-forest/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {visibleApps.length === 0 ? (
            <p className="text-sm text-graphite/50">No applications match the current filters.</p>
          ) : (
            pagedApps.map((a) => {
              const bookedSlot = a.booked_slot_id ? slotById.get(a.booked_slot_id) : null;
              const bookedSlotTime = bookedSlot?.slot_time;

              return (
                <article key={a.id} className="relative rounded-sm bg-paper ring-1 ring-forest/10">
                  <button
                    type="button"
                    onClick={() => {
                      markAdminNotificationSeen("applications", a.id);
                      router.push(`/admin-portal-x7k9/applications/${a.id}`);
                    }}
                    className="block w-full px-5 py-4 text-left transition hover:bg-forest/[0.02]"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          {!isAdminNotificationSeen("applications", a.id) && (
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-600" title="New application" aria-label="New application" />
                          )}
                          <p className="font-display text-lg text-forest">{a.name}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-graphite/60">
                          <span>Class of {a.graduating_class_year ?? "?"}</span>
                          <span>Position: {getRoleLabel(a.role)}</span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                      View application
                    </p>
                  </button>

                  <div className="relative flex justify-end border-t border-forest/10 px-5 py-2">
                    <button
                      type="button"
                      onClick={() => setQuickActionId((current) => (current === a.id ? null : a.id))}
                      className="inline-flex min-h-9 items-center gap-2 rounded-sm px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-forest transition hover:bg-forest/[0.05]"
                      aria-expanded={quickActionId === a.id}
                      aria-haspopup="menu"
                    >
                      Quick actions
                      <span aria-hidden="true">⌄</span>
                    </button>
                    {quickActionId === a.id && (
                      <div className="absolute right-5 top-full z-10 mt-1 w-52 rounded-sm border border-forest/10 bg-paper p-2 shadow-lg shadow-forest/10" role="menu">
                        <p className="px-3 py-2 font-mono text-[9px] uppercase tracking-[0.15em] text-graphite/40">Change status</p>
                        {STATUSES.map((status) => (
                          <button
                            key={status}
                            type="button"
                            role="menuitem"
                            disabled={a.status === status}
                            onClick={() => {
                              updateStatus(a.id, status);
                              setQuickActionId(null);
                            }}
                            className="block min-h-9 w-full rounded-sm px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.1em] text-forest transition hover:bg-forest/[0.05] disabled:cursor-not-allowed disabled:text-graphite/35"
                          >
                            {getStatusLabel(status)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {false && (
                    <div className="border-t border-forest/10 px-5 py-5">
                      <div className="grid gap-4 lg:grid-cols-3">
                        <section className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/10">
                          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">
                            Profile snapshot
                          </p>
                          <div className="mt-3 space-y-2 text-sm text-graphite/75">
                            <p>Display name: {a.display_username ?? "None"}</p>
                            <p>Class year: {a.graduating_class_year ?? "None"}</p>
                            <p>Student ID: {a.student_id_number ?? "None"}</p>
                            <p>School email: {a.school_email}</p>
                          </div>
                        </section>

                        <section className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/10 lg:col-span-2">
                          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">
                            Application details
                          </p>
                          <div className="mt-3 grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                                Why apply
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-graphite/75">
                                {a.why_apply}
                              </p>
                            </div>
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                                Why fit
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-graphite/75">
                                {a.why_fit}
                              </p>
                            </div>
                            {a.proof_of_work && (
                              <div className="sm:col-span-2">
                                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                                  Proof of work
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-graphite/75">
                                  {a.proof_of_work}
                                </p>
                              </div>
                            )}
                          </div>
                        </section>

                        <section className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/10">
                          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">
                            Interview
                          </p>
                          <div className="mt-3 space-y-3 text-sm text-graphite/75">
                            {bookedSlot ? (
                              <div className="space-y-1">
                                <p className="font-medium text-graphite">{bookedSlot?.label}</p>
                                <p className="text-xs text-graphite/60">{formatSlotTime(bookedSlotTime ?? "")}</p>
                              </div>
                            ) : (
                              <p>No interview booked yet.</p>
                            )}
                            <select
                              aria-label={`Change status for ${a.name}`}
                              value={a.status}
                              onChange={(e) => updateStatus(a.id, e.target.value)}
                              className="min-h-11 w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 font-mono text-xs uppercase tracking-[0.1em]"
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {getStatusLabel(s)}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => generateInviteDraft(a.id)}
                              disabled={busyId === a.id}
                              className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-forest px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
                            >
                              {busyId === a.id ? "Generating..." : "Generate Interview Draft"}
                            </button>
                          </div>
                        </section>
                      </div>

                      {drafts[a.id] && (
                        <div className="mt-5 rounded-sm border border-forest/10 bg-paper/70 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                              Draft ready
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
                          <div className="mt-4 space-y-3 text-sm text-graphite/80">
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
                                className="mt-1 min-h-48 w-full rounded-sm border border-forest/10 bg-paper p-3 font-sans text-sm leading-6 text-graphite outline-none"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
