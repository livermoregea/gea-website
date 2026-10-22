import Link from "next/link";
import type { Metadata } from "next";
import GEAOneBadge from "@/components/GEAOneBadge";
import { redirect } from "next/navigation";
import StudentAuthForm from "@/components/StudentAuthForm";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { accountLanding } from "@/lib/account-landing";

export const metadata: Metadata = { title: "GEA One · Sign in", description: "One account for your GEA community, profile, and school tools." };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; next?: string; discord?: string }> }) {
  const { mode, next, discord } = await searchParams;
  const destination = next === "/volunteer" ? "/volunteer" : null;
  const initialMode = mode === "signup" ? "signup" : "signin";
  const demoMode = !hasSupabaseConfig();

  if (!demoMode) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect(destination ?? await accountLanding(supabase, user.id));
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 md:py-20">
      <section className="rounded-2xl border border-forest/10 bg-paper p-6 shadow-lg shadow-forest/5 sm:p-8" aria-labelledby="gea-one-auth-heading">
        <div className="flex justify-center"><GEAOneBadge size="hero" /></div>
        <h1 id="gea-one-auth-heading" className="mt-6 text-center font-display text-2xl font-medium text-forest">
          {demoMode ? "GEA One preview" : "Your GEA One account"}
        </h1>
        <div id="student-account" className="mt-6 scroll-mt-28">
          {discord && <p role="status" className="mb-4 text-sm text-graphite">{discord === 'officer-sign-in' ? 'Discord connections are for active officers only. Sign in with your GEA One account first, then connect Discord from Account Home.' : discord === 'identity-already-linked' ? 'This Discord identity is already linked. Sign in to the GEA One account you originally connected, then check your Discord connection from Account Home.' : 'Discord sign-in could not finish. Sign in with your existing GEA One account and connect Discord from Account Home, or contact an advisor if Discord setup is incomplete.'}</p>}
          {demoMode
            ? <p className="text-center text-sm text-graphite/80">Sign-in is unavailable in this preview.</p>
            : <StudentAuthForm key={initialMode} redirectTo={destination ?? "/account/redirect"} initialMode={initialMode} />}
        </div>
        {!demoMode && <p className="mt-5 text-sm text-graphite/75">Officers can connect Discord from Account Home after signing in with their GEA One account.</p>}
        <div className="mt-5 text-center"><Link href="/contact" className="inline-flex min-h-11 items-center text-sm text-forest underline underline-offset-4">Need help signing in?</Link></div>
      </section>
    </div>
  );
}
