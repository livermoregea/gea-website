import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import ProfileEditor from "@/components/ProfileEditor";

type StudentProfile = {
  id: string;
  full_name: string;
  display_username: string;
  graduating_class_year: number;
  school_email: string | null;
  auth_email: string;
};

type TeacherProfile = {
  id: string;
  full_name: string;
  school_email: string;
  auth_email: string;
};

export default async function EditProfilePage() {
  if (!hasSupabaseConfig()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Profile Requests</p>
        <h1 className="mt-4 font-display text-2xl font-medium text-forest">Demo mode</h1>
        <p className="mt-3 text-sm text-graphite/70">
          Profile editing is disabled until Supabase is configured.
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

  const [{ data: studentProfile }, { data: teacherProfile }] = await Promise.all([
    supabase
      .from("student_profiles")
      .select("id, full_name, display_username, graduating_class_year, school_email, auth_email")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
    supabase
      .from("teacher_profiles")
      .select("id, full_name, school_email, auth_email")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
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
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Profile Requests</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest">Request profile changes</h1>
      <p className="mt-3 text-sm text-graphite/70">
        Submit profile changes for review.
      </p>

      <div className="dim-divider my-8" />

      {studentProfile ? (
        <ProfileEditor kind="student" profile={studentProfile as StudentProfile} latestRequest={latestRequest} />
      ) : teacherProfile ? (
        <ProfileEditor kind="teacher" profile={teacherProfile as TeacherProfile} latestRequest={latestRequest} />
      ) : (
        <div className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
          <p className="text-sm text-graphite/70">
            We could not find an editable student or teacher profile for this account.
          </p>
        </div>
      )}
    </div>
  );
}
