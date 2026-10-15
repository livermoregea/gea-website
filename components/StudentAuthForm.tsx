"use client";

import ActionError from "@/components/ActionError";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isLvjusdStudentEmail } from "@/lib/student-email";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Mode = "signin" | "signup";

export default function StudentAuthForm({ redirectTo, initialMode = "signin" }: { redirectTo: string; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupName, setSignupName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupEmailTouched, setSignupEmailTouched] = useState(false);
  const [signupClassYear, setSignupClassYear] = useState("");
  const [signupStudentId, setSignupStudentId] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const loginEmailId = useId();
  const loginPasswordId = useId();
  const signupNameId = useId();
  const signupUsernameId = useId();
  const signupEmailId = useId();
  const signupClassYearId = useId();
  const signupStudentIdId = useId();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    try {
    setLoginError(null);

    if (!hasSupabaseConfig()) {
      setLoginError("GEA One sign-in is disabled until Supabase is configured.");
      return;
    }

    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword;
    if (!email || !password) return;

    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (signInError) {
      setLoginError("Incorrect email or password.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoginError("We signed you in, but couldn't resolve your GEA One account.");
      setLoading(false);
      return;
    }

    // Resolve landing permissions on the server after the session is established.
    router.push(redirectTo);
    router.refresh();
      } catch {
      setLoginError("We couldn’t reach the sign-in service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    try {
    setSignupError(null);
    setSignupEmailTouched(true);
    setSignupSuccess(null);

    if (!hasSupabaseConfig()) {
      setSignupError("Student signup is disabled until Supabase is configured.");
      return;
    }

    const fullName = signupName.trim();
    const displayUsername = signupUsername.trim();
    const schoolEmail = signupEmail.trim().toLowerCase();
    const graduatingClassYear = Number.parseInt(signupClassYear.trim(), 10);
    const studentIdNumber = signupStudentId.trim();

    if (!fullName || !displayUsername || !schoolEmail || !signupClassYear.trim() || !studentIdNumber) return;
    if (!isLvjusdStudentEmail(schoolEmail)) {
      setSignupError("Accounts are for GEA and LVJUSD students only. Use your @lvjusd.org student email.");
      return;
    }
    if (!Number.isInteger(graduatingClassYear) || graduatingClassYear < 2000) {
      setSignupError("Please enter a valid graduating class year.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/student-accounts/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        displayUsername,
        schoolEmail,
        graduatingClassYear,
        studentIdNumber,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      setSignupError(data.error ?? "We couldn't create that GEA One account.");
      return;
    }

    setLoading(false);
    setSignupSuccess(data.message ?? "Your GEA One account is ready. You can sign in now.");
    setSignupName("");
    setSignupUsername("");
    setSignupEmail("");
    setSignupClassYear("");
    setSignupStudentId("");
      } catch {
      setSignupError("We couldn’t reach the sign-in service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-w-0">
      <div role="group" aria-label="Account access" className="grid grid-cols-2 gap-2 rounded-sm bg-paper p-1 ring-1 ring-forest/10">
        <button
          type="button"
          onClick={() => setMode("signin")}
          aria-pressed={mode === "signin"}
          disabled={loading}
          className={`rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] transition ${
            mode === "signin" ? "bg-forest text-accent" : "text-forest/80 hover:text-forest"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          aria-pressed={mode === "signup"}
          disabled={loading}
          className={`rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] transition ${
            mode === "signup" ? "bg-forest text-accent" : "text-forest/80 hover:text-forest"
          }`}
        >
          Create account
        </button>
      </div>

      {mode === "signin" ? (
        <form aria-busy={loading} onSubmit={signIn} className="mt-6 space-y-5">
          <div>
            <label htmlFor={loginEmailId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/80">
              Email
            </label>
            <input
              id={loginEmailId}
              required
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/65 bg-paper px-4 py-3 text-base outline-none focus:border-gold"
              placeholder="Email" autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor={loginPasswordId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/80">
              Password
            </label>
            <input
              id={loginPasswordId}
              required
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/65 bg-paper px-4 py-3 text-base outline-none focus:border-gold"
              placeholder="Password" autoComplete="current-password"
            />
          </div>

          {loginError && (
            <ActionError message={loginError} className="text-sm text-red-700" />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-forest px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-accent transition hover:bg-forestdeep disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      ) : (
        <form aria-busy={loading} onSubmit={signUp} className="mt-6 space-y-5">
          <div>
            <label htmlFor={signupNameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/80">
              Full Name
            </label>
            <input
              id={signupNameId}
              required
              value={signupName}
              onChange={(e) => setSignupName(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/65 bg-paper px-4 py-3 text-base outline-none focus:border-gold"
              placeholder="First and last name"
            />
          </div>

      <div>
            <label htmlFor={signupUsernameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/80">
              Display Username
            </label>
            <input
              id={signupUsernameId}
              required
              value={signupUsername}
              onChange={(e) => setSignupUsername(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/65 bg-paper px-4 py-3 text-base outline-none focus:border-gold"
              placeholder="The name you want shown publicly"
            />
          </div>

          <div>
            <label htmlFor={signupEmailId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/80">
              Student Email
            </label>
            <input
              id={signupEmailId}
              onBlur={() => setSignupEmailTouched(true)}
              aria-invalid={signupEmailTouched && Boolean(signupEmail) && !isLvjusdStudentEmail(signupEmail)}
              aria-describedby={`${signupEmailId}-help`}
              required
              type="email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/65 bg-paper px-4 py-3 text-base outline-none focus:border-gold"
              placeholder="name@lvjusd.org" autoComplete="username"
            />
            <p id={`${signupEmailId}-help`} className="mt-1 text-xs text-graphite/80">
              {signupEmailTouched && signupEmail && !isLvjusdStudentEmail(signupEmail)
                ? "Use a valid @lvjusd.org student email address."
                : "GEA and LVJUSD students only. Use your own @lvjusd.org student email."}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={signupClassYearId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/80">
                Graduating Class Year
              </label>
              <input
                id={signupClassYearId}
                required
                inputMode="numeric"
                value={signupClassYear}
                onChange={(e) => setSignupClassYear(e.target.value)}
                className="mt-2 w-full rounded-sm border border-forest/65 bg-paper px-4 py-3 text-base outline-none focus:border-gold"
                placeholder="2028"
              />
            </div>

            <div>
              <label htmlFor={signupStudentIdId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/80">
                Student ID Number
              </label>
              <p className="mt-1 text-xs leading-relaxed text-graphite/80">
                This becomes your password.
              </p>
              <input
                id={signupStudentIdId}
                required
                type="password"
                value={signupStudentId}
                onChange={(e) => setSignupStudentId(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/65 bg-paper px-4 py-3 text-base outline-none focus:border-gold"
              placeholder="Your student ID number" autoComplete="new-password"
            />
          </div>
          </div>

          {signupError && (
            <ActionError message={signupError} className="text-sm text-red-700" />
          )}
          {signupSuccess && (
            <p className="rounded-sm bg-forest/[0.04] px-4 py-3 text-sm text-forest" role="status">
              {signupSuccess}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-forest px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-accent transition hover:bg-forestdeep disabled:opacity-50"
          >
            {loading ? "Creating GEA One account..." : "Create account"}
          </button>
        </form>
      )}
    </div>
  );
}
