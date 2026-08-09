"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import QuestionContent from "@/components/QuestionContent";

type Question = {
  id: string;
  question: string;
  asked_by_name: string;
  status: string;
  rejection_reason: string | null;
};
type Answer = {
  id: string;
  answer: string;
  answered_by_name: string;
  status: string;
  question_id: string;
  rejection_reason: string | null;
};

export default function AdminQA() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [questionRejectionReasons, setQuestionRejectionReasons] = useState<Record<string, string>>({});
  const [answerRejectionReasons, setAnswerRejectionReasons] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    if (!hasSupabaseConfig()) {
      setQuestions([]);
      setAnswers([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [{ data: q }, { data: a }] = await Promise.all([
      supabase.from("qa_questions").select("*").eq("status", "pending").order("created_at", { ascending: true }),
      supabase.from("qa_answers").select("*").eq("status", "pending").order("created_at", { ascending: true }),
    ]);
    setQuestions((q as Question[]) ?? []);
    setAnswers((a as Answer[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setQuestionStatus(id: string, status: string) {
    if (!hasSupabaseConfig()) return;
    const supabase = createClient();
    await supabase.from("qa_questions").update({ status }).eq("id", id);
    load();
  }

  async function setQuestionRejection(id: string) {
    if (!hasSupabaseConfig()) return;
    const supabase = createClient();
    const rejection_reason = questionRejectionReasons[id]?.trim();
    if (!rejection_reason) {
      setMessage("Please write a rejection reason before rejecting a question.");
      return;
    }
    await supabase
      .from("qa_questions")
      .update({ status: "rejected", rejection_reason: rejection_reason || null })
      .eq("id", id);
    setQuestionRejectionReasons((current) => ({ ...current, [id]: "" }));
    setMessage(null);
    load();
  }

  async function setAnswerStatus(id: string, status: string) {
    if (!hasSupabaseConfig()) return;
    const supabase = createClient();
    await supabase.from("qa_answers").update({ status }).eq("id", id);
    load();
  }

  async function setAnswerRejection(id: string) {
    if (!hasSupabaseConfig()) return;
    const supabase = createClient();
    const rejection_reason = answerRejectionReasons[id]?.trim();
    if (!rejection_reason) {
      setMessage("Please write a rejection reason before rejecting an answer.");
      return;
    }
    await supabase
      .from("qa_answers")
      .update({ status: "rejected", rejection_reason: rejection_reason || null })
      .eq("id", id);
    setAnswerRejectionReasons((current) => ({ ...current, [id]: "" }));
    setMessage(null);
    load();
  }

  if (loading) return <p className="text-sm text-graphite/50">Loading...</p>;

  return (
    <div className="grid gap-10 md:grid-cols-2">
      {message && (
        <p className="md:col-span-2 rounded-sm bg-forest/[0.05] p-4 text-sm text-graphite/80 ring-1 ring-forest/10">
          {message}
        </p>
      )}
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Pending Questions</p>
        <div className="mt-4 space-y-3">
          {questions.length === 0 && <p className="text-sm text-graphite/50">Nothing pending.</p>}
          {questions.map((q) => (
            <div key={q.id} className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/5">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                {q.asked_by_name}
              </p>
              <QuestionContent question={q.question} className="mt-1" />
              <textarea
                value={questionRejectionReasons[q.id] ?? ""}
                onChange={(e) =>
                  setQuestionRejectionReasons((current) => ({ ...current, [q.id]: e.target.value }))
                }
                rows={2}
                placeholder="Reason for rejection (required if you reject this question)"
                className="mt-3 w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
              />
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => setQuestionStatus(q.id, "approved")}
                  className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-forest hover:underline"
                >
                  Approve
                </button>
                <button
                  onClick={() => setQuestionRejection(q.id)}
                  className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-red-700 hover:underline"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Pending Answers</p>
        <div className="mt-4 space-y-3">
          {answers.length === 0 && <p className="text-sm text-graphite/50">Nothing pending.</p>}
          {answers.map((a) => (
            <div key={a.id} className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/5">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                {a.answered_by_name}
              </p>
              <p className="mt-1 text-sm text-graphite whitespace-pre-wrap">{a.answer}</p>
              <textarea
                value={answerRejectionReasons[a.id] ?? ""}
                onChange={(e) =>
                  setAnswerRejectionReasons((current) => ({ ...current, [a.id]: e.target.value }))
                }
                rows={2}
                placeholder="Reason for rejection (required if you reject this answer)"
                className="mt-3 w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
              />
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => setAnswerStatus(a.id, "approved")}
                  className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-forest hover:underline"
                >
                  Approve
                </button>
                <button
                  onClick={() => setAnswerRejection(a.id)}
                  className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-red-700 hover:underline"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
