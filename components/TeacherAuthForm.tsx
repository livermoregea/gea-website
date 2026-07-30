"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Mode = "signin" | "signup";

export default function TeacherAuthForm({
  redirectTo,
  mode: initialMode,
}: {
  redirectTo: string;
  mode: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const loginEmailId = useId();
  const loginPasswordId = useId();
  const signupNameId = useId();
  const signupEmailId = useId();
  const signupCodeId = useId();
  const signupPasswordId = useId();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);

    if (!hasSupabaseConfig()) {
      setLoginError("Teacher sign-in is disabled until Supabase is configured.");
      return;
    }

    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();
    if (!email || !password) return;

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setLoginError("That email or password didn't match.");
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);

    if (!hasSupabaseConfig()) {
      setSignupError("Teacher signup is disabled until Supabase is configured.");
      return;
    }

    const fullName = signupName.trim();
    const schoolEmail = signupEmail.trim().toLowerCase();
    const code = signupCode.trim();
    const password = signupPassword.trim();

    if (!fullName || !schoolEmail || !code || !password) return;

    if (!schoolEmail.endsWith("@lvjusd.org")) {
      setSignupError("Please use your @lvjusd.org school email address.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/teacher-accounts/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        schoolEmail,
        signupCode: code,
        password,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      setSignupError(data.error ?? "We couldn't create that teacher account.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.authEmail,
      password,
    });
    setLoading(false);

    if (error) {
      setSignupError("Your account was created, but we couldn't sign you in.");
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5 sm:p-8">
      <div className="grid grid-cols-2 gap-2 rounded-sm bg-paper p-1 ring-1 ring-forest/10">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] transition ${
            mode === "signin" ? "bg-forest text-gold" : "text-forest/70 hover:text-forest"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] transition ${
            mode === "signup" ? "bg-forest text-gold" : "text-forest/70 hover:text-forest"
          }`}
        >
          Create Account
        </button>
      </div>

      {mode === "signin" ? (
        <form onSubmit={signIn} className="mt-6 space-y-5">
          <div>
            <label htmlFor={loginEmailId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              School Email
            </label>
            <input
              id={loginEmailId}
              required
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
              placeholder="name@lvjusd.org"
            />
          </div>

          <div>
            <label htmlFor={loginPasswordId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Password
            </label>
            <input
              id={loginPasswordId}
              required
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
              placeholder="Your teacher password"
            />
          </div>

          {loginError && (
            <p className="text-sm text-red-700" role="alert">
              {loginError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-forest px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      ) : (
        <form onSubmit={signUp} className="mt-6 space-y-5">
          <div>
            <label htmlFor={signupNameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Full Name
            </label>
            <input
              id={signupNameId}
              required
              value={signupName}
              onChange={(e) => setSignupName(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
              placeholder="First and last name"
            />
          </div>

          <div>
            <label htmlFor={signupEmailId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              School Email
            </label>
            <input
              id={signupEmailId}
              required
              type="email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
              placeholder="name@lvjusd.org"
            />
          </div>

          <div>
            <label htmlFor={signupCodeId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Signup Code
            </label>
            <input
              id={signupCodeId}
              required
              value={signupCode}
              onChange={(e) => setSignupCode(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
              placeholder="Private teacher code"
            />
          </div>

          <div>
            <label
              htmlFor={signupPasswordId}
              className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70"
            >
              Password
            </label>
            <input
              id={signupPasswordId}
              required
              type="password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
              placeholder="Choose a password"
            />
          </div>

          {signupError && (
            <p className="text-sm text-red-700" role="alert">
              {signupError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-forest px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Teacher Account"}
          </button>
        </form>
      )}
    </div>
  );
}
