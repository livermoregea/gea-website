import Link from "next/link";
import TeacherAuthForm from "@/components/TeacherAuthForm";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default function TeacherLoginPage() {
  const demoMode = !hasSupabaseConfig();

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">GEA Teacher Access</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest">
        {demoMode ? "Demo teacher access" : "Teacher sign in"}
      </h1>
      <p className="mt-3 text-sm text-graphite/70">
        {demoMode
          ? "Supabase is not configured, so teacher access is disabled in this environment."
          : "Teachers sign in with their school email and password. If you need an account, use the teacher signup page."}
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/login" className="text-forest underline decoration-gold underline-offset-4">
          Student sign in
        </Link>
      </div>

      <div className="dim-divider my-8" />
      {demoMode ? null : <TeacherAuthForm redirectTo="/teacher" mode="signin" />}
    </div>
  );
}
