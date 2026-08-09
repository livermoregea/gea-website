"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type StudentProfile = {
  id: string;
  full_name: string;
  display_username: string;
  graduating_class_year: number;
  school_email: string | null;
  auth_email: string;
};

type TeacherProfile = {
  id: string;
  full_name: string;
  school_email: string;
  auth_email: string;
};

type ProfileChangeRequest = {
  id: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  requested_fields: Record<string, unknown>;
  current_fields: Record<string, unknown>;
};

type Props =
  | {
      kind: "student";
      profile: StudentProfile;
      latestRequest?: ProfileChangeRequest | null;
    }
  | {
      kind: "teacher";
      profile: TeacherProfile;
      latestRequest?: ProfileChangeRequest | null;
    };

export default function ProfileEditor(props: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fullName, setFullName] = useState(props.profile.full_name);
  const [schoolEmail, setSchoolEmail] = useState(props.profile.school_email ?? props.profile.auth_email);
  const [displayUsername, setDisplayUsername] = useState(
    props.kind === "student" ? props.profile.display_username : ""
  );
  const [graduatingClassYear, setGraduatingClassYear] = useState(
    props.kind === "student" ? String(props.profile.graduating_class_year) : ""
  );

  const fullNameId = useId();
  const schoolEmailId = useId();
  const displayUsernameId = useId();
  const graduatingClassYearId = useId();

  const hasPendingRequest = props.latestRequest?.status === "pending";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!hasSupabaseConfig()) {
      setMessage("Profile change requests are disabled in demo mode.");
      return;
    }

    if (hasPendingRequest) {
      setMessage("You already have a pending profile change request.");
      return;
    }

    const trimmedFullName = fullName.trim();
    const trimmedSchoolEmail = schoolEmail.trim().toLowerCase();
    if (!trimmedFullName || !trimmedSchoolEmail) {
      setMessage("Please fill out the required fields.");
      return;
    }

    const requestedFields =
      props.kind === "student"
        ? {
            full_name: trimmedFullName,
            display_username: displayUsername.trim(),
            graduating_class_year: Number.parseInt(graduatingClassYear.trim(), 10),
            school_email: trimmedSchoolEmail,
          }
        : {
            full_name: trimmedFullName,
            school_email: trimmedSchoolEmail,
          };

    if (props.kind === "student" && (!requestedFields.display_username || Number.isNaN(requestedFields.graduating_class_year))) {
      setMessage("Please provide a display username and a valid graduating class year.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.from("profile_change_requests").insert({
      profile_type: props.kind,
      profile_id: props.profile.id,
      auth_user_id: hasSupabaseConfig() ? (await supabase.auth.getUser()).data.user?.id ?? null : null,
      requested_by_name: props.profile.full_name,
      current_fields:
        props.kind === "student"
          ? {
              full_name: props.profile.full_name,
              display_username: props.profile.display_username,
              graduating_class_year: props.profile.graduating_class_year,
              school_email: props.profile.school_email ?? props.profile.auth_email,
            }
          : {
              full_name: props.profile.full_name,
              school_email: props.profile.school_email,
            },
      requested_fields: requestedFields,
      status: "pending",
    });
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Your profile change request was submitted for admin review.");
    router.refresh();
  }

  if (hasPendingRequest) {
    return (
      <div className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Pending Review</p>
        <h2 className="mt-2 font-display text-xl text-forest">Your change request is waiting</h2>
        <p className="mt-3 text-sm text-graphite/70">
          You already have a profile change request in the queue. An admin needs to approve it
          before the update is applied.
        </p>
        {props.latestRequest?.rejection_reason && props.latestRequest.status === "rejected" ? (
          <p className="mt-3 rounded-sm bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
            Rejected: {props.latestRequest.rejection_reason}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
      {props.latestRequest && props.latestRequest.status !== "pending" ? (
        <div className="rounded-sm bg-paper p-4 ring-1 ring-forest/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
            Last Request
          </p>
          <p className="mt-2 text-sm text-graphite/70">
            Your most recent request was {props.latestRequest.status}.
          </p>
          {props.latestRequest.rejection_reason ? (
            <p className="mt-2 text-sm text-red-700">
              Rejection reason: {props.latestRequest.rejection_reason}
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <label htmlFor={fullNameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
          Full Name
        </label>
        <input
          id={fullNameId}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
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
          className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
        />
      </div>

      {props.kind === "student" ? (
        <>
          <div>
            <label htmlFor={displayUsernameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Display Username
            </label>
            <input
              id={displayUsernameId}
              value={displayUsername}
              onChange={(e) => setDisplayUsername(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
            />
          </div>
          <div>
            <label htmlFor={graduatingClassYearId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Graduating Class Year
            </label>
            <input
              id={graduatingClassYearId}
              inputMode="numeric"
              value={graduatingClassYear}
              onChange={(e) => setGraduatingClassYear(e.target.value)}
              className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
            />
          </div>
        </>
      ) : null}

      {message && <p className="text-sm text-graphite/70">{message}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-sm bg-forest px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
      >
        {saving ? "Submitting..." : "Request Approval"}
      </button>
    </form>
  );
}
