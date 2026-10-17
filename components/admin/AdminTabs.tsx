"use client";

import controls from "@/components/workspace-controls.module.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import navigationStyles from "./admin-navigation.module.css";
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
import { BUILDERS_ENABLED } from "@/lib/site-features";
import { ADMIN_SECTIONS, type AdminSectionKey } from "@/components/admin/admin-sections";
import {
  getUnreadAdminNotificationCount,
  hydrateAdminNotifications,
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
  const router = useRouter();
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
        await hydrateAdminNotifications();
        const [ids, websiteAnnouncements] = await Promise.all([
          loadAdminNotificationIds(supabase, BUILDERS_ENABLED),
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
    const failed = () => setNotificationMessage("Notification read status could not be saved across devices. Please try again.");
    window.addEventListener("gea-notification-save-failed", failed);
    window.addEventListener("focus", loadAlerts);
    const unsubscribe = subscribeToAdminNotifications(loadAlerts);
    return () => { unsubscribe(); window.removeEventListener("gea-notification-save-failed", failed); window.removeEventListener("focus", loadAlerts); };
  }, []);

  async function clearNotifications() {
    setClearing(true);
    setNotificationMessage(null);
    try {
      const ids = await loadAdminNotificationIds(createClient(), BUILDERS_ENABLED);
      if (!await markAllAdminNotificationsSeen(ids)) throw new Error("Could not save notification read status. Please try again.");
      setNotificationMessage("All new notifications marked read across your devices. Pending items still need review.");
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
      <label className={navigationStyles.mobileSelect}>Administration section
        <select value={section} onChange={event => {
          if (!window.dispatchEvent(new Event("gea:before-navigation", { cancelable: true }))) return;
          const key = event.target.value as AdminSectionKey;
          if (onSectionChange) onSectionChange(key);
          else router.push(key === "dashboard" ? "/admin-portal-x7k9" : `/admin-portal-x7k9/${key}`);
        }}>
          {(["Workspace", "Website", "Operations"] as const).map(group => <optgroup key={group} label={group}>{ADMIN_SECTIONS.filter(item => item.group === group && (item.key !== "builders" || BUILDERS_ENABLED)).map(item => <option key={item.key} value={item.key}>{item.label}{alertCounts[item.key] ? ` (${alertCounts[item.key]} new)` : ""}</option>)}</optgroup>)}
        </select>
      </label>
      <nav className={navigationStyles.navigation} aria-label="Admin sections">
        {ADMIN_SECTIONS.filter(item => item.key !== "builders" || BUILDERS_ENABLED).map(item => {
          const contents = <>{item.label}{item.key === "website" && websiteActive && <span className={navigationStyles.activeBanner} aria-label="Website announcement active" />}{alertCounts[item.key] > 0 && <span className={navigationStyles.count}>{alertCounts[item.key]}<span className="sr-only"> new items</span></span>}</>;
          return onSectionChange ? <button key={item.key} onClick={() => onSectionChange(item.key)} aria-current={section === item.key ? "page" : undefined} className={controls.control}>{contents}</button> : <Link key={item.key} href={item.key === "dashboard" ? "/admin-portal-x7k9" : `/admin-portal-x7k9/${item.key}`} aria-current={section === item.key ? "page" : undefined}>{contents}</Link>;
        })}
      </nav>

      <div className="min-w-0">
        <div className={navigationStyles.sectionHeader}>
          <h2>{activeSection.label}</h2>
          <button type="button" onClick={clearNotifications} disabled={clearing || !hasSupabaseConfig()} className={`${controls.control} ${navigationStyles.textAction}`}>
            {clearing ? "Marking read…" : "Mark all updates read"}
          </button>
        </div>
        {notificationMessage && <p role="status" className="mb-4 text-sm text-graphite/80">{notificationMessage}</p>}
        {renderSection()}
      </div>
    </div>
  );
}
