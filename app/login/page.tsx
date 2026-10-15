import Link from "next/link";
import type { Metadata } from "next";
import GEAOneBadge from "@/components/GEAOneBadge";
import { redirect } from "next/navigation";
import StudentAuthForm from "@/components/StudentAuthForm";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { accountLanding } from "@/lib/account-landing";

export const metadata: Metadata = { title: "GEA One · Sign in", description: "One account for your GEA community, profile, and school tools." };

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
      redirect(await accountLanding(supabase, user.id));
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
          {demoMode
            ? <p className="text-center text-sm text-graphite/80">Sign-in is unavailable in this preview.</p>
            : <StudentAuthForm key={initialMode} redirectTo="/account/redirect" initialMode={initialMode} />}
        </div>
        <div className="mt-5 text-center"><Link href="/contact" className="inline-flex min-h-11 items-center text-sm text-forest underline underline-offset-4">Need help signing in?</Link></div>
      </section>
    </div>
  );
}
