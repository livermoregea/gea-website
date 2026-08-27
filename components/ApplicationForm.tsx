"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSchoolEmail } from "@/lib/roles";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Props = {
  roleSlug: string;
  roleLabel: string;
  requiresProof: boolean;
  profile?: {
    id: string;
    auth_user_id: string;
    auth_email: string;
    full_name: string;
    display_username: string;
    graduating_class_year: number;
    student_id_number: string;
    school_email: string | null;
  } | null;
  authUserId?: string | null;
};

export default function ApplicationForm({
  roleSlug,
  roleLabel,
  requiresProof,
  profile,
  authUserId,
}: Props) {
  const [name, setName] = useState(profile?.full_name ?? "");
  const [email, setEmail] = useState(profile?.school_email ?? "");
  const [graduatingYear, setGraduatingYear] = useState(
    profile?.graduating_class_year ? String(profile.graduating_class_year) : ""
  );
  const [studentIdNumber, setStudentIdNumber] = useState(profile?.student_id_number ?? "");
  const [whyApply, setWhyApply] = useState("");
  const [whyFit, setWhyFit] = useState("");
  const [proofOfWork, setProofOfWork] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [geaConfirmed, setGeaConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const nameId = useId();
  const emailId = useId();
  const graduatingYearId = useId();
  const studentIdNumberId = useId();
  const whyApplyId = useId();
  const whyFitId = useId();
  const proofId = useId();
  const geaConfirmedId = useId();
  const agreedId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isSchoolEmail(email)) {
      setError(
        "Please use your official school email address so we can verify you're a current student."
      );
      return;
    }
    const graduatingYearValue = Number.parseInt(graduatingYear.trim(), 10);
    if (!Number.isInteger(graduatingYearValue) || graduatingYearValue < 2000) {
      setError("Please enter a valid graduating class year.");
      return;
    }
    if (!studentIdNumber.trim()) {
      setError("Please enter your student ID number.");
      return;
    }
    if (!geaConfirmed) {
      setError("Please confirm that you are in the Green Engineering Academy (GEA).");
      return;
    }
    if (requiresProof && proofOfWork.trim().length === 0) {
      setError(
        "Because of past issues with unverifiable publicist applications, a link or description of your prior work is required for this role."
      );
      return;
    }
    if (!agreed) {
      setError("Please confirm you understand this is only an application before submitting.");
      return;
    }

    setSubmitting(true);
    if (!hasSupabaseConfig()) {
      setSubmitting(false);
      setDone(true);
      return;
    }
    const supabase = createClient();
    const { error: insertError } = await supabase.from("applications").insert({
      role: roleSlug,
      name: name.trim(),
      student_profile_id: profile?.id ?? null,
      auth_user_id: authUserId ?? null,
      display_username: profile?.display_username ?? null,
      graduating_class_year: graduatingYearValue,
      student_id_number: studentIdNumber.trim(),
      school_email: email.trim().toLowerCase(),
      why_apply: whyApply.trim(),
      why_fit: whyFit.trim(),
      proof_of_work: requiresProof ? proofOfWork.trim() : null,
      status: "pending",
    });
    setSubmitting(false);

    if (insertError) {
      setError("Something went wrong submitting your application. Please try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-sm bg-forest/[0.04] p-8 text-center ring-1 ring-forest/10" aria-live="polite">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Application Received</p>
        <h2 className="mt-3 font-display text-xl text-forest">Thanks, {name.split(" ")[0]}.</h2>
        <p className="mt-3 text-sm text-graphite/70">
          Your application for {roleLabel} has been submitted. If the officer team would like to
          move forward, we&apos;ll email you at the school address you provided with a link to
          book an interview during lunch.
        </p>
        {authUserId ? (
          <p className="mt-3 text-sm text-graphite/70">
            You can come back to the{" "}
            <Link href="/leadership" className="text-forest underline decoration-gold underline-offset-4">
              leadership page
            </Link>{" "}
            after signing in to check this application&apos;s status anytime.
          </p>
        ) : (
          <p className="mt-3 text-sm text-graphite/70">
            If you want the site to remember this application, sign in before applying next time so
            we can show your status on the leadership page.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {profile && (
        <div className="rounded-sm bg-paper p-4 ring-1 ring-forest/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Using Student Profile</p>
          <p className="mt-2 text-sm text-graphite/80">
            {profile.full_name} - @{profile.display_username} - Class of {profile.graduating_class_year}
          </p>
        </div>
      )}

      <div>
        <label htmlFor={nameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
          Full Name
        </label>
        <input
          id={nameId}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm text-graphite outline-none focus:border-gold"
          placeholder="First and last name"
        />
      </div>

      <div>
        <label htmlFor={emailId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
          School Email
        </label>
        <input
          id={emailId}
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm text-graphite outline-none focus:border-gold"
          placeholder="you@mail.lvjusd.org"
        />
        <p className="mt-1 text-xs text-graphite/50">
          Must be your official school email — this is where we&apos;ll send an interview invite.
        </p>
      </div>

      <div>
        <label
          htmlFor={graduatingYearId}
          className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70"
        >
          Graduating Year
        </label>
        <div className="mt-2 flex items-center gap-3">
          <span className="font-mono text-sm uppercase tracking-[0.15em] text-graphite/60">
            Class of
          </span>
          <input
            id={graduatingYearId}
            required
            inputMode="numeric"
            pattern="[0-9]*"
            value={graduatingYear}
            onChange={(e) => setGraduatingYear(e.target.value)}
            className="w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm text-graphite outline-none focus:border-gold sm:max-w-[14rem]"
            placeholder="2027"
          />
        </div>
        <p className="mt-1 text-xs text-graphite/50">
          Please enter the year your class graduates from Livermore High School.
        </p>
      </div>

      <div>
        <label
          htmlFor={studentIdNumberId}
          className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70"
        >
          Student ID Number
        </label>
        <input
          id={studentIdNumberId}
          required
          value={studentIdNumber}
          onChange={(e) => setStudentIdNumber(e.target.value)}
          className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm text-graphite outline-none focus:border-gold"
          placeholder="Student ID number"
        />
      </div>

      <div>
        <label htmlFor={whyApplyId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
          Why would you like to apply for {roleLabel}?
        </label>
        <textarea
          id={whyApplyId}
          required
          value={whyApply}
          onChange={(e) => setWhyApply(e.target.value)}
          rows={4}
          className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm text-graphite outline-none focus:border-gold"
        />
      </div>

      <div>
        <label htmlFor={whyFitId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
          Why do you think you&apos;d be a good fit for this position?
        </label>
        <textarea
          id={whyFitId}
          required
          value={whyFit}
          onChange={(e) => setWhyFit(e.target.value)}
          rows={4}
          className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm text-graphite outline-none focus:border-gold"
        />
      </div>

      {requiresProof && (
        <div>
          <label htmlFor={proofId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
            Proof of prior work (required for Publicist)
          </label>
          <textarea
            id={proofId}
            required
            value={proofOfWork}
            onChange={(e) => setProofOfWork(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm text-graphite outline-none focus:border-gold"
            placeholder="Links to designs, posts, flyers, videos, or a description of past publicity work you've done."
          />
          <p className="mt-1 text-xs text-graphite/50">
            We ask every publicist applicant for this directly, after past issues with applicants
            overstating their experience.
          </p>
        </div>
      )}

      <label
        htmlFor={geaConfirmedId}
        className="flex items-center gap-3 rounded-sm bg-forest/[0.04] p-4 text-xs leading-relaxed text-graphite/70"
      >
        <input
          id={geaConfirmedId}
          type="checkbox"
          checked={geaConfirmed}
          onChange={(e) => setGeaConfirmed(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-forest"
        />
        <span className="flex-1">
          I confirm I am in the Green Engineering Academy (GEA).
        </span>
      </label>

      <label
        htmlFor={agreedId}
        className="flex items-center gap-3 rounded-sm bg-forest/[0.04] p-4 text-xs leading-relaxed text-graphite/70"
      >
        <input
          id={agreedId}
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-forest"
        />
        <span className="flex-1">
          I understand that submitting this application does <strong>not</strong> guarantee me a
          position. This is only an application, and I won&apos;t be able to edit it after
          submitting. If I want to add anything later, I can mention it during the interview. If
          selected, I will be contacted at the email above to schedule an interview during lunch.
        </span>
      </label>

      {error && (
        <p className="rounded-sm bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-sm bg-forest px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}
