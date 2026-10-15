import styles from "./staffportal.module.css";
import type { ReactNode } from "react";
import { accountMemberships } from "@/lib/account-landing";
import { createClient } from "@/lib/supabase/server";
import GEAOneBadge from "@/components/GEAOneBadge";
import AdminTabs from "@/components/admin/AdminTabs";
import type { AdminSectionKey } from "@/components/admin/AdminTabs";
import Link from "next/link";

type StaffPortalProps = {
  title: string;
  accessLabel: "Admin" | "Teacher";
  displayName: string;
  schoolEmail: string;
  userId: string;
  section?: AdminSectionKey;
  workspace?: "administration" | "officers";
  children?: ReactNode;
};

export default async function StaffPortal({
  title,
  accessLabel,
  displayName,
  schoolEmail,
  userId,
  section = "dashboard",
  workspace = "administration",
  children,
}: StaffPortalProps) {
  const membership = await accountMemberships(await createClient(), userId);
  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <span className={styles.badge}><GEAOneBadge size="compact" /></span>
          <h1 className={styles.title}>GEA One workspace</h1>
          <p className={styles.identity}>{displayName} · {accessLabel}</p>
        </div>
        <div className={styles.links}>
          <Link href="/account" className="inline-flex min-h-11 items-center underline underline-offset-4" aria-label="GEA One home">Home</Link>
          <Link href="/dashboard#qa" className="inline-flex min-h-11 items-center underline underline-offset-4">Forum</Link>
        </div>
      </header>
      <nav aria-label="Workspace areas" className={styles.areas}>
        <Link href="/admin-portal-x7k9" aria-current={workspace === "administration" ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-full border border-forest/15 px-5 py-2 text-sm font-medium text-forest transition hover:bg-forest/5 aria-[current=page]:border-forest aria-[current=page]:bg-forest aria-[current=page]:text-paper">Academy administration</Link>
        {membership.isOfficer && <Link href="/admin-portal-x7k9/officers" aria-current={workspace === "officers" ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-full border border-forest/15 px-5 py-2 text-sm font-medium text-forest transition hover:bg-forest/5 aria-[current=page]:border-forest aria-[current=page]:bg-forest aria-[current=page]:text-paper">Officer accountability</Link>}
      </nav>
      <section className={styles.content} aria-label={workspace === "officers" ? "Officer accountability" : "Academy administration"}>
        {children ?? <AdminTabs section={section} />}
      </section>
    </div>
  );
}
