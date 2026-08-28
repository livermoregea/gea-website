"use client";

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

const TABS = [
  { key: "applications", label: "Applications" },
  { key: "students", label: "Students" },
  { key: "website", label: "Website" },
  { key: "profile-changes", label: "Profile Changes" },
  { key: "slots", label: "Interview Slots" },
  { key: "forum", label: "Forum Activity" },
  { key: "leadership", label: "Leadership Board" },
  { key: "teacher-invites", label: "Teacher Invites" },
] as const;

type TabKey = (typeof TABS)[number]["key"];
type TabAlertCounts = Record<TabKey, number>;

const EMPTY_ALERTS: TabAlertCounts = {
  applications: 0,
  students: 0,
  website: 0,
  "profile-changes": 0,
  slots: 0,
  forum: 0,
  leadership: 0,
  "teacher-invites": 0,
};

export default function AdminTabs({
  authUserId,
  displayName,
}: {
  authUserId: string;
  displayName: string;
}) {
  const [tab, setTab] = useState<TabKey>("applications");
  const [alertCounts, setAlertCounts] = useState<TabAlertCounts>(EMPTY_ALERTS);
  const activeTab = TABS.find((item) => item.key === tab) ?? TABS[0];

  useEffect(() => {
    async function loadAlerts() {
      if (!hasSupabaseConfig()) {
        setAlertCounts(EMPTY_ALERTS);
        return;
      }

      const supabase = createClient();
      const [
        applications,
        studentBlocks,
        websiteAnnouncements,
        profileChanges,
        pendingQuestions,
        pendingAnswers,
      ] = await Promise.all([
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase
          .from("student_email_blocks")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("website_announcements")
          .select("id", { count: "exact", head: true })
          .eq("is_enabled", true),
        supabase
          .from("profile_change_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("qa_questions").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("qa_answers").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      setAlertCounts({
        applications: applications.count ?? 0,
        students: studentBlocks.count ?? 0,
        website: websiteAnnouncements.count ?? 0,
        "profile-changes": profileChanges.count ?? 0,
        slots: 0,
        forum: (pendingQuestions.count ?? 0) + (pendingAnswers.count ?? 0),
        leadership: 0,
        "teacher-invites": 0,
      });
    }

    loadAlerts();
  }, []);

  return (
    <div className="grid gap-5 lg:grid-cols-[14.5rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-sm bg-paper p-3 ring-1 ring-forest/10 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="border-b border-forest/10 pb-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-gold">Sections</p>
          </div>

          <div className="mt-3 space-y-1.5" role="tablist" aria-label="Admin sections">
            {TABS.map((t) => {
              const selected = tab === t.key;
              const count = alertCounts[t.key];
              const hasAlert = count > 0;
              return (
                <button
                  key={t.key}
                  id={`tab-${t.key}`}
                  onClick={() => setTab(t.key)}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`panel-${t.key}`}
                  tabIndex={selected ? 0 : -1}
                  className={`w-full rounded-sm border px-3 py-2.5 text-left transition ${
                    selected
                      ? "border-forest bg-forest/[0.04] shadow-[0_0_0_1px_rgba(31,66,48,0.08)]"
                      : "border-forest/10 bg-forest/[0.015] hover:border-forest/20 hover:bg-forest/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                        selected ? "text-forest" : "text-graphite/70"
                      }`}
                    >
                      {t.label}
                    </p>
                    <span className="relative flex items-center justify-center">
                      <span
                        className={`h-2.5 w-2.5 rounded-full transition ${
                          selected
                            ? "bg-forest"
                            : hasAlert
                              ? "bg-gold shadow-[0_0_0_4px_rgba(201,160,74,0.18)] animate-pulse"
                              : "bg-gold/45"
                        }`}
                      />
                      {hasAlert && !selected && (
                        <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-red-600 px-1 text-[9px] font-semibold leading-4 text-white shadow-sm">
                          {count > 9 ? "9+" : count}
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-4 rounded-sm bg-paper px-4 py-3 ring-1 ring-forest/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-gold">Current section</p>
          <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-display text-xl text-forest sm:text-2xl">{activeTab.label}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-sm bg-paper p-4 ring-1 ring-forest/10 sm:p-5 lg:p-6">
          <div role="tabpanel" id="panel-applications" aria-labelledby="tab-applications" hidden={tab !== "applications"}>
            {tab === "applications" && <AdminApplications />}
          </div>
          <div role="tabpanel" id="panel-students" aria-labelledby="tab-students" hidden={tab !== "students"}>
            {tab === "students" && <AdminStudents />}
          </div>
          <div role="tabpanel" id="panel-website" aria-labelledby="tab-website" hidden={tab !== "website"}>
            {tab === "website" && <AdminWebsite />}
          </div>
          <div
            role="tabpanel"
            id="panel-profile-changes"
            aria-labelledby="tab-profile-changes"
            hidden={tab !== "profile-changes"}
          >
            {tab === "profile-changes" && <AdminProfileChanges />}
          </div>
          <div role="tabpanel" id="panel-slots" aria-labelledby="tab-slots" hidden={tab !== "slots"}>
            {tab === "slots" && <AdminSlots />}
          </div>
          <div role="tabpanel" id="panel-forum" aria-labelledby="tab-forum" hidden={tab !== "forum"}>
            {tab === "forum" && <AdminForum />}
          </div>
          <div
            role="tabpanel"
            id="panel-leadership"
            aria-labelledby="tab-leadership"
            hidden={tab !== "leadership"}
          >
            {tab === "leadership" && <AdminLeadership />}
          </div>
          <div
            role="tabpanel"
            id="panel-teacher-invites"
            aria-labelledby="tab-teacher-invites"
            hidden={tab !== "teacher-invites"}
          >
            {tab === "teacher-invites" && <AdminTeacherInvites />}
          </div>
        </div>
      </div>
    </div>
  );
}
