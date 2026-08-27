import { redirect } from "next/navigation";
import StudentAuthForm from "@/components/StudentAuthForm";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function LoginPage() {
  const demoMode = !hasSupabaseConfig();

  if (!demoMode) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [{ data: studentProfile }, { data: studentRequest }, { data: teacherProfile }, { data: adminProfile }] = await Promise.all([
        supabase.from("student_profiles").select("id").eq("auth_user_id", user.id).maybeSingle(),
        supabase
          .from("student_account_requests")
          .select("status")
          .eq("school_email", user.email?.toLowerCase() ?? "")
          .maybeSingle(),
        supabase.from("teacher_profiles").select("id").eq("auth_user_id", user.id).maybeSingle(),
        supabase.from("admins").select("auth_user_id").eq("auth_user_id", user.id).maybeSingle(),
      ]);

      if (adminProfile) {
        redirect("/admin-portal-x7k9");
      }
      if (teacherProfile) {
        redirect("/teacher");
      }
      if (studentProfile || studentRequest?.status === "pending") {
        redirect("/dashboard#qa");
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">GEA Forum</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest sm:text-3xl">
        {demoMode ? "Forum access demo" : "Create your forum account or sign in"}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite/70">
        {demoMode
          ? "Supabase isn&apos;t configured, so sign-in is disabled in this environment."
          : "The forum is for approved GEA students. If you already have an account, sign in. If you are new, use the create account tab to submit your request."}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">What it is</p>
          <p className="mt-2 text-sm leading-relaxed text-graphite/70">
            The forum is a place for approved students to ask questions, share answers, and join
            the GEA community.
          </p>
        </div>
        <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">How to join</p>
          <p className="mt-2 text-sm leading-relaxed text-graphite/70">
            Sign in if you already have an account. If you do not, create one and we’ll review it
            for approval.
          </p>
        </div>
      </div>

      <div className="dim-divider my-8" />
      {demoMode ? null : <StudentAuthForm redirectTo="/dashboard" />}
    </div>
  );
}
