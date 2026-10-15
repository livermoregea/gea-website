"use client";

import ActionError from "@/components/ActionError";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({
  redirectTo,
  disabled = false,
}: {
  redirectTo: string;
  disabled?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
    if (disabled) {
      setError("GEA One sign-in is disabled until Supabase is configured.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Incorrect email or password.");
      return;
    }
    router.push(redirectTo);
    router.refresh();
      } catch {
      setError("We couldn’t reach the sign-in service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor={emailId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/80">
          GEA One email
        </label>
        <input
          id={emailId}
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full rounded-sm border border-forest/65 bg-paper px-4 py-3 text-base outline-none focus:border-gold" autoComplete="username"
        />
      </div>
      <div>
        <label htmlFor={passwordId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/80">
          Password
        </label>
        <input
          id={passwordId}
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-sm border border-forest/65 bg-paper px-4 py-3 text-base outline-none focus:border-gold" autoComplete="current-password"
        />
      </div>
      {error && (
        <ActionError message={error} className="text-sm text-red-700" />
      )}
      <button
        type="submit"
        disabled={loading || disabled}
        className="w-full rounded-sm bg-forest px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-accent transition hover:bg-forestdeep disabled:opacity-50"
      >
        {disabled ? "Disabled in Demo Mode" : loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
