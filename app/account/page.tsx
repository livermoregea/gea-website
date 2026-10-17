import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./home.module.css";
import GEAOneBadge from "@/components/GEAOneBadge";
import { accountMemberships } from "@/lib/account-landing";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "GEA One · Home", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountHomePage() {
  if (!hasSupabaseConfig()) redirect("/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const membership = await accountMemberships(supabase, user.id);
  if (membership.isStudent && !membership.hasWorkspace) redirect("/dashboard#qa");

  const staff = membership.isAdmin || membership.isTeacher;
  const destinations = [
    { href: "/dashboard#qa", title: "Community forum", detail: "Ask a question. Share an idea. Join the conversation.", action: "Open forum", icon: "forum" },
    ...(staff ? [{ href: "/admin-portal-x7k9", title: "Academy workspace", detail: membership.isOfficer ? "Academy administration and the officer workspace, together." : "Your academy tools, organized in one place.", action: "Open workspace", icon: "workspace" }]
      : membership.isOfficer ? [{ href: "/officerboard", title: "Officer workspace", detail: "Tasks, updates, meetings, events, and progress in one place.", action: "Open workspace", icon: "workspace" }] : []),
  ];

  return <div className={styles.page}>
    <header className={styles.welcome}>
      <div className={styles.welcomeContent}>
        <GEAOneBadge inverse />
        <h1>Welcome to GEA One</h1>
        {membership.displayName && <p>Good to see you, {membership.displayName}.</p>}
      </div>
      <span className={styles.access}>{membership.isAdmin ? "Admin" : membership.isTeacher ? "Teacher" : membership.isOfficer ? "Officer" : "Member"}</span>
    </header>
    <nav aria-label="Your GEA One workspaces" className={styles.destinations}>
      {destinations.map(destination => <Link key={destination.href} href={destination.href} className={styles.destination}>
        <span className={styles.icon}><HomeIcon kind={destination.icon} /></span>
        <div><h2>{destination.title}</h2><p>{destination.detail}</p></div>
        <span className={styles.action}>{destination.action}<span aria-hidden="true">↗</span></span>
      </Link>)}
    </nav>
    <div className={styles.settings}>
      <div><p>Your account</p><span>Personal details &amp; profile changes</span></div>
      <Link href="/profile">Profile &amp; settings <span aria-hidden="true">→</span></Link>
    </div>
  </div>;
}

function HomeIcon({ kind }: { kind: string }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "forum" ? <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-3 3V10.5A7.5 7.5 0 0 1 9.5 3H15a5 5 0 0 1 5 5Z" /><path d="M7 9h8M7 13h5" /></> : <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M8 5V3h8v2M3 11h18M10 11v3h4v-3" /></>}
  </svg>;
}
