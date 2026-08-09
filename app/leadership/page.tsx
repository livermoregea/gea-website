import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/roles";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import StudentAuthForm from "@/components/StudentAuthForm";

export const revalidate = 0;

type Member = {
  role: string;
  name: string;
  contact_email: string | null;
  bio: string | null;
};

type Application = {
  id: string;
  role: string;
  status: string;
  created_at: string;
};

function formatStatus(status: string) {
  switch (status) {
    case "pending":
      return "Pending review";
    case "reviewing":
      return "Under review";
    case "invited":
      return "Interview invite sent";
    case "interview_booked":
      return "Interview booked";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

export default async function LeadershipPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: members } = hasSupabaseConfig()
    ? await supabase.from("leadership_members").select("*")
    : { data: [] };
  const { data: applications } = hasSupabaseConfig() && user
    ? await supabase
        .from("applications")
        .select("id, role, status, created_at")
        .eq("auth_user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] as Application[] };

  const memberByRole = new Map<string, Member>((members ?? []).map((m: Member) => [m.role, m]));
  const applicationByRole = new Map<string, Application>();
  for (const application of applications ?? []) {
    if (!applicationByRole.has(application.role)) {
      applicationByRole.set(application.role, application);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Student Leadership</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest sm:text-3xl md:text-4xl">
        GEA Leadership Board
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-graphite/80 sm:text-base">
        GEA is run in part by its own students. Most leadership seats are open, so you can click a
        role below to apply.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite/70 sm:text-base">
        You can apply with or without signing in. If you sign in first, your leadership
        application will be linked to your account so you can track it later.
      </p>

      {user ? (
        <div className="mt-6 rounded-sm bg-forest/[0.04] p-5 ring-1 ring-forest/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
            Already Signed In
          </p>
          <p className="mt-2 text-sm text-graphite/70">
            You are already signed in. Any leadership application you submit from here will be
            linked to your account, so you can check the process later on this page.
          </p>
          {applicationByRole.size > 0 ? (
            <p className="mt-2 text-sm text-graphite/70">
              Your submitted applications are showing below. Click a role to review the current
              status.
            </p>
          ) : (
            <p className="mt-2 text-sm text-graphite/70">
              You have not submitted any leadership applications yet. Pick a role below to start
              one.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-sm bg-forest/[0.04] p-5 ring-1 ring-forest/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
              Apply Without Signing In
            </p>
            <p className="mt-2 text-sm text-graphite/70">
              You can still apply below without an account. If you want your application tied to
              your student profile, sign in here first.
            </p>
            <Link
              href="#roles"
              className="mt-3 inline-flex rounded-sm bg-forest px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
            >
              Browse Roles
            </Link>
          </div>
          <div className="rounded-sm bg-forest/[0.04] p-5 ring-1 ring-forest/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Sign In Here</p>
            <p className="mt-2 text-sm text-graphite/70">
              Sign in on this page if you want your leadership application linked to your account.
            </p>
            <div className="mt-4">
              <StudentAuthForm redirectTo="/leadership" />
            </div>
          </div>
        </div>
      )}

      <div className="dim-divider my-12" />

      <div id="roles" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((role) => {
          const member = memberByRole.get(role.slug);
          const application = applicationByRole.get(role.slug);
          const filled = Boolean(member);

          return (
            <div
              key={role.slug}
              className="flex flex-col justify-between rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5"
            >
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">
                  {filled ? "Seat Filled" : "Seat Open"}
                </p>
                <h2 className="mt-2 font-display text-lg text-forest">{role.label}</h2>
                {member ? (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-graphite">{member.name}</p>
                    {member.contact_email && (
                      <p className="mt-1 text-xs text-graphite/70">
                        Contact:{" "}
                        <a
                          href={`mailto:${member.contact_email}`}
                          className="text-forest underline decoration-gold underline-offset-4"
                        >
                          {member.contact_email}
                        </a>
                      </p>
                    )}
                    {member.bio && (
                      <p className="mt-1 text-xs leading-relaxed text-graphite/70">{member.bio}</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-xs leading-relaxed text-graphite/60">
                    This position isn&apos;t currently held by a student. If you&apos;re interested,
                    you can apply below.
                  </p>
                )}
              </div>

              <div className="mt-6">
                {application ? (
                  <details className="rounded-sm border border-forest/10 bg-paper/80 p-3">
                    <summary className="cursor-pointer list-none font-mono text-xs uppercase tracking-[0.15em] text-forest">
                      Check Application Status
                    </summary>
                    <div className="mt-3 space-y-2">
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                        Current status
                      </p>
                      <p className="text-sm font-medium text-graphite">{formatStatus(application.status)}</p>
                      <p className="text-xs text-graphite/55">
                        Submitted {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).format(new Date(application.created_at))}
                      </p>
                    </div>
                  </details>
                ) : !filled && role.open ? (
                  <Link
                    href={`/leadership/apply/${role.slug}`}
                    className="inline-block w-full rounded-sm bg-forest px-4 py-2.5 text-center font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
                  >
                    {user ? "Apply with linked account" : "Apply without account"}
                  </Link>
                ) : !filled ? (
                  <span className="inline-block w-full rounded-sm border border-forest/10 px-4 py-2.5 text-center font-mono text-xs uppercase tracking-[0.15em] text-graphite/40">
                    Not Accepting Applications
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
