"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import AnswerForm from "@/components/AnswerForm";

type Question = {
  id: string;
  question: string;
  asked_by_name: string;
  created_at: string;
};

export default function QuestionQueue({ answeredByName }: { answeredByName: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    if (!hasSupabaseConfig()) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("qa_questions")
      .select("id, question, asked_by_name, created_at, qa_answers(status)")
      .eq("status", "approved")
      .order("created_at", { ascending: true });
    const unanswered = (data ?? []).filter(
      (q: any) => !(q.qa_answers ?? []).some((a: any) => a.status === "approved")
    );
    setQuestions(unanswered as Question[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p className="text-sm text-graphite/50">Loading questions...</p>;
  if (questions.length === 0)
    return <p className="text-sm text-graphite/50">No approved questions waiting for an answer right now.</p>;

  return (
    <div className="space-y-6">
      {questions.map((q) =>
        answeredIds.includes(q.id) ? null : (
          <div key={q.id} className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">{q.asked_by_name}</p>
            <p className="mt-2 font-display text-base text-forest">{q.question}</p>
            <AnswerForm
              questionId={q.id}
              answeredByName={answeredByName}
              onSubmitted={() => setAnsweredIds((ids) => [...ids, q.id])}
            />
          </div>
        )
      )}
    </div>
  );
}
