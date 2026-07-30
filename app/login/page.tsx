import StudentAuthForm from "@/components/StudentAuthForm";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default function LoginPage() {
  const demoMode = !hasSupabaseConfig();

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">GEA Access</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest">
        {demoMode ? "Demo access" : "Sign in to access your portal"}
      </h1>
      <p className="mt-3 text-sm text-graphite/70">
        {demoMode
          ? "Supabase isn&apos;t configured, so sign-in is disabled in this environment."
          : "Use your account email and password to sign in."}
      </p>
      <div className="dim-divider my-8" />
      {demoMode ? null : <StudentAuthForm redirectTo="/dashboard" />}
    </div>
  );
}
