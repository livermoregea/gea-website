import styles from "./staffportal.module.css";
import type { ReactNode } from "react";
import { accountMemberships } from "@/lib/account-landing";
import { createClient } from "@/lib/supabase/server";
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
          <h1 className={styles.title}>{workspace === "officers" ? "Officer workspace" : "Academy administration"}</h1>
          <p className={styles.identity}>{displayName} · {accessLabel}</p>
        </div>
        <div className={styles.utilities}>
          <nav aria-label="Workspace areas" className={styles.areas}>
            <Link href="/admin-portal-x7k9" aria-current={workspace === "administration" ? "page" : undefined}>Academy admin</Link>
            {membership.isOfficer && <Link href="/admin-portal-x7k9/officers" aria-current={workspace === "officers" ? "page" : undefined}>Officers</Link>}
          </nav>
          <div className={styles.links}>
            <Link href="/account" aria-label="GEA One home">Home</Link>
          </div>
        </div>
      </header>
      <section className={styles.content} aria-label={workspace === "officers" ? "Officer workspace" : "Academy administration"}>
        {children ?? <AdminTabs section={section} />}
      </section>
    </div>
  );
}
