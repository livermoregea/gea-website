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
          You need to sign in to answer questions.{" "}
          <Link href="/login" className="text-forest underline decoration-gold underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("student_profiles")
    .select("full_name, display_username, graduating_class_year")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 md:py-24">
        <p className="text-sm text-graphite/70">
          Your account doesn&apos;t have a student profile yet. Please create one from the student
          login page.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Student Dashboard</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest">
        Welcome, {profile.display_username}
      </h1>
      <p className="mt-3 text-sm text-graphite/70">
        Name: {profile.full_name}. Class of {profile.graduating_class_year}. This is your unified
        student account for the site.
      </p>
      <div className="dim-divider my-8" />
      <section id="qa" className="space-y-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Private Q&amp;A Hub</p>
          <h2 className="mt-2 font-display text-xl text-forest">Ask, answer, and track your activity</h2>
          <p className="mt-2 text-sm text-graphite/70">
            This is the signed-in area for asking questions, answering the queue, and viewing your own history.
          </p>
        </div>
        <QAHub authUserId={user.id} displayName={profile.display_username} />
      </section>
    </div>
  );
}
