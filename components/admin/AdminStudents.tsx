"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import {
  STUDENT_EMAIL_BLOCK_REASONS,
  getStudentEmailBlockReasonLabel,
  type StudentEmailBlockReason,
} from "@/lib/student-access";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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

  const filteredStudents = students.filter((student) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [student.full_name, student.display_username, getStudentEmail(student), String(student.graduating_class_year)]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  function startEdit(student: StudentProfile) {
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
    if (!selectedId || !hasSupabaseConfig()) return;
    if (removalReason === "other" && removalNote.trim().length === 0) {
      setMessage("Please add a short note for the removal reason.");
      return;
    }

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
  }

  async function unblacklist(schoolEmailValue: string) {
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
  }

  return (
    <div className="space-y-8">
      <section className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Students</p>
            <h3 className="mt-2 font-display text-2xl text-forest">Student profiles</h3>
          </div>
          <p className="text-sm text-graphite/60">
            {students.length} student{students.length === 1 ? "" : "s"} · {blocks.length} blocked email
            {blocks.length === 1 ? "" : "s"}
          </p>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite/70">
          Students can create accounts right away. Use the blacklist below if someone is not in GEA
          or needs to be removed for inappropriate behavior.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Roster</p>
                <h3 className="mt-2 font-display text-2xl text-forest">Student profiles</h3>
              </div>
              <p className="text-sm text-graphite/60">
                {filteredStudents.length} shown of {students.length}
              </p>
            </div>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, username, email, or class year"
              className="mt-5 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none placeholder:text-graphite/40 focus:border-gold"
            />
          </div>

          <div className="space-y-3">
            {loading && <p className="text-sm text-graphite/50">Loading student profiles...</p>}
            {!loading && filteredStudents.length === 0 && (
              <p className="text-sm text-graphite/50">No student profiles match that search.</p>
            )}
            {filteredStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => startEdit(student)}
                className={`w-full rounded-sm border px-5 py-4 text-left transition ${
                  selectedId === student.id
                    ? "border-gold/40 bg-gold/10"
                    : "border-forest/10 bg-paper hover:bg-forest/[0.02]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg text-forest">{student.full_name}</p>
                    <p className="text-xs text-graphite/60">{getStudentEmail(student)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">
                      Class of {student.graduating_class_year}
                    </p>
                    <p className="mt-1 text-xs text-graphite/50">@{student.display_username}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Blacklist</p>
                <h3 className="mt-2 font-display text-2xl text-forest">Blocked emails</h3>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {loading && <p className="text-sm text-graphite/50">Loading blocked emails...</p>}
              {!loading && blocks.length === 0 && (
                <p className="text-sm text-graphite/50">No emails are blocked right now.</p>
              )}
              {blocks.map((block) => (
                <div key={block.school_email} className="rounded-sm border border-forest/10 bg-forest/[0.02] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-forest">{block.school_email}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/50">
                        {getStudentEmailBlockReasonLabel(block.reason)}
                      </p>
                      {block.note ? <p className="mt-1 text-sm text-graphite/65">{block.note}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => unblacklist(block.school_email)}
                      disabled={saving}
                      className="rounded-sm border border-forest/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-forest transition hover:bg-paper disabled:opacity-50"
                    >
                      Unblacklist
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={save} className="space-y-4 rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Edit Profile</p>
          <p className="text-sm text-graphite/60">
            Select a student to update their profile or remove them from GEA.
          </p>
          <div>
            <label htmlFor={fullNameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Full Name
            </label>
            <input
              id={fullNameId}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={displayUsernameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Display Username
            </label>
            <input
              id={displayUsernameId}
              value={displayUsername}
              onChange={(e) => setDisplayUsername(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={graduatingClassYearId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Graduating Class Year
            </label>
            <input
              id={graduatingClassYearId}
              value={graduatingClassYear}
              onChange={(e) => setGraduatingClassYear(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={schoolEmailId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              School Email
            </label>
            <input
              id={schoolEmailId}
              value={schoolEmail}
              onChange={(e) => setSchoolEmail(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-sm border border-red-700/15 bg-red-50 p-4">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-red-700">Remove Student</p>
            <p className="mt-2 text-sm text-red-800/80">
              Removing a student will delete their account and add their email to the blacklist until you unblacklist it.
            </p>
            <div className="mt-4">
              <label className="font-mono text-xs uppercase tracking-[0.15em] text-red-700">
                Why are you removing them?
              </label>
              <select
                value={removalReason}
                onChange={(e) => setRemovalReason(e.target.value as StudentEmailBlockReason)}
                className="mt-2 w-full rounded-sm border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
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
                <label className="font-mono text-xs uppercase tracking-[0.15em] text-red-700">
                  Note
                </label>
                <textarea
                  value={removalNote}
                  onChange={(e) => setRemovalNote(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-sm border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
                  placeholder="Add a short reason"
                />
              </div>
            ) : null}
            <button
              type="button"
              onClick={removeAndBlacklist}
              disabled={!selectedId || saving}
              className="mt-4 w-full rounded-sm bg-red-700 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-white transition hover:bg-red-800 disabled:opacity-50"
            >
              {saving ? "Removing..." : selectedId ? "Remove & Blacklist" : "Select a Student"}
            </button>
          </div>

          {message && <p className="text-sm text-graphite/70">{message}</p>}
          <button
            type="submit"
            disabled={!selectedId || saving}
            className="w-full rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
          >
            {saving ? "Saving..." : selectedId ? "Save Profile" : "Select a Student"}
          </button>
        </form>
      </div>
    </div>
  );
}
