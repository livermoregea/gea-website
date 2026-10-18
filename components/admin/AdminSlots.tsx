"use client";

import controls from "@/components/workspace-controls.module.css";
import { useEffect, useId, useRef, useState } from "react";
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
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const locked = useRef(false);
  const labelId = useId();
  const slotTimeId = useId();

  async function load() {
    setLoading(true);
    if (!hasSupabaseConfig()) {
      setSlots([]);
      setLoading(false);
      return;
    }
    setLoadError("");
    try {
      const { data, error } = await createClient().from("interview_slots").select("*").order("slot_time", { ascending: true });
      if (error) throw error;
      setSlots((data as Slot[]) ?? []);
    } catch {
      setLoadError("Couldn’t load interview slots. Check your connection and retry.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
  }, []);

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    if (locked.current || !hasSupabaseConfig() || !label.trim() || !slotTime) return;
    const date = new Date(slotTime);
    if (!Number.isFinite(date.getTime())) { setMessage("Enter a valid interview date and time."); return; }
    locked.current = true; setSaving(true); setMessage("");
    try {
      const { error } = await createClient().from("interview_slots").insert({ label: label.trim(), slot_time: date.toISOString() });
      if (error) throw error;
      setMessage("Interview slot added."); setLabel(""); setSlotTime("");
      await load();
    } catch { setMessage("Couldn’t add the interview slot. Check the details and try again."); }
    finally { locked.current = false; setSaving(false); }
  }

  async function removeSlot(id: string) {
    if (locked.current || !hasSupabaseConfig()) return;
    if (!window.confirm("Delete this interview slot? It will no longer be available for booking. Any existing booking will be removed.")) return;
    locked.current = true; setSaving(true); setMessage("");
    try {
      const { error } = await createClient().from("interview_slots").delete().eq("id", id);
      if (error) throw error;
      setMessage("Interview slot deleted.");
      await load();
    } catch { setMessage("Couldn’t delete the interview slot. Refresh and try again."); }
    finally { locked.current = false; setSaving(false); }
  }

  return (
    <div className="space-y-6">
      {message && <p role="status" className="text-sm text-forest">{message}</p>}
      <section className="border-b border-forest/10 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="mt-2 text-xl font-semibold text-forest">Schedule queue</h3>
          </div>
          <p className="text-sm text-graphite/80">{slots.length} slot{slots.length === 1 ? "" : "s"}</p>
        </div>
        <form onSubmit={addSlot} className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_1fr_auto]">
          <div>
            <label htmlFor={labelId} className="text-sm font-medium text-graphite/80">Label</label>
            <input
              id={labelId}
              required disabled={saving} maxLength={200}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Tuesday Lunch — Nov 12"
              className="mt-2 block w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base"
            />
          </div>
          <div>
            <label htmlFor={slotTimeId} className="text-sm font-medium text-graphite/80">Date & Time (your local time)</label>
            <input
              id={slotTimeId}
              required disabled={saving}
              type="datetime-local"
              value={slotTime}
              onChange={(e) => setSlotTime(e.target.value)}
              className="mt-2 block w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !hasSupabaseConfig()}
            className={`${controls.control} rounded-[8px] bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forestdeep`}
          >
            {saving ? "Saving…" : "Add Slot"}
          </button>
        </form>
      </section>

      {loadError && <div role="alert"><p>{loadError}</p><button type="button" disabled={loading || saving} className={controls.control} onClick={() => void load()}>Retry loading slots</button></div>}
      <div className="space-y-3">
        {loading && <p className="text-sm text-graphite/80" role="status">Loading slots...</p>}
        {!loading && !loadError && slots.length === 0 && (
          <p className="text-sm text-graphite/80" role="status">No interview slots added yet.</p>
        )}
        {slots.map((s) => (
          <div key={s.id} className="border-t border-forest/10 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-graphite">{s.label}</p>
                <p className="text-sm text-graphite/80">
                  {new Date(s.slot_time).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-[8px] px-3 py-1 text-sm font-medium ${s.is_booked ? "bg-gold/10 text-forest" : "bg-forest/[0.05] text-forest"}`}>
                  {s.is_booked ? "Booked" : "Open"}
                </span>
                <button
                  disabled={saving}
                  aria-label={`Remove ${s.label}`}
                  onClick={() => removeSlot(s.id)}
                  className={`${controls.control} inline-flex min-h-11 items-center text-sm font-medium text-red-700 hover:underline`}
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
