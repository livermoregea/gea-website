"use client";

import { useState } from "react";
import QAHub from "@/components/QAHub";
import AdminApplications from "@/components/admin/AdminApplications";
import AdminSlots from "@/components/admin/AdminSlots";
import AdminQA from "@/components/admin/AdminQA";
import AdminLeadership from "@/components/admin/AdminLeadership";
import AdminStudents from "@/components/admin/AdminStudents";
import AdminProfileChanges from "@/components/admin/AdminProfileChanges";
import AdminTeacherInvites from "@/components/admin/AdminTeacherInvites";

const TABS = [
  { key: "applications", label: "Applications" },
  { key: "students", label: "Students" },
  { key: "profile-changes", label: "Profile Changes" },
  { key: "slots", label: "Interview Slots" },
  { key: "qa", label: "Q&A Moderation" },
  { key: "qa-hub", label: "Q&A Hub" },
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

  return (
    <div>
      <div className="flex flex-wrap gap-2 overflow-x-auto border-b border-forest/10" role="tablist" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            onClick={() => setTab(t.key)}
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            className={`min-h-11 whitespace-nowrap px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] ${
              tab === t.key
                ? "border-b-2 border-gold text-forest"
                : "text-graphite/50 hover:text-forest"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-8">
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
        <div role="tabpanel" id="panel-qa" aria-labelledby="tab-qa" hidden={tab !== "qa"}>
          {tab === "qa" && <AdminQA />}
        </div>
        <div role="tabpanel" id="panel-qa-hub" aria-labelledby="tab-qa-hub" hidden={tab !== "qa-hub"}>
          {tab === "qa-hub" && <QAHub authUserId={authUserId} displayName={displayName} />}
        </div>
        <div role="tabpanel" id="panel-leadership" aria-labelledby="tab-leadership" hidden={tab !== "leadership"}>
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
  );
}
