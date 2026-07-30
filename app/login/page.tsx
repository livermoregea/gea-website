import Link from "next/link";
import StudentAuthForm from "@/components/StudentAuthForm";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default function LoginPage() {
  const demoMode = !hasSupabaseConfig();

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">GEA Student Access</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest">
        {demoMode ? "Demo student access" : "Sign in or create a student account"}
      </h1>
      <p className="mt-3 text-sm text-graphite/70">
        {demoMode
          ? "Supabase is not configured, so the form is disabled and the site will stay in empty/demo mode."
          : "Students sign in with the email address they gave us and their student ID number. New accounts still collect name, display username, graduating class year, and student email."}
      </p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/teacher/login" className="text-forest underline decoration-gold underline-offset-4">
          Teacher sign in
        </Link>
      </div>
      <div className="dim-divider my-8" />
      {demoMode ? null : <StudentAuthForm redirectTo="/dashboard" />}
    </div>
  );
}
