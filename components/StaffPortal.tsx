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
    <div className="mx-auto max-w-[86rem] px-4 py-10 sm:px-6 md:py-14">
      <section className="rounded-sm bg-paper px-5 py-4 ring-1 ring-forest/10 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">{title}</p>
            <h1 className="mt-2 font-display text-2xl font-medium text-forest sm:text-3xl">
              Welcome, {displayName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite/70">
              {accessLabel} access.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-forest/10 bg-forest/[0.03] px-3 py-1 text-xs text-forest">
              Name: {displayName}
            </span>
            <span className="rounded-full border border-forest/10 bg-forest/[0.03] px-3 py-1 text-xs text-forest">
              Email: {schoolEmail}
            </span>
            <span className="rounded-full border border-forest/10 bg-forest/[0.03] px-3 py-1 text-xs text-forest">
              Role: {accessLabel}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Admin Panel</p>
          <h2 className="mt-2 font-display text-xl text-forest sm:text-2xl">Staff dashboard</h2>
        </div>
        <AdminTabs authUserId={userId} displayName={displayName} />
      </section>
    </div>
  );
}
