import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_ROLES } from "@/lib/roles";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const revalidate = 0;

type Member = {
  role: string;
  name: string;
  contact_email: string | null;
  bio: string | null;
  photo_url: string | null;
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
        Leadership roles and applications.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite/70 sm:text-base">
        Scroll down to apply!
      </p>

      {user ? (
        <div className="mt-6 rounded-sm bg-forest/[0.04] p-5 ring-1 ring-forest/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
              Signed In
            </p>
          <p className="mt-2 text-sm text-graphite/70">
            Applications are linked to your account.
          </p>
          {applicationByRole.size > 0 ? (
            <p className="mt-2 text-sm text-graphite/70">
              Submitted applications are shown below.
            </p>
          ) : (
            <p className="mt-2 text-sm text-graphite/70">
              No submitted applications yet.
            </p>
          )}
        </div>
      ) : null}

      <div className="dim-divider my-12" />

      <div id="roles" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PUBLIC_ROLES.map((role) => {
          const member = memberByRole.get(role.slug);
          const application = applicationByRole.get(role.slug);
          const filled = Boolean(member);

          return (
            <div
              key={role.slug}
              className="flex flex-col overflow-hidden rounded-sm bg-forest/[0.03] ring-1 ring-forest/5"
            >
              {member?.photo_url ? (
                <div className="border-b border-forest/10 bg-paper/70">
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-forest/[0.02]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={member.photo_url} alt={member.name} className="h-full w-full object-cover" />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-1 flex-col justify-between p-6">
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
                    Apply now!
                  </Link>
                ) : !filled ? (
                  <span className="inline-block w-full rounded-sm border border-forest/10 px-4 py-2.5 text-center font-mono text-xs uppercase tracking-[0.15em] text-graphite/40">
                    Not Accepting Applications
                  </span>
                ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
