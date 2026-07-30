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

export default function AdminStudents() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("student_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setStudents((data as StudentProfile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-3">
        {loading && <p className="text-sm text-graphite/50">Loading student profiles...</p>}
        {!loading && students.length === 0 && (
          <p className="text-sm text-graphite/50">No student profiles yet.</p>
        )}
        {students.map((student) => (
          <div key={student.id} className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg text-forest">{student.full_name}</p>
                <p className="text-xs text-graphite/60">{student.school_email ?? "No school email"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => startEdit(student)}
                  className="rounded-sm border border-forest/15 px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-forest"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={save} className="space-y-4 rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Edit Profile</p>
        <p className="text-sm text-graphite/60">
          Pick a student from the list to edit their unified account record.
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
  );
}
