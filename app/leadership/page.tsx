import { createClient } from "@/lib/supabase/server";
import { getRoleLabel } from "@/lib/roles";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { loadLeadershipRoles } from "@/lib/leadership-roles";

export const revalidate = 0;

type Member = {
  role: string;
  name: string;
  contact_email: string | null;
  bio: string | null;
  photo_url: string | null;
  display_order: number;
};

type FormerMember = Member & {
  id: string;
  school_year: string;
};

export default async function LeadershipPage() {
  const supabase = await createClient();
  const { data: members } = hasSupabaseConfig()
    ? await supabase.from("leadership_members").select("*")
    : { data: [] };
  const { data: formerMembers } = hasSupabaseConfig()
    ? await supabase.from("leadership_history").select("*").order("school_year", { ascending: false }).order("display_order")
    : { data: [] as FormerMember[] };
  const { roles } = await loadLeadershipRoles(supabase);
  const memberByRole = new Map<string, Member>((members ?? []).map((m: Member) => [m.role, m]));
  const orderedRoles = roles.filter((role) => role.active).sort((a, b) => {
    const aOrder = memberByRole.get(a.slug)?.display_order ?? a.display_order;
    const bOrder = memberByRole.get(b.slug)?.display_order ?? b.display_order;
    return aOrder - bOrder;
  });
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-12">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Student Leadership</p>
      <h1 className="mt-2 font-display text-2xl font-medium text-forest sm:text-3xl md:text-4xl">
        GEA Leadership Board
      </h1>
      <div className="dim-divider my-8" />

      <div id="roles" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orderedRoles.map((role) => {
          const member = memberByRole.get(role.slug);

          return (
            <div
              key={role.slug}
              className="flex flex-col overflow-hidden rounded-sm bg-forest/[0.03] ring-1 ring-forest/5"
            >
              {member?.photo_url ? (
                <div className="border-b border-forest/10 bg-paper/70">
                  <div className="flex aspect-[5/4] items-center justify-center overflow-hidden bg-forest/[0.02]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={member.photo_url} alt={member.name} className="h-full w-full object-cover" />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <h2 className="mt-1 font-display text-base text-forest">{role.label}</h2>
                  {member ? (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-graphite">{member.name}</p>
                      {member.contact_email && (
                        <p className="mt-1 text-[11px] text-graphite/70">
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
                        <p className="mt-1 text-[11px] leading-relaxed text-graphite/70">{member.bio}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {formerMembers && formerMembers.length > 0 ? (
        <section className="mt-14 border-t border-forest/10 pt-8">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Former Leadership</p>
          <h2 className="mt-2 font-display text-2xl text-forest sm:text-3xl">Past leadership teams</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite/65">
            A record of the students who helped lead GEA in previous school years.
          </p>
          <div className="mt-6 space-y-8">
            {Array.from(new Set((formerMembers as FormerMember[]).map((member) => member.school_year))).map((schoolYear) => (
              <div key={schoolYear}>
                <h3 className="font-display text-xl text-forest">{schoolYear}</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(formerMembers as FormerMember[]).filter((member) => member.school_year === schoolYear).map((member) => (
                    <div key={member.id} className="flex items-center gap-3 rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-forest/10 bg-paper">
                        {member.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.photo_url} alt={member.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-mono text-xs uppercase tracking-[0.12em] text-gold">{member.name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("")}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-forest">{member.name}</p>
                        <p className="mt-1 text-xs text-graphite/60">{getRoleLabel(member.role, roles)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
