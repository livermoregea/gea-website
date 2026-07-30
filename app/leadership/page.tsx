import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/roles";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const revalidate = 0;

type Member = {
  role: string;
  name: string;
  contact_email: string | null;
  bio: string | null;
};

export default async function LeadershipPage() {
  const supabase = await createClient();
  const { data: members } = hasSupabaseConfig()
    ? await supabase.from("leadership_members").select("*")
    : { data: [] };

  const memberByRole = new Map<string, Member>((members ?? []).map((m: Member) => [m.role, m]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Student Leadership</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest sm:text-3xl md:text-4xl">
        GEA Leadership Board
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-graphite/80 sm:text-base">
        GEA is run in part by its own students. Most seats on the leadership board are currently
        open — click a role below to submit an application.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite/70 sm:text-base">
        If you are looking to apply to join the academy itself, use the application form on the
        homepage.
      </p>

      <div className="dim-divider my-12" />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((role) => {
          const member = memberByRole.get(role.slug);
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
                {!filled && role.open ? (
                  <Link
                    href={`/leadership/apply/${role.slug}`}
                    className="inline-block w-full rounded-sm bg-forest px-4 py-2.5 text-center font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
                  >
                    I&apos;m Interested
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
