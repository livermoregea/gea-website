"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type TeacherInvite = {
  id: string;
  invite_token: string;
  teacher_name: string;
  teacher_email: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

export default function AdminTeacherInvites() {
  const [invites, setInvites] = useState<TeacherInvite[]>([]);
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [expiryDays, setExpiryDays] = useState("7");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const nameId = useId();
  const emailId = useId();
  const expiryId = useId();

  async function load() {
    setLoading(true);
    if (!hasSupabaseConfig()) {
      setInvites([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("teacher_invites")
      .select("*")
      .order("created_at", { ascending: false });
    setInvites((data as TeacherInvite[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const name = teacherName.trim();
    const email = teacherEmail.trim().toLowerCase();
    const days = Number.parseInt(expiryDays, 10);

    if (!name || !email || !Number.isFinite(days) || days <= 0) {
      setMessage("Please enter a teacher name, email, and valid expiry days.");
      return;
    }

    if (!hasSupabaseConfig()) return;

    setSaving(true);
    const supabase = createClient();
    const invite_token = crypto.randomUUID();
    const expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("teacher_invites")
      .upsert(
        {
          invite_token,
          teacher_name: name,
          teacher_email: email,
          expires_at,
          used_at: null,
          used_auth_user_id: null,
        },
        { onConflict: "teacher_email" }
      )
      .select("*")
      .maybeSingle();

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setTeacherName("");
    setTeacherEmail("");
    setExpiryDays("7");
    setMessage(`Invite link ready: ${window.location.origin}/teacher/signup/${data?.invite_token ?? invite_token}`);
    load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <form onSubmit={createInvite} className="space-y-4 rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Teacher Invites</p>
        <p className="text-sm text-graphite/60">
          Generate a private one-time signup link for a specific teacher. The link expires after the
          window you choose or after it is used.
        </p>
        <div>
          <label htmlFor={nameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
            Teacher Name
          </label>
          <input
            id={nameId}
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
            className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
            placeholder="Teacher full name"
          />
        </div>
        <div>
          <label htmlFor={emailId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
            Teacher Email
          </label>
          <input
            id={emailId}
            type="email"
            value={teacherEmail}
            onChange={(e) => setTeacherEmail(e.target.value)}
            className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
            placeholder="name@lvjusd.org"
          />
        </div>
        <div>
          <label htmlFor={expiryId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
            Expire After Days
          </label>
          <input
            id={expiryId}
            inputMode="numeric"
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
            placeholder="7"
          />
        </div>
        {message && <p className="text-sm text-graphite/70">{message}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
        >
          {saving ? "Generating..." : "Generate Invite Link"}
        </button>
      </form>

      <div className="space-y-3">
        {loading && <p className="text-sm text-graphite/50">Loading invites...</p>}
        {!loading && invites.length === 0 && <p className="text-sm text-graphite/50">No teacher invites yet.</p>}
        {invites.map((invite) => {
          const expired = new Date(invite.expires_at) <= new Date();
          const used = Boolean(invite.used_at);
          const status = used ? "used" : expired ? "expired" : "active";
          return (
            <div key={invite.id} className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg text-forest">{invite.teacher_name}</p>
                  <p className="text-sm text-graphite/60">{invite.teacher_email}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-gold">
                    {status}
                  </p>
                </div>
                <a
                  href={`/teacher/signup/${invite.invite_token}`}
                  className="rounded-sm border border-forest/15 px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-forest"
                >
                  Open Link
                </a>
              </div>
              <p className="mt-3 break-all text-xs text-graphite/60">
                /teacher/signup/{invite.invite_token}
              </p>
              <p className="mt-2 text-xs text-graphite/50">
                Expires {new Date(invite.expires_at).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
