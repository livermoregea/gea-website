"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import AdminApplications from "@/components/admin/AdminApplications";
import AdminForum from "@/components/admin/AdminForum";
import AdminSlots from "@/components/admin/AdminSlots";
import AdminLeadership from "@/components/admin/AdminLeadership";
import AdminStudents from "@/components/admin/AdminStudents";
import AdminProfileChanges from "@/components/admin/AdminProfileChanges";
import AdminTeacherInvites from "@/components/admin/AdminTeacherInvites";
import AdminWebsite from "@/components/admin/AdminWebsite";
import AdminBuilders from "@/components/admin/AdminBuilders";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { ADMIN_SECTIONS, type AdminSectionKey } from "@/components/admin/admin-sections";
import {
  getUnreadAdminNotificationCount,
  loadAdminNotificationIds,
  markAllAdminNotificationsSeen,
  subscribeToAdminNotifications,
} from "@/lib/admin-notifications";

export { ADMIN_SECTIONS } from "@/components/admin/admin-sections";
export type { AdminSectionKey } from "@/components/admin/admin-sections";
type TabAlertCounts = Record<AdminSectionKey, number>;

const EMPTY_ALERTS: TabAlertCounts = {
  dashboard: 0,
  applications: 0,
  students: 0,
  builders: 0,
  website: 0,
  leadership: 0,
  "profile-changes": 0,
  slots: 0,
  forum: 0,
  "teacher-invites": 0,
};

export default function AdminTabs({ section = "dashboard", onSectionChange }: { section?: AdminSectionKey; onSectionChange?: (section: AdminSectionKey) => void }) {
  const [alertCounts, setAlertCounts] = useState<TabAlertCounts>(EMPTY_ALERTS);
  const [clearing, setClearing] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [websiteActive, setWebsiteActive] = useState(false);
  const activeSection = ADMIN_SECTIONS.find((item) => item.key === section) ?? ADMIN_SECTIONS[0];

  useEffect(() => {
    async function loadAlerts() {
      if (!hasSupabaseConfig()) return;
      const supabase = createClient();
      try {
        const [ids, websiteAnnouncements] = await Promise.all([
          loadAdminNotificationIds(supabase),
          supabase.from("website_announcements").select("id").eq("is_enabled", true),
        ]);
        const unread = (kind: Parameters<typeof getUnreadAdminNotificationCount>[0]) => getUnreadAdminNotificationCount(kind, ids[kind] ?? []);
        setAlertCounts({
          ...EMPTY_ALERTS,
          applications: unread("applications"), students: unread("students"),
          "profile-changes": unread("profile-changes"), builders: unread("builders"),
          forum: unread("forum-questions") + unread("forum-answers"),
        });
        setWebsiteActive((websiteAnnouncements.data ?? []).length > 0);
      } catch { setNotificationMessage("Could not refresh notifications. Please try again."); }
    }
    loadAlerts();
    return subscribeToAdminNotifications(loadAlerts);
  }, []);

  async function clearNotifications() {
    setClearing(true);
    setNotificationMessage(null);
    try {
      const ids = await loadAdminNotificationIds(createClient());
      markAllAdminNotificationsSeen(ids);
      setNotificationMessage("All new notifications cleared on this browser. Pending items still need review.");
    } catch (error) {
      setNotificationMessage(error instanceof Error ? error.message : "Could not clear notifications.");
    } finally { setClearing(false); }
  }

  function renderSection() {
    switch (section) {
      case "applications": return <AdminApplications />;
      case "builders": return <AdminBuilders />;
      case "students": return <AdminStudents />;
      case "website": return <AdminWebsite />;
      case "leadership": return <AdminLeadership />;
      case "profile-changes": return <AdminProfileChanges />;
      case "slots": return <AdminSlots />;
      case "forum": return <AdminForum />;
      case "teacher-invites": return <AdminTeacherInvites />;
      default: return <AdminDashboard />;
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {notificationMessage && <p role="status" className="text-sm text-graphite/80">{notificationMessage}</p>}
        <button type="button" onClick={clearNotifications} disabled={clearing || !hasSupabaseConfig()} className="inline-flex min-h-11 items-center justify-center rounded-sm border border-forest/20 bg-paper px-4 py-2 text-sm text-forest hover:bg-forest/5 disabled:opacity-50">
          {clearing ? "Clearing…" : "Clear all new notifications"}
        </button>
      </div>
      <nav className="rounded-sm border border-forest/10 bg-paper p-2 shadow-[0_8px_24px_rgba(18,53,36,0.04)]" aria-label="Admin sections">
        <div className="grid gap-2 sm:grid-cols-3">
          {(["Workspace", "Website", "Operations"] as const).map((group) => (
            <div key={group} className="min-w-0 rounded-sm bg-forest/[0.025] px-2 py-2">
              <span className="px-2 font-mono text-xs uppercase tracking-[0.15em] text-graphite/80">{group}</span>
              <div className="mt-2 grid grid-cols-2 items-stretch gap-2 sm:grid-cols-1 xl:grid-cols-2">
                {ADMIN_SECTIONS.filter((item) => item.group === group).map((item) => {
                const selected = section === item.key;
                const count = alertCounts[item.key];
                const contents = <>{item.label}{item.key === "website" && websiteActive && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gold" aria-label="Website banner or popup is active" />}{count > 0 && <span className="inline-flex min-h-5 items-center rounded-full bg-red-600 px-1.5 text-white" aria-label={`${count} notifications`}>{count > 9 ? "9+" : count}</span>}</>;
                if (onSectionChange) return <button key={item.key} onClick={() => onSectionChange(item.key)} aria-current={section === item.key ? "page" : undefined} className={`flex min-h-11 min-w-0 items-center justify-start gap-2 rounded-sm px-3 py-2 text-left text-xs ${section === item.key ? "bg-forest text-accent" : "text-graphite/80 hover:bg-forest/[0.05]"}`}>{contents}</button>;
                return (
                  <Link
                    key={item.key}
                    href={item.key === "dashboard" ? "/admin-portal-x7k9" : `/admin-portal-x7k9/${item.key}`}
                    aria-current={selected ? "page" : undefined}
                    className={`relative flex min-h-11 min-w-0 items-center justify-start gap-2 rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.1em] text-left leading-relaxed transition ${selected ? "bg-forest text-accent" : "text-graphite/80 hover:bg-forest/[0.05] hover:text-forest"}`}
                  >
                    <span className="min-w-0">{item.label}</span>
                    {item.key === "website" && websiteActive && (
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gold shadow-[0_0_0_3px_rgba(201,160,74,0.18)]" aria-label="Website banner or popup is active" />
                    )}
                    {count > 0 && (
                      <span
                        className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold leading-none text-white shadow-sm"
                        aria-label={`${count} notifications`}
                      >
                        {count > 9 ? "9+" : count}
                      </span>
                    )}
                  </Link>
                );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0">
        <div className="mb-5 flex flex-col gap-1 border-b border-forest/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Admin workspace</p>
            <h2 className="mt-1 font-display text-2xl text-forest sm:text-3xl">{activeSection.label}</h2>
          </div>
          {section !== "dashboard" && (onSectionChange ? <button onClick={() => onSectionChange("dashboard")} className="text-xs text-forest underline">Back to dashboard</button> : <Link href="/admin-portal-x7k9" className="text-xs text-graphite/80 underline decoration-gold underline-offset-4 hover:text-forest">Back to dashboard</Link>)}
        </div>
        {renderSection()}
      </div>
    </div>
  );
}
