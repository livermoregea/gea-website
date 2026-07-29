"use client";

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
    if (disabled) {
      setError("Login is disabled until Supabase is configured.");
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
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor={emailId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
          Email
        </label>
        <input
          id={emailId}
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
        />
      </div>
      <div>
        <label htmlFor={passwordId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
          Password
        </label>
        <input
          id={passwordId}
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
        />
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading || disabled}
        className="w-full rounded-sm bg-forest px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
      >
        {disabled ? "Disabled in Demo Mode" : loading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
