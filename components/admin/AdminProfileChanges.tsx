"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type ProfileChangeRequest = {
  id: string;
  profile_type: "student" | "teacher";
  profile_id: string;
  requested_by_name: string;
  current_fields: Record<string, unknown>;
  requested_fields: Record<string, unknown>;
  status: string;
  rejection_reason: string | null;
  created_at: string;
};

function toText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value);
}

function fieldLabel(key: string) {
  switch (key) {
    case "full_name":
      return "Full Name";
    case "display_username":
      return "Display Username";
    case "graduating_class_year":
      return "Graduating Class Year";
    case "school_email":
      return "School Email";
    default:
      return key;
  }
}

export default function AdminProfileChanges() {
  const [requests, setRequests] = useState<ProfileChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    if (!hasSupabaseConfig()) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data } = await supabase
      .from("profile_change_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    setRequests((data as ProfileChangeRequest[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approveRequest(request: ProfileChangeRequest) {
    if (!hasSupabaseConfig()) return;

    const supabase = createClient();
    const fields = request.requested_fields;

    const updatePayload =
      request.profile_type === "student"
        ? {
            full_name: toText(fields.full_name),
            display_username: toText(fields.display_username),
            graduating_class_year: Number.parseInt(String(fields.graduating_class_year), 10),
            school_email: toText(fields.school_email),
          }
        : {
            full_name: toText(fields.full_name),
            school_email: toText(fields.school_email),
          };

    const table = request.profile_type === "student" ? "student_profiles" : "teacher_profiles";
    const { error: profileError } = await supabase.from(table).update(updatePayload).eq("id", request.profile_id);
    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    const { error: requestError } = await supabase
      .from("profile_change_requests")
      .update({ status: "approved", rejection_reason: null })
      .eq("id", request.id);

    if (requestError) {
      setMessage(requestError.message);
      return;
    }

    setMessage("Profile change approved and applied.");
    load();
  }

  async function rejectRequest(request: ProfileChangeRequest) {
    if (!hasSupabaseConfig()) return;

    const reason = rejectionReasons[request.id]?.trim();
    if (!reason) {
      setMessage("Please add a rejection reason before rejecting a profile change.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("profile_change_requests")
      .update({ status: "rejected", rejection_reason: reason })
      .eq("id", request.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRejectionReasons((current) => ({ ...current, [request.id]: "" }));
    setMessage("Profile change rejected.");
    load();
  }

  if (loading) return <p className="text-sm text-graphite/50">Loading profile change requests...</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Profile Changes</p>
            <h3 className="mt-2 font-display text-2xl text-forest">Pending changes</h3>
          </div>
          <p className="text-sm text-graphite/60">{requests.length} pending request{requests.length === 1 ? "" : "s"}</p>
        </div>
      </section>

      <div className="space-y-4">
      {message && (
        <p className="rounded-sm bg-forest/[0.05] p-4 text-sm text-graphite/80 ring-1 ring-forest/10">
          {message}
        </p>
      )}
      {requests.length === 0 && <p className="text-sm text-graphite/50">No pending profile changes.</p>}
        {requests.map((request) => (
          <div key={request.id} className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">
                  {request.profile_type} profile
                </p>
                <p className="mt-1 font-display text-lg text-forest">{request.requested_by_name}</p>
                <p className="text-xs text-graphite/60">Requested {new Date(request.created_at).toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-sm bg-paper/80 p-4 ring-1 ring-forest/10">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">Current</p>
                <div className="mt-2 space-y-1 text-sm text-graphite/80">
                  {Object.entries(request.current_fields).map(([key, value]) => (
                    <p key={key}>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-graphite/45">
                        {fieldLabel(key)}:
                      </span>{" "}
                      {toText(value)}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-sm bg-paper/80 p-4 ring-1 ring-forest/10">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">Requested</p>
                <div className="mt-2 space-y-1 text-sm text-graphite/80">
                  {Object.entries(request.requested_fields).map(([key, value]) => (
                    <p key={key}>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-graphite/45">
                        {fieldLabel(key)}:
                      </span>{" "}
                      {toText(value)}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {request.rejection_reason ? (
              <p className="mt-3 rounded-sm bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
                Rejection reason: {request.rejection_reason}
              </p>
            ) : null}

            <textarea
              value={rejectionReasons[request.id] ?? ""}
              onChange={(e) =>
                setRejectionReasons((current) => ({ ...current, [request.id]: e.target.value }))
              }
              rows={2}
              placeholder="Reason for rejection (required if you reject this request)"
              className="mt-4 w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
            />

            <div className="mt-3 flex gap-3">
              <button
                onClick={() => approveRequest(request)}
                className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-forest hover:underline"
              >
                Approve
              </button>
              <button
                onClick={() => rejectRequest(request)}
                className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-red-700 hover:underline"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
