"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Slot = { id: string; label: string; slot_time: string; is_booked: boolean };

export default function InterviewBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [status, setStatus] = useState<"loading" | "invalid" | "ready" | "booked" | "error">(
    "loading"
  );
  const [role, setRole] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookedLabel, setBookedLabel] = useState<string | null>(null);
  const [booking, setBooking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!hasSupabaseConfig()) {
      setRole("Interview");
      setSlots([]);
      setStatus("invalid");
      return;
    }

    const supabase = createClient();
    const { data: appData, error: appError } = await supabase.rpc("get_application_by_token", {
      p_token: token,
    });

    if (appError || !appData || appData.length === 0) {
      setStatus("invalid");
      return;
    }

    const app = appData[0];
    setRole(app.role);

    if (app.status === "interview_booked" && app.booked_slot_id) {
      const { data: slot } = await supabase
        .from("interview_slots")
        .select("label, slot_time")
        .eq("id", app.booked_slot_id)
        .maybeSingle();
      setBookedLabel(slot ? `${slot.label} — ${new Date(slot.slot_time).toLocaleString()}` : "your booked time");
      setStatus("booked");
      return;
    }

    const { data: openSlots } = await supabase
      .from("interview_slots")
      .select("*")
      .eq("is_booked", false)
      .order("slot_time", { ascending: true });
    setSlots((openSlots as Slot[]) ?? []);
    setStatus("ready");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function book(slotId: string) {
    if (!hasSupabaseConfig()) {
      setError("Interview booking is unavailable in demo mode.");
      return;
    }

    setBooking(slotId);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("book_interview_slot", {
      p_token: token,
      p_slot_id: slotId,
    });
    setBooking(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setBookedLabel(data as string);
    setStatus("booked");
  }

  if (status === "loading") {
    return <div className="mx-auto max-w-xl px-4 py-16 text-sm text-graphite/50 sm:px-6 md:py-24">Loading...</div>;
  }

  if (status === "invalid") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 md:py-24">
        <p className="font-display text-lg text-forest sm:text-xl">This interview link isn&apos;t valid.</p>
        <p className="mt-3 text-sm text-graphite/70 sm:text-base">
          Double check the link from your email, or reach out to the GEA officer team.
        </p>
      </div>
    );
  }

  if (status === "booked") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 md:py-24">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Interview Confirmed</p>
        <h1 className="mt-4 font-display text-xl text-forest sm:text-2xl">You&apos;re booked.</h1>
        <p className="mt-3 text-sm text-graphite/70 sm:text-base">
          Your interview for {role} is scheduled for <strong>{bookedLabel}</strong> during lunch.
          See you then. Be sure to check your email every once in a while for any important
          updates, like last-minute scheduling changes.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Book Your Interview</p>
      <h1 className="mt-4 font-display text-xl text-forest sm:text-2xl">{role} Interview</h1>
      <p className="mt-3 text-sm text-graphite/70 sm:text-base">
        Pick an available lunch-period slot below. Once booked, it&apos;s reserved just for you.
      </p>

      <div className="dim-divider my-8" />

      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

      {slots.length === 0 && (
        <p className="text-sm text-graphite/50">
          No interview times are open right now — check back soon or contact an officer.
        </p>
      )}

      <div className="space-y-3">
        {slots.map((s) => (
          <button
            key={s.id}
            onClick={() => book(s.id)}
            disabled={booking === s.id}
            className="flex w-full flex-col items-start justify-between gap-2 rounded-sm bg-forest/[0.03] px-5 py-4 text-left ring-1 ring-forest/5 transition hover:bg-forest/[0.06] sm:flex-row sm:items-center disabled:opacity-50"
          >
            <span>
              <span className="block font-display text-base text-forest">{s.label}</span>
              <span className="block font-mono text-xs text-graphite/50">
                {new Date(s.slot_time).toLocaleString()}
              </span>
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-gold">
              {booking === s.id ? "Booking..." : "Book"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
