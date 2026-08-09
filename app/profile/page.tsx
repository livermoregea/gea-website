import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function ProfilePage() {
  if (!hasSupabaseConfig()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Profile</p>
        <h1 className="mt-4 font-display text-2xl font-medium text-forest">Demo mode</h1>
        <p className="mt-3 text-sm text-graphite/70">
          Profile pages are disabled until Supabase is configured.
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

  const [{ data: studentProfile }, { data: teacherProfile }, { data: adminProfile }] =
    await Promise.all([
      supabase
        .from("student_profiles")
        .select("full_name, display_username, graduating_class_year, school_email, auth_email")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
      supabase
        .from("teacher_profiles")
        .select("full_name, school_email, auth_email")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
      supabase.from("admins").select("name").eq("auth_user_id", user.id).maybeSingle(),
    ]);

  const profileType = studentProfile ? "student" : teacherProfile ? "teacher" : null;
  const profileId = studentProfile?.id ?? teacherProfile?.id ?? null;
  const { data: latestRequest } =
    profileType && profileId
      ? await supabase
          .from("profile_change_requests")
          .select("*")
          .eq("profile_type", profileType)
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Profile</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest">Your account</h1>
      <p className="mt-3 text-sm text-graphite/70">
        This is the account linked to your Q&amp;A, leadership, and staff access.
      </p>

      <div className="dim-divider my-8" />

      {studentProfile ? (
        <div className="space-y-4">
          <div className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Student Profile</p>
            <h2 className="mt-2 font-display text-xl text-forest">{studentProfile.display_username}</h2>
            <div className="mt-3 space-y-1 text-sm text-graphite/70">
              <p>Name: {studentProfile.full_name}</p>
              <p>Class of {studentProfile.graduating_class_year}</p>
              <p>School Email: {studentProfile.school_email ?? studentProfile.auth_email}</p>
              <p>Login Email: {studentProfile.auth_email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/profile/edit"
              className="inline-flex min-h-11 items-center rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold"
            >
              Request Changes
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center rounded-sm border border-forest/15 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-forest"
            >
              Go to Dashboard
            </Link>
          </div>
          {latestRequest ? (
            <div className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
                Latest Profile Request
              </p>
              <p className="mt-2 text-sm text-graphite/70">
                Status: <span className="font-medium text-forest">{latestRequest.status}</span>
              </p>
              {latestRequest.rejection_reason ? (
                <p className="mt-2 text-sm text-red-700">Rejected: {latestRequest.rejection_reason}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : teacherProfile ? (
        <div className="space-y-4">
          <div className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Teacher Profile</p>
            <h2 className="mt-2 font-display text-xl text-forest">{teacherProfile.full_name}</h2>
            <div className="mt-3 space-y-1 text-sm text-graphite/70">
              <p>School Email: {teacherProfile.school_email}</p>
              <p>Login Email: {teacherProfile.auth_email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/profile/edit"
              className="inline-flex min-h-11 items-center rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold"
            >
              Request Changes
            </Link>
            <Link
              href="/teacher"
              className="inline-flex min-h-11 items-center rounded-sm border border-forest/15 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-forest"
            >
              Teacher Portal
            </Link>
          </div>
          {latestRequest ? (
            <div className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
                Latest Profile Request
              </p>
              <p className="mt-2 text-sm text-graphite/70">
                Status: <span className="font-medium text-forest">{latestRequest.status}</span>
              </p>
              {latestRequest.rejection_reason ? (
                <p className="mt-2 text-sm text-red-700">Rejected: {latestRequest.rejection_reason}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : adminProfile ? (
        <div className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Admin Profile</p>
          <h2 className="mt-2 font-display text-xl text-forest">{adminProfile.name}</h2>
          <p className="mt-3 text-sm text-graphite/70">
            Admin accounts use the staff portal for most profile-related actions.
          </p>
          <Link
            href="/admin-portal-x7k9"
            className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold"
          >
            Open Admin Portal
          </Link>
        </div>
      ) : (
        <div className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
          <p className="text-sm text-graphite/70">
            We found your account, but not a linked student, teacher, or admin profile.
          </p>
        </div>
      )}
    </div>
  );
}
