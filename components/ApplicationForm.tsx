"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSchoolEmail } from "@/lib/roles";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Props = {
  roleSlug: string;
  roleLabel: string;
  requiresProof: boolean;
};

export default function ApplicationForm({ roleSlug, roleLabel, requiresProof }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whyApply, setWhyApply] = useState("");
  const [whyFit, setWhyFit] = useState("");
  const [proofOfWork, setProofOfWork] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const nameId = useId();
  const emailId = useId();
  const whyApplyId = useId();
  const whyFitId = useId();
  const proofId = useId();
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
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <label htmlFor={agreedId} className="flex items-start gap-3 rounded-sm bg-forest/[0.04] p-4 text-xs leading-relaxed text-graphite/70">
        <input
          id={agreedId}
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
        />
        <span>
          I understand that submitting this application does <strong>not</strong> guarantee me a
          position. This is only an application — if selected, I will be contacted at the email
          above to schedule an interview during lunch.
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
