import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_ROLES, getRoleEligibilityLabel } from "@/lib/roles";
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

const ROLE_RESPONSIBILITIES: Record<string, string[]> = {
  president: [
    "Lead the officer team and help guide GEA.",
    "Run meetings, keep projects moving, and represent the club when needed.",
    "Work with officers to keep events, plans, and communication on track.",
  ],
  "vice-president": [
    "Support the president and help keep the officer team organized.",
    "Step in when needed, help run meetings, and assist with club events or planning.",
    "Work with other officers to turn ideas into action.",
  ],
  secretary: [
    "Take meeting notes and keep a clear record of what the officer team decides.",
    "Stay organized so the team can look back on plans and updates.",
  ],
  publicist: [
    "Create and share flyers, posts, and other promotions for GEA events.",
    "Help document club activities with photos or videos when needed.",
    "Keep the club visible and help students hear about what is happening.",
  ],
  treasurer: [
    "Manage GEA finances, including grants, event spending, and purchases for materials or equipment.",
    "Keep track of money coming in and going out so the club stays organized.",
    "Help make sure spending decisions are clear to the officer team.",
  ],
  "rep-11": [
    "Represent the 11th grade and bring student input to the officer team.",
    "Share ideas, communicate concerns, and support class-specific events or needs.",
  ],
  "rep-10": [
    "Represent the 10th grade and bring student input to the officer team.",
    "Share ideas, communicate concerns, and support class-specific events or needs.",
  ],
  "rep-9": [
    "Represent the 9th grade and bring student input to the officer team.",
    "Share ideas, communicate concerns, and support class-specific events or needs.",
  ],
};

function getResponsibilities(roleSlug: string) {
  return ROLE_RESPONSIBILITIES[roleSlug] ?? [];
}

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role: roleSlug } = await params;
  const role = PUBLIC_ROLES.find((r) => r.slug === roleSlug);
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
        Submit the form below to apply. Applications are reviewed by the GEA officer team.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-graphite/60 sm:text-base">
        Applications cannot be edited after submission. If you need to add anything later, mention
        it during your interview.
      </p>

      <section className="mt-6 rounded-sm bg-forest/[0.04] p-5 ring-1 ring-forest/10">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
          Role Summary
        </p>
        <h2 className="mt-2 font-display text-xl text-forest">{role.label}</h2>
        {getRoleEligibilityLabel(role.slug) ? (
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-graphite/55">
            {getRoleEligibilityLabel(role.slug)}
          </p>
        ) : null}
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-graphite/75">
          {getResponsibilities(role.slug).map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {user ? (
        <div className="mt-6 rounded-sm bg-forest/[0.04] p-5 ring-1 ring-forest/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
            Signed In
          </p>
          <p className="mt-2 text-sm text-graphite/70">
            This application will be linked to your account.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-sm bg-forest/[0.04] p-5 ring-1 ring-forest/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
            Optional Sign In
          </p>
          <p className="mt-2 text-sm text-graphite/70">
            Sign in to associate this application with your account.
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
