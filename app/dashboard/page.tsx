import { accountMemberships } from "@/lib/account-landing";
import GEAOneBadge from "@/components/GEAOneBadge";
import WorkspaceGreeting from "@/components/WorkspaceGreeting";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import QAHub from "@/components/QAHub";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata = { title: "GEA One · Forum", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const supabase = await createClient();
  if (!hasSupabaseConfig()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
      <div className="mb-5"><GEAOneBadge /></div>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">GEA One Forum</p>
        <h1 className="mt-4 font-display text-2xl font-medium text-forest">Demo mode</h1>
        <p className="mt-3 text-sm text-graphite/80">
          Supabase isn&apos;t configured, so the dashboard is showing placeholder content.
        </p>
        <div className="dim-divider my-8" />
        <QAHub authUserId={null} displayName={null} />
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 md:py-24">
      <div className="mb-5"><GEAOneBadge /></div>
        <h1 className="mb-4 font-display text-2xl text-forestdeep">GEA One access</h1>
        <p className="text-sm text-graphite/80">
          Sign in to GEA One to access the forum.{" "}
          <Link href="/login" className="text-forest underline decoration-gold underline-offset-4">
            Sign in to GEA One
          </Link>
        </p>
      </div>
    );
  }

  const membership = await accountMemberships(supabase, user.id);

  return (
    <div id="qa" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-10 sm:px-6 md:py-14">
      <div className="mb-8"><WorkspaceGreeting name={membership.displayName} /></div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <GEAOneBadge />
          <h2 className="font-display text-2xl text-forest">Q&amp;A / Forum</h2>
        </div>
        <nav aria-label="GEA One account" className="flex flex-wrap items-center gap-5">
          {membership.hasWorkspace && <Link href="/account" className="inline-flex min-h-11 items-center text-sm text-forest underline underline-offset-4">GEA One home</Link>}
          <Link href="/profile" className="inline-flex min-h-11 items-center text-sm text-forest underline underline-offset-4">Profile &amp; settings</Link>
        </nav>
      </div>
      <section aria-label="Community forum">
        <QAHub
          authUserId={user.id}
          displayName={membership.displayName ?? "GEA Member"}
          canCreatePost={membership.canUseForum}
          canVote={membership.canUseForum}
          canReply={membership.canUseForum}
          canReport
        />
      </section>
    </div>
  );
}
