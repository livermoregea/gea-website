import Link from "next/link";

const dashboardSections = [
  { key: "applications", label: "Applications", group: "Workspace" },
  { key: "students", label: "Students", group: "Workspace" },
  { key: "website", label: "Website", group: "Website" },
  { key: "leadership", label: "Leadership Board", group: "Website" },
  { key: "profile-changes", label: "Profile Changes", group: "Operations" },
  { key: "slots", label: "Interview Slots", group: "Operations" },
  { key: "forum", label: "Forum Activity", group: "Operations" },
  { key: "teacher-invites", label: "Teacher Invites", group: "Operations" },
] as const;

const descriptions: Record<string, string> = {
  applications: "Review submissions and move candidates through the interview process.",
  students: "Manage student profiles and blocked email addresses.",
  website: "Edit public-facing announcements and website content.",
  leadership: "Manage the leadership board and public profile information.",
  "profile-changes": "Review requested changes to student and staff profiles.",
  slots: "Create and manage interview availability.",
  forum: "Review questions, answers, reports, and community activity.",
  "teacher-invites": "Create and manage private teacher invitations.",
};

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <section className="border-b border-forest/10 pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">GEA control center</p>
        <h3 className="mt-2 max-w-3xl font-display text-3xl text-forest sm:text-4xl">Everything in one place.</h3>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite/65">Choose a workspace below. Each area has its own page so the admin panel can grow without becoming crowded.</p>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {dashboardSections.map((item) => (
          <Link key={item.key} href={`/admin-portal-x7k9/${item.key}`} className="group rounded-sm border border-forest/10 bg-paper p-5 transition hover:border-forest/25 hover:bg-forest/[0.03]">
            <div className="flex items-start justify-between gap-4">
              <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">{item.group}</p><h4 className="mt-2 font-display text-xl text-forest">{item.label}</h4></div>
              <span className="text-lg text-forest/40 transition group-hover:translate-x-1 group-hover:text-forest">→</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-graphite/60">{descriptions[item.key]}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
