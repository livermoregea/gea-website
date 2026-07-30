"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLES } from "@/lib/roles";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Member = { id: string; role: string; name: string; contact_email: string | null; bio: string | null };

export default function AdminLeadership() {
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState<string>(ROLES[1].slug);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const roleId = useId();
  const nameId = useId();
  const contactEmailId = useId();
  const bioId = useId();

  async function load() {
    setLoading(true);
    if (!hasSupabaseConfig()) {
      setMembers([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase.from("leadership_members").select("*");
    setMembers((data as Member[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function fillSeat(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!hasSupabaseConfig()) {
      setName("");
      setContactEmail("");
      setBio("");
      return;
    }
    const supabase = createClient();
    await supabase
      .from("leadership_members")
      .upsert(
        {
          role,
          name: name.trim(),
          contact_email: contactEmail.trim() || null,
          bio: bio.trim() || null,
        },
        { onConflict: "role" }
      );
    setName("");
    setContactEmail("");
    setBio("");
    load();
  }

  async function vacateSeat(id: string) {
    if (!hasSupabaseConfig()) return;
    const supabase = createClient();
    await supabase.from("leadership_members").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <form onSubmit={fillSeat} className="grid gap-3 rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5 sm:grid-cols-2">
        <div>
          <label htmlFor={roleId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">Role</label>
          <select
            id={roleId}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-2 block w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={nameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">Name</label>
          <input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 block w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={contactEmailId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">Contact Email</label>
          <input
            id={contactEmailId}
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="mt-2 block w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
            placeholder="name@lvjusd.org"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={bioId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">Bio (optional)</label>
          <input
            id={bioId}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-2 block w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep sm:col-span-2"
        >
          Fill / Update Seat
        </button>
      </form>

      <div className="mt-6 space-y-2">
        {loading && <p className="text-sm text-graphite/50">Loading...</p>}
        {members.map((m) => (
          <div key={m.id} className="flex flex-col gap-3 rounded-sm bg-forest/[0.03] px-4 py-3 text-sm ring-1 ring-forest/5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">{m.role}</p>
              <p className="font-medium text-graphite">{m.name}</p>
              {m.contact_email && <p className="text-xs text-graphite/60">{m.contact_email}</p>}
            </div>
            <button
              onClick={() => vacateSeat(m.id)}
              className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-red-700 hover:underline"
            >
              Vacate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
