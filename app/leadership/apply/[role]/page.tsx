import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/roles";
import ApplicationForm from "@/components/ApplicationForm";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type StudentProfile = {
  id: string;
  auth_user_id: string;
  auth_email: string;
  full_name: string;
  display_username: string;
  graduating_class_year: number;
  student_id_number: string;
  school_email: string | null;
};

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role: roleSlug } = await params;
  const role = getRole(roleSlug);
  const supabase = await createClient();
  const user = hasSupabaseConfig() ? (await supabase.auth.getUser()).data.user : null;

  const { data: profile } = hasSupabaseConfig() && user
    ? await supabase
        .from("student_profiles")
        .select(
          "id, auth_user_id, auth_email, full_name, display_username, graduating_class_year, student_id_number, school_email"
        )
        .eq("auth_user_id", user.id)
        .maybeSingle()
    : { data: null as StudentProfile | null };

  if (!role || !role.open) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 md:py-20">
      <Link
        href="/leadership"
        className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-forest/60 hover:text-forest"
      >
        ← Back to Leadership
      </Link>
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-gold">
        Leadership Application
      </p>
      <h1 className="mt-3 font-display text-2xl font-medium text-forest sm:text-3xl">{role.label}</h1>
      <p className="mt-4 text-sm leading-relaxed text-graphite/70 sm:text-base">
        Fill out the form below to apply. Applications are reviewed by the current GEA officer
        team on a rolling basis.
      </p>

      {user ? (
        <div className="mt-6 rounded-sm bg-forest/[0.04] p-5 ring-1 ring-forest/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
            Already Signed In
          </p>
          <p className="mt-2 text-sm text-graphite/70">
            You are already signed in, so this application will be linked to your account and you
            can track its progress from the leadership page.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-sm bg-forest/[0.04] p-5 ring-1 ring-forest/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
            Optional Sign In
          </p>
          <p className="mt-2 text-sm text-graphite/70">
            You can still submit this application without an account. If you want it linked to
            your profile, use the sign-in form on the leadership page first.
          </p>
          <Link
            href="/leadership"
            className="mt-3 inline-flex rounded-sm bg-forest px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
          >
            Sign In on Leadership Page
          </Link>
        </div>
      )}

      <div className="dim-divider my-10" />

      <ApplicationForm
        roleSlug={role.slug}
        roleLabel={role.label}
        requiresProof={Boolean("requiresProof" in role && role.requiresProof)}
        profile={profile}
        authUserId={user?.id ?? null}
      />
    </div>
  );
}
