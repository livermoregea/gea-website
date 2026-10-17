"use client";

import controls from "@/components/workspace-controls.module.css";
import { useEffect, useId, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import {
  STUDENT_EMAIL_BLOCK_REASONS,
  getStudentEmailBlockReasonLabel,
  type StudentEmailBlockReason,
} from "@/lib/student-access";
import { isAdminNotificationSeen, markAdminNotificationSeen, subscribeToAdminNotifications } from "@/lib/admin-notifications";

type StudentProfile = {
  id: string;
  auth_user_id: string;
  auth_email: string;
  full_name: string;
  display_username: string;
  graduating_class_year: number;
  school_email: string | null;
  created_at: string;
};

type StudentBlock = {
  school_email: string;
  reason: string;
  note: string | null;
  blocked_at: string;
};

function getStudentEmail(student: StudentProfile) {
  return (student.school_email ?? student.auth_email).trim().toLowerCase();
}

const STUDENTS_PAGE_SIZE = 10;

export default function AdminStudents() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [blocks, setBlocks] = useState<StudentBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fullName, setFullName] = useState("");
  const [displayUsername, setDisplayUsername] = useState("");
  const [graduatingClassYear, setGraduatingClassYear] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [removalReason, setRemovalReason] = useState<StudentEmailBlockReason>("not_in_gea");
  const [removalNote, setRemovalNote] = useState("");
  const [, setNotificationRevision] = useState(0);
  useEffect(() => subscribeToAdminNotifications(() => setNotificationRevision((value) => value + 1)), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const fullNameId = useId();
  const displayUsernameId = useId();
  const graduatingClassYearId = useId();
  const schoolEmailId = useId();

  async function load() {
    setLoading(true);
    if (!hasSupabaseConfig()) {
      setStudents([]);
      setBlocks([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const [
      { data: studentData, error: studentError },
      { data: blockData, error: blockError },
    ] = await Promise.all([
      supabase.from("student_profiles").select("*").order("created_at", { ascending: false }),
      supabase
        .from("student_email_blocks")
        .select("school_email, reason, note, blocked_at")
        .eq("is_active", true)
        .order("blocked_at", { ascending: false }),
    ]);

    if (studentError || blockError) {
      setMessage(studentError?.message ?? blockError?.message ?? "Could not load student data.");
    }

    setStudents((studentData as StudentProfile[]) ?? []);
    setBlocks((blockData as StudentBlock[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) =>
      [student.full_name, student.display_username, getStudentEmail(student), String(student.graduating_class_year)]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [searchQuery, students]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / STUDENTS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * STUDENTS_PAGE_SIZE;
  const pagedStudents = filteredStudents.slice(startIndex, startIndex + STUDENTS_PAGE_SIZE);
  const showingStart = filteredStudents.length === 0 ? 0 : startIndex + 1;
  const showingEnd = Math.min(startIndex + STUDENTS_PAGE_SIZE, filteredStudents.length);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  function startEdit(student: StudentProfile) {
    markAdminNotificationSeen("students", student.id);
    setSelectedId(student.id);
    setFullName(student.full_name);
    setDisplayUsername(student.display_username);
    setGraduatingClassYear(String(student.graduating_class_year));
    setSchoolEmail(getStudentEmail(student));
    setRemovalReason("not_in_gea");
    setRemovalNote("");
    setMessage(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !hasSupabaseConfig()) return;

    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("student_profiles")
      .update({
        full_name: fullName.trim(),
        display_username: displayUsername.trim(),
        graduating_class_year: Number.parseInt(graduatingClassYear, 10),
        school_email: schoolEmail.trim() || null,
      })
      .eq("id", selectedId);

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Student profile updated.");
    load();
  }

  async function removeAndBlacklist() {
    try {
    if (!selectedId || !hasSupabaseConfig()) return;
    if (removalReason === "other" && removalNote.trim().length === 0) {
      setMessage("Please add a short note for the removal reason.");
      return;
    }

    if (!window.confirm(`Remove ${fullName || "this student"} and block their email? Their GEA One account will be deleted. This cannot be undone.`)) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/student-accounts/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "remove",
        studentProfileId: selectedId,
        reason: removalReason,
        note: removalNote.trim() || null,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMessage(data.error ?? "Could not remove that student.");
      return;
    }

    setSelectedId(null);
    setFullName("");
    setDisplayUsername("");
    setGraduatingClassYear("");
    setSchoolEmail("");
    setRemovalReason("not_in_gea");
    setRemovalNote("");
    setMessage("Student removed and email blacklisted.");
    load();
      } catch { setMessage("Couldn’t complete this request. Check your connection and try again."); } finally { setSaving(false); }
  }

  async function unblacklist(schoolEmailValue: string) {
    try {
    if (!hasSupabaseConfig()) return;

    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/student-accounts/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unblacklist",
        schoolEmail: schoolEmailValue,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMessage(data.error ?? "Could not unblacklist that email.");
      return;
    }

    setMessage("Email removed from blacklist.");
    load();
      } catch { setMessage("Couldn’t complete this request. Check your connection and try again."); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-8">
      <section className="border-b border-forest/10 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="mt-2 text-xl font-semibold text-forest">Student profiles</h3>
          </div>
          <p className="text-sm text-graphite/80">
            {students.length} student{students.length === 1 ? "" : "s"} · {blocks.length} blocked email
            {blocks.length === 1 ? "" : "s"}
          </p>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite/80">
          Students can create GEA One accounts right away. Use the blacklist below if someone is not in GEA
          or needs to be removed for inappropriate behavior.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="border-b border-forest/10 pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-accent">Roster</p>
                <h3 className="mt-2 text-xl font-semibold text-forest">Student profiles</h3>
              </div>
              <p className="text-sm text-graphite/80">
                {filteredStudents.length} shown of {students.length}
              </p>
            </div>
            <input
              type="search"
              aria-label="Search students"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, username, email, or class year"
              className="mt-5 w-full rounded-[8px] border border-forest/65 bg-paper px-4 py-3 text-base outline-none placeholder:text-graphite/80 focus:border-gold"
            />
          </div>

          <div className="space-y-4">
            {filteredStudents.length > 0 && (
              <div className="flex flex-col gap-3 rounded-[8px] bg-paper px-4 py-3 ring-1 ring-forest/10 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-graphite/80">
                  Showing {showingStart}-{showingEnd} of {filteredStudents.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={currentPage <= 1}
                    className={`${controls.control} rounded-[8px] border border-forest/15 px-3 py-2 text-sm font-medium text-forest transition hover:bg-forest/[0.03] disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    Previous
                  </button>
                  <span className="text-sm font-medium text-graphite/80">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={currentPage >= totalPages}
                    className={`${controls.control} rounded-[8px] border border-forest/15 px-3 py-2 text-sm font-medium text-forest transition hover:bg-forest/[0.03] disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            {loading && <p className="text-sm text-graphite/80" role="status">Loading student profiles...</p>}
            {!loading && filteredStudents.length === 0 && (
              <p className="text-sm text-graphite/80" role="status">No student profiles match that search.</p>
            )}
            {pagedStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => startEdit(student)}
                className={`${controls.control} block w-full rounded-[8px] border px-5 py-4 text-left transition ${
                  selectedId === student.id
                    ? "border-gold/40 bg-gold/10"
                    : "border-forest/10 bg-paper hover:bg-forest/[0.02]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {!isAdminNotificationSeen("students", student.id) && (
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-600" title="New student" aria-label="New student" />
                    )}
                    <p className="font-display text-lg text-forest">{student.full_name}</p>
                  </div>
                  <p className="text-sm font-medium text-accent">
                    Class of {student.graduating_class_year}
                  </p>
                </div>
              </button>
            ))}
          </div>
          </div>

          <div className="border-b border-forest/10 pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-accent">Blacklist</p>
                <h3 className="mt-2 text-xl font-semibold text-forest">Blocked emails</h3>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {loading && <p className="text-sm text-graphite/80" role="status">Loading blocked emails...</p>}
              {!loading && blocks.length === 0 && (
                <p className="text-sm text-graphite/80" role="status">No emails are blocked right now.</p>
              )}
              {blocks.map((block) => (
                <div key={block.school_email} className="rounded-[8px] border border-forest/10 bg-forest/[0.02] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-forest">{block.school_email}</p>
                      <p className="mt-1 text-sm text-graphite/80">
                        {getStudentEmailBlockReasonLabel(block.reason)}
                      </p>
                      {block.note ? <p className="mt-1 text-sm text-graphite/80">{block.note}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => unblacklist(block.school_email)}
                      disabled={saving}
                      className={`${controls.control} rounded-[8px] border border-forest/15 px-4 py-2 text-sm font-medium text-forest transition hover:bg-paper disabled:opacity-50`}
                    >
                      Unblacklist
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={save} className="space-y-4 rounded-[8px] bg-forest/[0.03] p-5 ring-1 ring-forest/5">
          <p className="text-sm font-medium text-accent">Edit Profile</p>
          <p className="text-sm text-graphite/80">
            Select a student to update their profile or remove them from GEA.
          </p>
          <div>
            <label htmlFor={fullNameId} className="text-sm font-medium text-graphite/80">
              Full Name
            </label>
            <input
              id={fullNameId}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-2 w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base"
            />
          </div>
          <div>
            <label htmlFor={displayUsernameId} className="text-sm font-medium text-graphite/80">
              Display Username
            </label>
            <input
              id={displayUsernameId}
              value={displayUsername}
              onChange={(e) => setDisplayUsername(e.target.value)}
              className="mt-2 w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base"
            />
          </div>
          <div>
            <label htmlFor={graduatingClassYearId} className="text-sm font-medium text-graphite/80">
              Graduating Class Year
            </label>
            <input
              id={graduatingClassYearId}
              value={graduatingClassYear}
              onChange={(e) => setGraduatingClassYear(e.target.value)}
              className="mt-2 w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base"
            />
          </div>
          <div>
            <label htmlFor={schoolEmailId} className="text-sm font-medium text-graphite/80">
              School Email
            </label>
            <input
              id={schoolEmailId}
              value={schoolEmail}
              onChange={(e) => setSchoolEmail(e.target.value)}
              className="mt-2 w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base"
            />
          </div>

          <div className="rounded-[8px] border border-red-700/15 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">Remove Student</p>
            <p className="mt-2 text-sm text-red-800/80">
              Removing a student will delete their GEA One account and add their email to the blacklist until you unblacklist it.
            </p>
            <div className="mt-4">
              <label htmlFor="student-removal-reason" className="text-sm font-medium text-red-700">
                Why are you removing them?
              </label>
              <select
                id="student-removal-reason"
                value={removalReason}
                onChange={(e) => setRemovalReason(e.target.value as StudentEmailBlockReason)}
                className="mt-2 w-full rounded-[8px] border border-red-200 bg-white px-3 py-2 text-base outline-none focus:border-red-400"
              >
                {STUDENT_EMAIL_BLOCK_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>
            {removalReason === "other" ? (
              <div className="mt-4">
                <label htmlFor="student-removal-note" className="text-sm font-medium text-red-700">
                  Note
                </label>
                <textarea
                  id="student-removal-note"
                  value={removalNote}
                  onChange={(e) => setRemovalNote(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-[8px] border border-red-200 bg-white px-3 py-2 text-base outline-none focus:border-red-400"
                  placeholder="Add a short reason"
                />
              </div>
            ) : null}
            <button
              type="button"
              onClick={removeAndBlacklist}
              disabled={!selectedId || saving}
              className={`${controls.control} mt-4 w-full rounded-[8px] bg-red-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-800 disabled:opacity-50`}
            >
              {saving ? "Removing..." : selectedId ? "Remove & Blacklist" : "Select a Student"}
            </button>
          </div>

          {message && <p className="text-sm text-graphite/80" role="status">{message}</p>}
          <button
            type="submit"
            disabled={!selectedId || saving}
            className={`${controls.control} w-full rounded-[8px] bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forestdeep disabled:opacity-50`}
          >
            {saving ? "Saving..." : selectedId ? "Save Profile" : "Select a Student"}
          </button>
        </form>
      </div>
    </div>
  );
}
