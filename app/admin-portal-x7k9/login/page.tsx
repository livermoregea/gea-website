import GEAOneBadge from "@/components/GEAOneBadge";
import LoginForm from "@/components/LoginForm";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default function AdminLoginPage() {
  const demoMode = !hasSupabaseConfig();

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6 md:py-24">
      <div className="mb-5"><GEAOneBadge /></div>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Admin Portal</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest">
        {demoMode ? "GEA One staff preview" : "Sign in to GEA One"}
      </h1>
      <p className="mt-3 text-sm text-graphite/80">
        {demoMode
          ? "Supabase isn&apos;t configured, so staff sign-in is disabled."
          : "Keep this page private. Use your GEA One account with assigned teacher or officer access."}
      </p>
      <div className="dim-divider my-8" />
      <LoginForm redirectTo="/account/redirect" disabled={demoMode} />
    </div>
  );
}
