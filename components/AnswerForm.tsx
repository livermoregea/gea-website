"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default function AnswerForm({
  questionId,
  answeredByName,
  onSubmitted,
}: {
  questionId: string;
  answeredByName: string;
  onSubmitted: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (answer.trim().length < 3) return;
    setSubmitting(true);
    setError(null);
    if (!hasSupabaseConfig()) {
      setSubmitting(false);
      setAnswer("");
      onSubmitted();
      return;
    }
    const supabase = createClient();
    const { error: insertError } = await supabase.from("qa_answers").insert({
      question_id: questionId,
      answer: answer.trim(),
      answered_by_name: answeredByName,
      status: "pending",
    });
    setSubmitting(false);
    if (insertError) {
      setError("Couldn't submit that answer. Please try again.");
      return;
    }
    setAnswer("");
    onSubmitted();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <textarea
        id={answerId}
        required
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        placeholder="Write your answer..."
        className="w-full rounded-sm border border-forest/15 bg-paper px-4 py-2.5 text-sm outline-none focus:border-gold"
      />
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-sm bg-forest px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Answer for Approval"}
      </button>
    </form>
  );
}
