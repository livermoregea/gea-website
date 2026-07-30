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
  created_at: string;
};

const STATUSES = ["pending", "reviewing", "invited", "interview_booked", "approved", "rejected"];

export default function AdminApplications() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    if (!hasSupabaseConfig()) {
      setApps([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });
    setApps((data as Application[]) ?? []);
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

  async function sendInvite(id: string) {
    if (!hasSupabaseConfig()) {
      setMessage("Interview invites are disabled in demo mode.");
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
      setMessage(data.error ?? "Something went wrong sending the invite.");
    } else {
      setMessage(`Interview invite sent. Booking link: ${data.bookingLink}`);
    }
    load();
  }

  if (loading) return <p className="text-sm text-graphite/50">Loading applications...</p>;

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

          <div className="mt-4">
              <button
                onClick={() => sendInvite(a.id)}
                disabled={busyId === a.id}
              className="rounded-sm bg-forest px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
              >
                {busyId === a.id ? "Sending..." : "Send Interview Invite"}
              </button>
          </div>
        </div>
      ))}
    </div>
  );
}
