"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Mode = "signin" | "signup";

export default function StudentAuthForm({ redirectTo }: { redirectTo: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupName, setSignupName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
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
    setLoginError(null);

    if (!hasSupabaseConfig()) {
      setLoginError("Sign-in is disabled until Supabase is configured.");
      return;
    }

    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();
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
      setLoginError("We signed you in, but couldn't resolve your account.");
      setLoading(false);
      return;
    }

    const [{ data: studentProfile }, { data: teacherProfile }, { data: adminProfile }] = await Promise.all([
      supabase.from("student_profiles").select("id").eq("auth_user_id", user.id).maybeSingle(),
      supabase.from("teacher_profiles").select("id").eq("auth_user_id", user.id).maybeSingle(),
      supabase.from("admins").select("name").eq("auth_user_id", user.id).maybeSingle(),
    ]);

    router.refresh();

    if (adminProfile) {
      router.push("/admin-portal-x7k9");
      return;
    }
    if (teacherProfile) {
      router.push("/teacher");
      return;
    }
    if (studentProfile) {
      router.push(redirectTo);
      return;
    }

    setLoading(false);
    setLoginError("We couldn't match that account to a student, teacher, or admin profile.");
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);
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
    if (!schoolEmail.endsWith("@lvjusd.org")) {
      setSignupError("Please use your @lvjusd.org student email address.");
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
      setSignupError(data.error ?? "We couldn't create that account.");
      return;
    }

    setLoading(false);
    setSignupSuccess(data.message ?? "Your account is ready. You can sign in now.");
    setSignupName("");
    setSignupUsername("");
    setSignupEmail("");
    setSignupClassYear("");
    setSignupStudentId("");
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
              Email
            </label>
            <input
              id={loginEmailId}
              required
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
              placeholder="Email"
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
              placeholder="Password"
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
            <label htmlFor={signupUsernameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Display Username
            </label>
            <input
              id={signupUsernameId}
              required
              value={signupUsername}
              onChange={(e) => setSignupUsername(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
              placeholder="The name you want shown publicly"
            />
          </div>

          <div>
            <label htmlFor={signupEmailId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Student Email
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
            <p className="mt-1 text-xs text-graphite/50">
              This must be your @lvjusd.org student email. We do not send a verification link.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={signupClassYearId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
                Graduating Class Year
              </label>
              <input
                id={signupClassYearId}
                required
                inputMode="numeric"
                value={signupClassYear}
                onChange={(e) => setSignupClassYear(e.target.value)}
                className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
                placeholder="2028"
              />
            </div>

            <div>
              <label htmlFor={signupStudentIdId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
                Student ID Number
              </label>
              <p className="mt-1 text-xs leading-relaxed text-graphite/50">
                This becomes your password.
              </p>
              <input
                id={signupStudentIdId}
                required
                type="password"
                value={signupStudentId}
                onChange={(e) => setSignupStudentId(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
              placeholder="Your student ID number"
            />
          </div>
          </div>

          {signupError && (
            <p className="text-sm text-red-700" role="alert">
              {signupError}
            </p>
          )}
          {signupSuccess && (
            <p className="rounded-sm bg-forest/[0.04] px-4 py-3 text-sm text-forest" role="status">
              {signupSuccess} You can sign in now.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-forest px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Student Account"}
          </button>
        </form>
      )}
    </div>
  );
}
