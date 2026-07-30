import LoginForm from "@/components/LoginForm";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default function AdminLoginPage() {
  const demoMode = !hasSupabaseConfig();

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Admin Portal</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest">
        {demoMode ? "Demo staff sign-in" : "Staff Sign In"}
      </h1>
      <p className="mt-3 text-sm text-graphite/70">
        {demoMode
          ? "Supabase isn&apos;t configured, so staff sign-in is disabled."
          : "Keep this page private. Only teacher or officer accounts added in Supabase can sign in."}
      </p>
      <div className="dim-divider my-8" />
      <LoginForm redirectTo="/admin-portal-x7k9" disabled={demoMode} />
    </div>
  );
}
