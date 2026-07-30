import Link from "next/link";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default function TeacherSignupPage() {
  const demoMode = !hasSupabaseConfig();

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">GEA Teacher Access</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest">
        {demoMode ? "Demo teacher signup" : "Create a teacher account"}
      </h1>
      <p className="mt-3 text-sm text-graphite/70">
        {demoMode
          ? "Supabase is not configured, so teacher signup is disabled in this environment."
          : "Teacher signup only works from a private invite link sent by an admin. If you already have one, open that link instead of this page."}
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/login" className="text-forest underline decoration-gold underline-offset-4">
          Log in
        </Link>
      </div>

      <div className="dim-divider my-8" />
      {demoMode ? null : (
        <div className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
          <p className="text-sm text-graphite/70">
            Use the invite link from your school administration to finish setup.
          </p>
        </div>
      )}
    </div>
  );
}
