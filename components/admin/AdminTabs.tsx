"use client";

import { useState } from "react";
import AdminApplications from "@/components/admin/AdminApplications";
import AdminForum from "@/components/admin/AdminForum";
import AdminSlots from "@/components/admin/AdminSlots";
import AdminLeadership from "@/components/admin/AdminLeadership";
import AdminStudents from "@/components/admin/AdminStudents";
import AdminProfileChanges from "@/components/admin/AdminProfileChanges";
import AdminTeacherInvites from "@/components/admin/AdminTeacherInvites";

const TABS = [
  { key: "applications", label: "Applications" },
  { key: "students", label: "Students" },
  { key: "profile-changes", label: "Profile Changes" },
  { key: "slots", label: "Interview Slots" },
  { key: "forum", label: "Forum Activity" },
  { key: "leadership", label: "Leadership Board" },
  { key: "teacher-invites", label: "Teacher Invites" },
] as const;

export default function AdminTabs({
  authUserId,
  displayName,
}: {
  authUserId: string;
  displayName: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("applications");
  const activeTab = TABS.find((item) => item.key === tab) ?? TABS[0];

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
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        selected ? "bg-forest" : "bg-gold/45"
                      }`}
                    />
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
