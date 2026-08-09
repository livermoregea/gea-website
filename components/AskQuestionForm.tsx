"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default function AskQuestionForm({
  defaultName = "",
  authUserId = null,
  onSubmitted,
}: {
  defaultName?: string;
  authUserId?: string | null;
  onSubmitted?: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const questionId = useId();

  function resetForm() {
    setName(defaultName);
    setQuestion("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (question.trim().length < 3) {
      setError("Add a little more detail to your question.");
      return;
    }

    setSubmitting(true);
    setError(null);

    if (!hasSupabaseConfig()) {
      setSubmitting(false);
      setDone(true);
      resetForm();
      return;
    }

    const supabase = createClient();
    const { error: insertError } = await supabase.from("qa_questions").insert({
      question: question.trim(),
      question_type: "general",
      equation_lines: null,
      work_text: null,
      graph_notes: null,
      graph_link: null,
      asked_by_name: authUserId ? name.trim() || defaultName || "GEA Student" : name.trim() || "Anonymous Student",
      asked_by_auth_user_id: authUserId,
      status: "pending",
    });
    setSubmitting(false);

    if (insertError) {
      setError("Couldn't submit your question. Please try again.");
      return;
    }

    setDone(true);
    resetForm();
    onSubmitted?.();
  }

  if (done) {
    return (
      <div className="rounded-sm bg-forest/[0.04] p-6 text-sm text-graphite/70 ring-1 ring-forest/10" aria-live="polite">
        Thanks - your question was submitted and will appear here once an admin approves it and a
        student answers.
        <button
          onClick={() => setDone(false)}
          className="ml-2 font-mono text-xs uppercase tracking-[0.15em] text-forest underline"
        >
          Ask another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
      <div>
        <label htmlFor={nameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
          Your name (optional)
        </label>
        <input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-2.5 text-sm outline-none focus:border-gold"
          placeholder="Leave blank to stay anonymous"
        />
        {authUserId && (
          <p className="mt-1 text-xs text-graphite/50">
            Your signed-in account will be attached to this question so you can find it later.
          </p>
        )}
      </div>

      <div>
        <label htmlFor={questionId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
          Your question
        </label>
        <textarea
          id={questionId}
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
          className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-2.5 text-sm outline-none focus:border-gold"
          placeholder="Example: Can I join GEA as a sophomore?"
        />
      </div>

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-sm bg-forest px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Question"}
      </button>
      <p className="text-xs text-graphite/50">
        Questions are reviewed by an admin before they&apos;re posted publicly.
      </p>
    </form>
  );
}
