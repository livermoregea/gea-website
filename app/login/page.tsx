import { redirect } from "next/navigation";
import StudentAuthForm from "@/components/StudentAuthForm";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const initialMode = mode === "signup" ? "signup" : "signin";
  const demoMode = !hasSupabaseConfig();

  if (!demoMode) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [{ data: studentProfile }, { data: teacherProfile }, { data: adminProfile }] = await Promise.all([
        supabase.from("student_profiles").select("id").eq("auth_user_id", user.id).maybeSingle(),
        supabase.from("teacher_profiles").select("id").eq("auth_user_id", user.id).maybeSingle(),
        supabase.from("admins").select("auth_user_id").eq("auth_user_id", user.id).maybeSingle(),
      ]);

      if (adminProfile) {
        redirect("/admin-portal-x7k9");
      }
      if (teacherProfile) {
        redirect("/teacher");
      }
      if (studentProfile) {
        redirect("/dashboard#qa");
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Student accounts</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest sm:text-3xl">
        {demoMode ? "Student account demo" : "Create your GEA account or sign in"}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite/80">
        {demoMode
          ? "Supabase isn&apos;t configured, so sign-in is disabled in this environment."
          : "Student accounts are for GEA and LVJUSD students only. Use your @lvjusd.org student email and student ID to create an account."}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">What it is</p>
          <p className="mt-2 text-sm leading-relaxed text-graphite/80">
            Your student account gives you access to the student forum and a place to manage
            your student profile.
          </p>
        </div>
        <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">How to join</p>
          <p className="mt-2 text-sm leading-relaxed text-graphite/80">
            Sign in if you already have an account. If you do not, create one and you can start
            using it right away.
          </p>
        </div>
      </div>

      <div className="dim-divider my-8" />
      <div id="student-account" className="scroll-mt-28">
        {demoMode ? null : <StudentAuthForm key={initialMode} redirectTo="/dashboard" initialMode={initialMode} />}
      </div>
    </div>
  );
}
