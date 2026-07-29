import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import QuestionQueue from "@/components/QuestionQueue";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function DashboardPage() {
  const supabase = await createClient();
  if (!hasSupabaseConfig()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Upperclassman Dashboard</p>
        <h1 className="mt-4 font-display text-2xl font-medium text-forest">Demo mode</h1>
        <p className="mt-3 text-sm text-graphite/70">
          Supabase is not configured, so the dashboard is showing empty values only.
        </p>
        <div className="dim-divider my-8" />
        <QuestionQueue answeredByName="Demo User" />
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
          You need to sign in to answer questions.{" "}
          <Link href="/login" className="text-forest underline decoration-gold underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  const { data: upperclassman } = await supabase
    .from("upperclassmen")
    .select("name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!upperclassman) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 md:py-24">
        <p className="text-sm text-graphite/70">
          Your account isn&apos;t registered as an upperclassman answerer yet. Ask a GEA officer to
          add you.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Upperclassman Dashboard</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest">
        Welcome, {upperclassman.name.split(" ")[0]}
      </h1>
      <p className="mt-3 text-sm text-graphite/70">
        Answer any of the approved questions below. Your answer will be reviewed by an admin
        before it appears publicly.
      </p>
      <div className="dim-divider my-8" />
      <QuestionQueue answeredByName={upperclassman.name} />
    </div>
  );
}
