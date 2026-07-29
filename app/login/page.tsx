import LoginForm from "@/components/LoginForm";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default function LoginPage() {
  const demoMode = !hasSupabaseConfig();

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Upperclassman Access</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest">
        {demoMode ? "Demo sign-in" : "Sign in to answer questions"}
      </h1>
      <p className="mt-3 text-sm text-graphite/70">
        {demoMode
          ? "Supabase is not configured, so the form is disabled and the site will stay in empty/demo mode."
          : "Accounts are created by GEA officers. Contact an officer if you don&apos;t have login credentials yet."}
      </p>
      <div className="dim-divider my-8" />
      <LoginForm redirectTo="/dashboard" disabled={demoMode} />
    </div>
  );
}
