"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Question = { id: string; question: string; asked_by_name: string; status: string };
type Answer = { id: string; answer: string; answered_by_name: string; status: string; question_id: string };

export default function AdminQA() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function setAnswerStatus(id: string, status: string) {
    if (!hasSupabaseConfig()) return;
    const supabase = createClient();
    await supabase.from("qa_answers").update({ status }).eq("id", id);
    load();
  }

  if (loading) return <p className="text-sm text-graphite/50">Loading...</p>;

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Pending Questions</p>
        <div className="mt-4 space-y-3">
          {questions.length === 0 && <p className="text-sm text-graphite/50">Nothing pending.</p>}
          {questions.map((q) => (
            <div key={q.id} className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/5">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                {q.asked_by_name}
              </p>
              <p className="mt-1 text-sm text-graphite">{q.question}</p>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => setQuestionStatus(q.id, "approved")}
                  className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-forest hover:underline"
                >
                  Approve
                </button>
                <button
                  onClick={() => setQuestionStatus(q.id, "rejected")}
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
              <p className="mt-1 text-sm text-graphite">{a.answer}</p>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => setAnswerStatus(a.id, "approved")}
                  className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-forest hover:underline"
                >
                  Approve
                </button>
                <button
                  onClick={() => setAnswerStatus(a.id, "rejected")}
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
