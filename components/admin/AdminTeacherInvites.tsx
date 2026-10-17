"use client";

import controls from "@/components/workspace-controls.module.css";
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
    <div className="space-y-6">
      <section className="border-b border-forest/10 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="mt-2 text-xl font-semibold text-forest">Invite queue</h3>
          </div>
          <p className="text-sm text-graphite/80">{invites.length} invite{invites.length === 1 ? "" : "s"}</p>
        </div>
        <form onSubmit={createInvite} className="mt-5 grid gap-3 lg:grid-cols-[1.05fr_1.05fr_0.55fr_auto]">
          <div>
            <label htmlFor={nameId} className="text-sm font-medium text-graphite/80">
              Teacher Name
            </label>
            <input
              id={nameId}
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="mt-2 w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base"
              placeholder="Teacher full name"
            />
          </div>
          <div>
            <label htmlFor={emailId} className="text-sm font-medium text-graphite/80">
              Teacher Email
            </label>
            <input
              id={emailId}
              type="email"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              className="mt-2 w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base"
              placeholder="name@lvjusd.org" autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor={expiryId} className="text-sm font-medium text-graphite/80">
              Expire Days
            </label>
            <input
              id={expiryId}
              inputMode="numeric"
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className="mt-2 w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base"
              placeholder="7"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className={`${controls.control} rounded-[8px] bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forestdeep disabled:opacity-50`}
          >
            {saving ? "Generating..." : "Generate"}
          </button>
        </form>
        {message && <p className="mt-4 text-sm text-graphite/80" role="status">{message}</p>}
      </section>

      <div className="space-y-3">
        {loading && <p className="text-sm text-graphite/80" role="status">Loading invites...</p>}
        {!loading && invites.length === 0 && <p className="text-sm text-graphite/80" role="status">No teacher invites yet.</p>}
        {invites.map((invite) => {
          const expired = new Date(invite.expires_at) <= new Date();
          const used = Boolean(invite.used_at);
          const status = used ? "used" : expired ? "expired" : "active";
          return (
            <div key={invite.id} className="border-t border-forest/10 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-display text-lg text-forest">{invite.teacher_name}</p>
                  <p className="text-sm text-graphite/80">{invite.teacher_email}</p>
                  <p className="mt-1 text-sm font-medium text-accent">
                    {status}
                  </p>
                </div>
                <a
                  href={`/teacher/signup/${invite.invite_token}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-forest/15 px-3 py-2 text-sm font-medium text-forest"
                >
                  Open Link
                </a>
              </div>
              <p className="mt-3 break-all text-xs text-graphite/80">
                /teacher/signup/{invite.invite_token}
              </p>
              <p className="mt-2 text-xs text-graphite/80">
                Expires {new Date(invite.expires_at).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
