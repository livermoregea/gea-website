import AdminTabs from "@/components/admin/AdminTabs";

type StaffPortalProps = {
  title: string;
  accessLabel: "Admin" | "Teacher";
  displayName: string;
  schoolEmail: string;
  userId: string;
};

export default function StaffPortal({
  title,
  accessLabel,
  displayName,
  schoolEmail,
  userId,
}: StaffPortalProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">{title}</p>
      <h1 className="mt-4 font-display text-3xl font-medium text-forest">
        Welcome, {displayName}
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-graphite/75 sm:text-base">
        You&apos;re signed in with {accessLabel.toLowerCase()} access. Use the admin tools below
        and answer questions from the same page.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Account</p>
          <h2 className="mt-2 font-display text-xl text-forest">Signed-in identity</h2>
          <p className="mt-2 text-sm text-graphite/70">Name: {displayName}</p>
          <p className="mt-1 text-sm text-graphite/70">Email: {schoolEmail}</p>
          <p className="mt-1 text-sm text-graphite/70">Role: {accessLabel}</p>
        </div>

        <div className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Staff Access</p>
          <h2 className="mt-2 font-display text-xl text-forest">Admin tools and Q&amp;A</h2>
          <p className="mt-2 text-sm text-graphite/70">
            Review applications, manage the leadership board, and answer student questions without
            leaving this page.
          </p>
        </div>
      </div>

      <div className="dim-divider my-10" />

      <section>
        <div className="mb-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Admin Panel</p>
          <h2 className="mt-2 font-display text-2xl text-forest">Staff dashboard</h2>
          <p className="mt-2 text-sm leading-relaxed text-graphite/70">
            This is the same admin-style dashboard used by staff. Use the tabs below for portal
            work and open the Q&amp;A tab when you want to answer questions.
          </p>
        </div>
        <AdminTabs authUserId={userId} displayName={displayName} />
      </section>
    </div>
  );
}
