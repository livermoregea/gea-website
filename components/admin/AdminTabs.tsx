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
import AdminDashboard from "@/components/admin/AdminDashboard";
import { ADMIN_SECTIONS, type AdminSectionKey } from "@/components/admin/admin-sections";
import {
  getUnreadAdminNotificationCount,
  subscribeToAdminNotifications,
} from "@/lib/admin-notifications";

export { ADMIN_SECTIONS } from "@/components/admin/admin-sections";
export type { AdminSectionKey } from "@/components/admin/admin-sections";
type TabAlertCounts = Record<AdminSectionKey, number>;

const EMPTY_ALERTS: TabAlertCounts = {
  dashboard: 0,
  applications: 0,
  students: 0,
  website: 0,
  leadership: 0,
  "profile-changes": 0,
  slots: 0,
  forum: 0,
  "teacher-invites": 0,
};

export default function AdminTabs({ section = "dashboard" }: { section?: AdminSectionKey }) {
  const [alertCounts, setAlertCounts] = useState<TabAlertCounts>(EMPTY_ALERTS);
  const [websiteActive, setWebsiteActive] = useState(false);
  const activeSection = ADMIN_SECTIONS.find((item) => item.key === section) ?? ADMIN_SECTIONS[0];

  useEffect(() => {
    async function loadAlerts() {
      if (!hasSupabaseConfig()) return;
      const supabase = createClient();
      const [applications, students, websiteAnnouncements, profileChanges, pendingQuestions, pendingAnswers] =
        await Promise.all([
          supabase.from("applications").select("id"),
          supabase.from("student_profiles").select("id"),
          supabase.from("website_announcements").select("id").eq("is_enabled", true),
          supabase.from("profile_change_requests").select("id").eq("status", "pending"),
          supabase.from("qa_questions").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("qa_answers").select("id", { count: "exact", head: true }).eq("status", "pending"),
        ]);
      setAlertCounts({
        ...EMPTY_ALERTS,
        applications: getUnreadAdminNotificationCount("applications", ((applications.data as { id: string }[] | null) ?? []).map((item) => item.id)),
        students: getUnreadAdminNotificationCount("students", ((students.data as { id: string }[] | null) ?? []).map((item) => item.id)),
        "profile-changes": getUnreadAdminNotificationCount("profile-changes", ((profileChanges.data as { id: string }[] | null) ?? []).map((item) => item.id)),
        forum: (pendingQuestions.count ?? 0) + (pendingAnswers.count ?? 0),
      });
      setWebsiteActive((websiteAnnouncements.data ?? []).length > 0);
    }
    loadAlerts();
    return subscribeToAdminNotifications(loadAlerts);
  }, []);

  function renderSection() {
    switch (section) {
      case "applications": return <AdminApplications />;
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
      <nav className="rounded-sm border border-forest/10 bg-paper p-2 shadow-[0_8px_24px_rgba(18,53,36,0.04)]" aria-label="Admin sections">
        <div className="grid gap-2 sm:grid-cols-3">
          {(["Workspace", "Website", "Operations"] as const).map((group) => (
            <div key={group} className="min-w-0 rounded-sm bg-forest/[0.025] px-2 py-2">
              <span className="px-2 font-mono text-[9px] uppercase tracking-[0.15em] text-graphite/40">{group}</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {ADMIN_SECTIONS.filter((item) => item.group === group).map((item) => {
                const selected = section === item.key;
                const count = alertCounts[item.key];
                return (
                  <Link
                    key={item.key}
                    href={item.key === "dashboard" ? "/admin-portal-x7k9" : `/admin-portal-x7k9/${item.key}`}
                    aria-current={selected ? "page" : undefined}
                    className={`relative flex min-h-10 shrink-0 items-center gap-2 rounded-sm px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition sm:px-4 ${selected ? "bg-forest text-gold" : "text-graphite/65 hover:bg-forest/[0.05] hover:text-forest"}`}
                  >
                    {item.label}
                    {item.key === "website" && websiteActive && (
                      <span className="h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_0_3px_rgba(201,160,74,0.18)]" aria-label="Website banner or popup is active" />
                    )}
                    {count > 0 && (
                      <span
                        className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[9px] font-semibold leading-none text-white shadow-sm"
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
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold">Admin workspace</p>
            <h2 className="mt-1 font-display text-2xl text-forest sm:text-3xl">{activeSection.label}</h2>
          </div>
          {section !== "dashboard" && <Link href="/admin-portal-x7k9" className="text-xs text-graphite/50 underline decoration-gold underline-offset-4 hover:text-forest">Back to dashboard</Link>}
        </div>
        {renderSection()}
      </div>
    </div>
  );
}
