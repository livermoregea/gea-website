"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type StudentProfile = {
  id: string;
  full_name: string;
  display_username: string;
  graduating_class_year: number;
  school_email: string | null;
  created_at: string;
};

type StudentRequest = {
  id: string;
  full_name: string;
  display_username: string;
  school_email: string;
  graduating_class_year: number;
  student_id_number: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export default function AdminStudents() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fullName, setFullName] = useState("");
  const [displayUsername, setDisplayUsername] = useState("");
  const [graduatingClassYear, setGraduatingClassYear] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
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
      setRequests([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [{ data: studentData }, { data: requestData }] = await Promise.all([
      supabase.from("student_profiles").select("*").order("created_at", { ascending: false }),
      supabase
        .from("student_account_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
    ]);
    setStudents((studentData as StudentProfile[]) ?? []);
    setRequests((requestData as StudentRequest[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredStudents = students.filter((student) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      student.full_name,
      student.display_username,
      student.school_email ?? "",
      String(student.graduating_class_year),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  function startEdit(student: StudentProfile) {
    setSelectedId(student.id);
    setFullName(student.full_name);
    setDisplayUsername(student.display_username);
    setGraduatingClassYear(String(student.graduating_class_year));
    setSchoolEmail(student.school_email ?? "");
    setMessage(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    if (!hasSupabaseConfig()) return;

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

  async function reviewRequest(requestId: string, action: "approve" | "reject") {
    if (!hasSupabaseConfig()) return;
    const rejectionReason =
      action === "reject"
        ? window.prompt("Optional rejection reason:", "Does not appear to be a GEA student")
        : null;
    const res = await fetch("/api/student-accounts/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        action,
        rejectionReason,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Could not update the student request.");
      return;
    }
    setMessage(action === "approve" ? "Student request approved." : "Student request rejected.");
    load();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Approvals</p>
            <h3 className="mt-2 font-display text-2xl text-forest">Student access requests</h3>
          </div>
          <p className="text-sm text-graphite/60">
            {requests.length} pending request{requests.length === 1 ? "" : "s"}
          </p>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite/70">
          Approve these requests only for verified GEA students. Approval creates the student
          account and enables forum access.
        </p>
      </section>

      <div className="space-y-3">
        {loading && <p className="text-sm text-graphite/50">Loading student requests...</p>}
        {!loading && requests.length === 0 && (
          <p className="text-sm text-graphite/50">No pending student requests.</p>
        )}
        {requests.map((request) => (
          <div key={request.id} className="rounded-sm border border-forest/10 bg-paper p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg text-forest">{request.full_name}</p>
                <p className="mt-1 text-sm text-graphite/60">
                  {request.school_email} · @{request.display_username}
                </p>
                <p className="mt-1 text-sm text-graphite/60">
                  Class of {request.graduating_class_year} · Student ID {request.student_id_number}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => reviewRequest(request.id, "approve")}
                  className="rounded-sm bg-forest px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => reviewRequest(request.id, "reject")}
                  className="rounded-sm border border-red-700/20 px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-red-700 transition hover:bg-red-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
        <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Students</p>
              <h3 className="mt-2 font-display text-2xl text-forest">Student profiles</h3>
            </div>
            <p className="text-sm text-graphite/60">{filteredStudents.length} shown of {students.length}</p>
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
                  <p className="text-xs text-graphite/60">{student.school_email ?? "No school email"}</p>
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
      </div>

      <form onSubmit={save} className="space-y-4 rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Edit Profile</p>
        <p className="text-sm text-graphite/60">
          Select a student from the list to edit their account record.
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
