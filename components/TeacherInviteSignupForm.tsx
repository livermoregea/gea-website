"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default function TeacherInviteSignupForm({
  token,
  teacherName,
  teacherEmail,
}: {
  token: string;
  teacherName: string;
  teacherEmail: string;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hasSupabaseConfig()) {
      setError("Teacher signup is disabled until Supabase is configured.");
      return;
    }

    if (!password.trim()) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/teacher-invites/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "We couldn't finish creating your teacher account.");
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.authEmail,
      password,
    });
    setLoading(false);

    if (signInError) {
      setError("Your account was created, but we couldn't sign you in.");
      return;
    }

    router.push("/teacher");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5 sm:p-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Teacher Invite</p>
        <h2 className="mt-2 font-display text-xl text-forest">Create your account</h2>
        <p className="mt-2 text-sm text-graphite/70">
          This invite is for <span className="font-medium text-forest">{teacherName}</span> at{" "}
          <span className="font-medium text-forest">{teacherEmail}</span>.
        </p>
      </div>

      <div>
        <label className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70" htmlFor="teacher-password">
          Password
        </label>
        <input
          id="teacher-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
          placeholder="Create a password"
        />
      </div>

      <div>
        <label
          className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70"
          htmlFor="teacher-password-confirm"
        >
          Confirm Password
        </label>
        <input
          id="teacher-password-confirm"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
          placeholder="Confirm your password"
        />
      </div>

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-sm bg-forest px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Finish Signup"}
      </button>
    </form>
  );
}
