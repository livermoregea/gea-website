import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import QAHub from "@/components/QAHub";

export default async function TeacherPage() {
  if (!hasSupabaseConfig()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 md:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Teacher Portal</p>
        <h1 className="mt-4 font-display text-2xl font-medium text-forest">Demo mode</h1>
        <p className="mt-3 text-sm text-graphite/70">
          Supabase is not configured, so the teacher portal is showing placeholder content only.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/teacher/login");
  }

  const [{ data: teacherProfile }, { data: adminProfile }] = await Promise.all([
    supabase
      .from("teacher_profiles")
      .select("full_name, school_email")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
    supabase.from("admins").select("name").eq("auth_user_id", user.id).maybeSingle(),
  ]);

  const isTeacher = Boolean(teacherProfile);
  const isAdmin = Boolean(adminProfile);

  if (!isTeacher && !isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 md:py-24">
        <p className="text-sm text-graphite/70">
          This account does not have teacher access yet. If you are staff, use the teacher signup page
          with the private code.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/teacher/signup"
            className="rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold"
          >
            Teacher Signup
          </Link>
          <Link
            href="/teacher/login"
            className="rounded-sm border border-forest/15 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-forest"
          >
            Teacher Login
          </Link>
        </div>
      </div>
    );
  }

  const displayName = teacherProfile?.full_name ?? adminProfile?.name ?? user.email ?? "Teacher";
  const schoolEmail = teacherProfile?.school_email ?? user.email ?? "";

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Teacher Portal</p>
      <h1 className="mt-4 font-display text-3xl font-medium text-forest">
        Welcome, {displayName}
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-graphite/75 sm:text-base">
        {isAdmin
          ? "You are signed in as an admin, so this portal gives you the full teacher view plus the student-facing Q&A experience."
          : `You are signed in with ${schoolEmail}. This portal gives you the teacher view plus the student-facing Q&A experience.`}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Teacher View</p>
          <h2 className="mt-2 font-display text-xl text-forest">Staff access</h2>
          <p className="mt-2 text-sm text-graphite/70">
            Teachers can review the same content students see, answer Q&amp;A, and manage classroom-facing work from one signed-in account.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="#student-view"
              className="rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold"
            >
              Jump to Student View
            </Link>
            <Link
              href="/qa"
              className="rounded-sm border border-forest/15 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-forest"
            >
              Open Q&amp;A Hub
            </Link>
          </div>
        </div>
        <div className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Account</p>
          <h2 className="mt-2 font-display text-xl text-forest">Signed-in identity</h2>
          <p className="mt-2 text-sm text-graphite/70">
            Name: {displayName}
          </p>
          <p className="mt-1 text-sm text-graphite/70">
            Email: {schoolEmail}
          </p>
          <p className="mt-1 text-sm text-graphite/70">
            Role: {isAdmin ? "Admin" : "Teacher"}
          </p>
        </div>
      </div>

      <div className="dim-divider my-10" />

      <section id="student-view">
        <div className="mb-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Student View</p>
          <h2 className="mt-2 font-display text-2xl text-forest">
            What students see on the unified Q&amp;A page
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-graphite/70">
            This is the same Q&amp;A hub students use, so teachers can preview the public flow, submit answers,
            and check statuses from the same signed-in account.
          </p>
        </div>
        <QAHub authUserId={user.id} displayName={displayName} />
      </section>
    </div>
  );
}
