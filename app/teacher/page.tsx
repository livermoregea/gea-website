import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import StaffPortal from "@/components/StaffPortal";

export default async function TeacherPage() {
  if (!hasSupabaseConfig()) {
      return (
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 md:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Teacher Portal</p>
        <h1 className="mt-4 font-display text-2xl font-medium text-forest">Demo mode</h1>
        <p className="mt-3 text-sm text-graphite/70">
          Supabase isn&apos;t configured, so the teacher portal is showing placeholder content.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
          This account doesn&apos;t have teacher access yet. If you&apos;re staff, use the private
          teacher signup page.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/teacher/signup"
            className="rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold"
          >
            Teacher Signup
          </Link>
          <Link
            href="/login"
            className="rounded-sm border border-forest/15 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-forest"
          >
            Log In
          </Link>
        </div>
      </div>
    );
  }

  const displayName = teacherProfile?.full_name ?? adminProfile?.name ?? user.email ?? "Teacher";
  const schoolEmail = teacherProfile?.school_email ?? user.email ?? "";

  return (
    <StaffPortal
      title="Teacher Portal"
      accessLabel={isAdmin ? "Admin" : "Teacher"}
      displayName={displayName}
      schoolEmail={schoolEmail}
      userId={user.id}
    />
  );
}
