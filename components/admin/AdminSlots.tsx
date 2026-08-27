"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Slot = {
  id: string;
  label: string;
  slot_time: string;
  is_booked: boolean;
};

export default function AdminSlots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [label, setLabel] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [loading, setLoading] = useState(true);
  const labelId = useId();
  const slotTimeId = useId();

  async function load() {
    setLoading(true);
    if (!hasSupabaseConfig()) {
      setSlots([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("interview_slots")
      .select("*")
      .order("slot_time", { ascending: true });
    setSlots((data as Slot[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !slotTime) return;
    if (!hasSupabaseConfig()) {
      setLabel("");
      setSlotTime("");
      return;
    }
    const supabase = createClient();
    await supabase.from("interview_slots").insert({
      label: label.trim(),
      slot_time: new Date(slotTime).toISOString(),
    });
    setLabel("");
    setSlotTime("");
    load();
  }

  async function removeSlot(id: string) {
    if (!hasSupabaseConfig()) return;
    const supabase = createClient();
    await supabase.from("interview_slots").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Interview Slots</p>
            <h3 className="mt-2 font-display text-2xl text-forest">Schedule queue</h3>
          </div>
          <p className="text-sm text-graphite/60">{slots.length} slot{slots.length === 1 ? "" : "s"}</p>
        </div>
        <form onSubmit={addSlot} className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_1fr_auto]">
          <div>
            <label htmlFor={labelId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">Label</label>
            <input
              id={labelId}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Tuesday Lunch — Nov 12"
              className="mt-2 block w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={slotTimeId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">Date & Time</label>
            <input
              id={slotTimeId}
              type="datetime-local"
              value={slotTime}
              onChange={(e) => setSlotTime(e.target.value)}
              className="mt-2 block w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
          >
            Add Slot
          </button>
        </form>
      </section>

      <div className="space-y-3">
        {loading && <p className="text-sm text-graphite/50">Loading slots...</p>}
        {!loading && slots.length === 0 && (
          <p className="text-sm text-graphite/50">No interview slots added yet.</p>
        )}
        {slots.map((s) => (
          <div key={s.id} className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-graphite">{s.label}</p>
                <p className="font-mono text-xs text-graphite/50">
                  {new Date(s.slot_time).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-sm px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${s.is_booked ? "bg-gold/10 text-forest" : "bg-forest/[0.05] text-forest"}`}>
                  {s.is_booked ? "Booked" : "Open"}
                </span>
                <button
                  onClick={() => removeSlot(s.id)}
                  className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-red-700 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
