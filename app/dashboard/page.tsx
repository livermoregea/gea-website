import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import QAHub from "@/components/QAHub";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function DashboardPage() {
  const supabase = await createClient();
  if (!hasSupabaseConfig()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Student Dashboard</p>
        <h1 className="mt-4 font-display text-2xl font-medium text-forest">Demo mode</h1>
        <p className="mt-3 text-sm text-graphite/70">
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
        <p className="text-sm text-graphite/70">
          You need to sign in to access the forum.{" "}
          <Link href="/login" className="text-forest underline decoration-gold underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  const [{ data: profile }, { data: request }] = await Promise.all([
    supabase
      .from("student_profiles")
      .select("full_name, display_username, graduating_class_year")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
    supabase
      .from("student_account_requests")
      .select("full_name, display_username, graduating_class_year, status")
      .eq("school_email", user.email?.toLowerCase() ?? "")
      .maybeSingle(),
  ]);

  if (!profile && !request) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 md:py-24">
        <p className="text-sm text-graphite/70">
          Your account doesn&apos;t have a student profile yet. Please create one from the student
          login page.
        </p>
      </div>
    );
  }

  if (!profile && request?.status === "rejected") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 md:py-24">
        <p className="text-sm text-graphite/70">
          Your student account request was not approved. If you think this is a mistake, contact a
          GEA coordinator.
        </p>
      </div>
    );
  }

  const isPending = !profile && request?.status === "pending";
  const displayName = profile?.display_username ?? request?.display_username ?? "GEA Student";
  const fullName = profile?.full_name ?? request?.full_name ?? "Student";
  const classYear = profile?.graduating_class_year ?? request?.graduating_class_year ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
      <div className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Student Dashboard</p>
        <h1 className="mt-4 font-display text-2xl font-medium text-forest">
          Welcome, {displayName}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-graphite/70">
          Name: {fullName}
          {classYear ? `. Class of ${classYear}.` : "."}{" "}
          {profile ? "This is your student account for the site." : "Your account is pending approval."}
        </p>
      </div>
      <div className="dim-divider my-8" />
      <section id="qa" className="space-y-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">GEA Forum</p>
          <h2 className="mt-2 font-display text-xl text-forest">
            {isPending ? "Read-only access" : "Forum access"}
          </h2>
          {isPending && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite/70">
              Your account is waiting for approval. You can read posts and report issues, but you
              cannot post, reply, or vote yet.
            </p>
          )}
        </div>
        <QAHub
          authUserId={user.id}
          displayName={displayName}
          canCreatePost={!isPending}
          canVote={!isPending}
          canReply={!isPending}
          canReport
        />
      </section>
    </div>
  );
}
