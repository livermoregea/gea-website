"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { getForumSafetyMessage } from "@/lib/forumSafety";
import { FORUM_BOARDS, ForumBoard, isForumBoard } from "@/lib/forumBoards";

export default function AskQuestionForm({
  defaultName = "",
  authUserId = null,
  defaultBoard = "general",
  onSubmitted,
}: {
  defaultName?: string;
  authUserId?: string | null;
  defaultBoard?: string;
  onSubmitted?: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [question, setQuestion] = useState("");
  const [board, setBoard] = useState<ForumBoard>(isForumBoard(defaultBoard) ? defaultBoard : "general");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const questionId = useId();
  const boardId = useId();

  function resetForm() {
    setName(defaultName);
    setQuestion("");
    setBoard(isForumBoard(defaultBoard) ? defaultBoard : "general");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (question.trim().length < 3) {
      setError("Add a little more detail to your question.");
      return;
    }

    const safetyMessage = getForumSafetyMessage(question);
    if (safetyMessage) {
      setError(safetyMessage);
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
      forum_board: board,
      equation_lines: null,
      work_text: null,
      graph_notes: null,
      graph_link: null,
      asked_by_name: authUserId ? name.trim() || defaultName || "GEA Student" : name.trim() || "Anonymous Student",
      asked_by_auth_user_id: authUserId,
      status: "approved",
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
      <div className="rounded-2xl border border-forest/10 bg-paper p-5 text-sm text-graphite/70" aria-live="polite">
        Thanks - your post is live and will show up in the forum right away.
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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-forest/10 bg-paper p-5">
      <div>
        <label htmlFor={nameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/60">
          Display name (optional)
        </label>
        <input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 w-full rounded-xl border border-forest/15 bg-paper px-4 py-3 text-sm text-graphite outline-none placeholder:text-graphite/40 focus:border-gold"
          placeholder="Leave blank to stay anonymous"
        />
        {authUserId && (
          <p className="mt-1 text-xs text-graphite/50">
            Your signed-in account will be attached to this post so you can find it later.
          </p>
        )}
      </div>

      <div>
        <label htmlFor={boardId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/60">
          Board
        </label>
        <select
          id={boardId}
          value={board}
          onChange={(e) => setBoard(e.target.value as ForumBoard)}
          className="mt-2 w-full rounded-xl border border-forest/15 bg-paper px-4 py-3 text-sm text-graphite outline-none focus:border-gold"
        >
          {FORUM_BOARDS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-graphite/50">
          Pick the board that best matches what you want to post.
        </p>
      </div>

      <div>
        <label htmlFor={questionId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/60">
          Your post
        </label>
        <textarea
          id={questionId}
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
          className="mt-2 w-full rounded-xl border border-forest/15 bg-paper px-4 py-3 text-sm text-graphite outline-none placeholder:text-graphite/40 focus:border-gold"
          placeholder="Example: What should incoming students know about the academy?"
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
        className="rounded-full bg-forest px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
      >
        {submitting ? "Posting..." : "Post to forum"}
      </button>
      <p className="text-xs text-graphite/50">
        Posts are published immediately unless they trip the safety filter.
      </p>
    </form>
  );
}
