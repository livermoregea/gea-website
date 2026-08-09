"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import AskQuestionForm from "@/components/AskQuestionForm";
import QuestionQueue from "@/components/QuestionQueue";

type PublicAnswer = {
  id: string;
  answer: string;
  answered_by_name: string;
  created_at: string;
  status: string;
  rejection_reason: string | null;
};

type PublicQuestion = {
  id: string;
  question: string;
  asked_by_name: string;
  created_at: string;
  status: string;
  rejection_reason: string | null;
  qa_answers: PublicAnswer[];
};

type MyQuestion = {
  id: string;
  question: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  qa_answers: PublicAnswer[];
};

type MyAnswer = {
  id: string;
  answer: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  question: { question: string; status: string } | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function QAHub({
  authUserId,
  displayName,
}: {
  authUserId: string | null;
  displayName: string | null;
}) {
  const [publicQuestions, setPublicQuestions] = useState<PublicQuestion[]>([]);
  const [myQuestions, setMyQuestions] = useState<MyQuestion[]>([]);
  const [myAnswers, setMyAnswers] = useState<MyAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  async function load() {
    setLoading(true);

    if (!hasSupabaseConfig()) {
      setPublicQuestions([]);
      setMyQuestions([]);
      setMyAnswers([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const publicQuestionsPromise = supabase
      .from("qa_questions")
      .select("id, question, asked_by_name, created_at, status, rejection_reason, qa_answers(id, answer, answered_by_name, created_at, status, rejection_reason)")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    const myQuestionsPromise = authUserId
      ? supabase
          .from("qa_questions")
          .select("id, question, status, rejection_reason, created_at, qa_answers(id, answer, answered_by_name, created_at, status, rejection_reason)")
          .eq("asked_by_auth_user_id", authUserId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] } as any);

    const myAnswersPromise = authUserId
      ? supabase
          .from("qa_answers")
          .select("id, answer, status, rejection_reason, created_at, question:qa_questions(question, status)")
          .eq("answered_by_auth_user_id", authUserId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] } as any);

    const [{ data: publicData }, { data: questionData }, { data: answerData }] = await Promise.all([
      publicQuestionsPromise,
      myQuestionsPromise,
      myAnswersPromise,
    ]);

    setPublicQuestions((publicData as PublicQuestion[]) ?? []);
    setMyQuestions((questionData as MyQuestion[]) ?? []);
    setMyAnswers((answerData as MyAnswer[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [authUserId, refreshTick]);

  const isSignedIn = Boolean(authUserId);

  if (!isSignedIn) {
    return (
      <section className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Q&amp;A Access</p>
        <h2 className="mt-2 font-display text-xl text-forest">Sign in to use the Q&amp;A hub</h2>
        <p className="mt-2 text-sm text-graphite/70">
          Asking questions, answering, and viewing your history are available after you sign in.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold"
          >
            Log In
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <a href="#ask" className="rounded-sm bg-forest px-4 py-3 text-center font-mono text-xs uppercase tracking-[0.15em] text-gold">
          Ask
        </a>
        <a href="#answer" className="rounded-sm border border-forest/15 px-4 py-3 text-center font-mono text-xs uppercase tracking-[0.15em] text-forest">
          Answer
        </a>
        <a href="#my-questions" className="rounded-sm border border-forest/15 px-4 py-3 text-center font-mono text-xs uppercase tracking-[0.15em] text-forest">
          My Questions
        </a>
        <a href="#my-answers" className="rounded-sm border border-forest/15 px-4 py-3 text-center font-mono text-xs uppercase tracking-[0.15em] text-forest">
          My Answers
        </a>
        <a href="#public-qa" className="rounded-sm border border-forest/15 px-4 py-3 text-center font-mono text-xs uppercase tracking-[0.15em] text-forest">
          Public Q&A
        </a>
      </div>

      <section id="ask" className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Ask a Question</p>
            <h2 className="mt-2 font-display text-xl text-forest">Ask something new</h2>
          </div>
          {isSignedIn ? (
            <p className="text-sm text-graphite/60">
              Posting as <span className="font-medium text-forest">{displayName}</span>
            </p>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold"
            >
              Sign in to track posts
            </Link>
          )}
        </div>
        <div className="mt-5">
          <AskQuestionForm
            defaultName={displayName ?? ""}
            authUserId={authUserId}
            onSubmitted={() => setRefreshTick((n) => n + 1)}
          />
        </div>
      </section>

      <section id="answer" className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Answer Questions</p>
        <h2 className="mt-2 font-display text-xl text-forest">Help answer the queue</h2>
        <p className="mt-2 text-sm text-graphite/70">
          Any signed-in student, teacher, or admin can answer. If you&apos;re not signed in, use the button below to get there first.
        </p>
        <div className="mt-4">
          {isSignedIn ? (
            <QuestionQueue
              answeredByName={displayName ?? "GEA Student"}
              answeredByAuthUserId={authUserId}
            />
          ) : (
            <div className="rounded-sm bg-paper p-4 ring-1 ring-forest/10">
              <p className="text-sm text-graphite/70">
                Sign in to answer questions and have your answers tracked in your history.
              </p>
              <Link
                href="/login"
                className="mt-3 inline-flex min-h-11 items-center rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold"
              >
                Go to Sign In
              </Link>
            </div>
          )}
        </div>
      </section>

      <section id="my-questions" className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">My Questions</p>
        <h2 className="mt-2 font-display text-xl text-forest">Your submitted questions</h2>
        <div className="mt-4">
          {!isSignedIn ? (
            <div className="rounded-sm bg-paper p-4 ring-1 ring-forest/10">
              <p className="text-sm text-graphite/70">
                Sign in to see your question history and statuses.
              </p>
            </div>
          ) : loading ? (
            <p className="text-sm text-graphite/50">Loading your questions...</p>
          ) : myQuestions.length === 0 ? (
            <p className="text-sm text-graphite/50">You have not asked any questions yet.</p>
          ) : (
            <div className="space-y-4">
              {myQuestions.map((q) => (
                <div key={q.id} className="rounded-sm bg-paper p-4 ring-1 ring-forest/10">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-forest whitespace-pre-wrap">{q.question}</p>
                    <span className="rounded-full bg-forest/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-forest">
                      {q.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-graphite/50">Asked {formatDate(q.created_at)}</p>
                  {q.status === "rejected" && q.rejection_reason && (
                    <p className="mt-2 rounded-sm bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
                      Rejected: {q.rejection_reason}
                    </p>
                  )}
                  <div className="mt-4 space-y-3 border-l-2 border-gold/50 pl-4">
                    {q.qa_answers.length === 0 ? (
                      <p className="text-sm italic text-graphite/40">No answers yet.</p>
                    ) : (
                      q.qa_answers.map((a) => (
                        <div key={a.id}>
                          <p className="text-sm text-graphite/80 whitespace-pre-wrap">{a.answer}</p>
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                            {a.status} - {a.answered_by_name}
                          </p>
                          {a.status === "rejected" && a.rejection_reason && (
                            <p className="mt-2 rounded-sm bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-100">
                              Rejected: {a.rejection_reason}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="my-answers" className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">My Answers</p>
        <h2 className="mt-2 font-display text-xl text-forest">Answers you have submitted</h2>
        <div className="mt-4">
          {!isSignedIn ? (
            <div className="rounded-sm bg-paper p-4 ring-1 ring-forest/10">
              <p className="text-sm text-graphite/70">
                Sign in to see the answers you have submitted and whether they are pending or approved.
              </p>
            </div>
          ) : loading ? (
            <p className="text-sm text-graphite/50">Loading your answers...</p>
          ) : myAnswers.length === 0 ? (
            <p className="text-sm text-graphite/50">You have not answered any questions yet.</p>
          ) : (
            <div className="space-y-4">
              {myAnswers.map((a) => (
              <div key={a.id} className="rounded-sm bg-paper p-4 ring-1 ring-forest/10">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-forest whitespace-pre-wrap">
                      {(a.question as any)?.question ?? "Question no longer available"}
                    </p>
                    <span className="rounded-full bg-forest/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-forest">
                      {a.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-graphite/80 whitespace-pre-wrap">{a.answer}</p>
                  <p className="mt-2 text-xs text-graphite/50">Answered {formatDate(a.created_at)}</p>
                  {a.status === "rejected" && a.rejection_reason && (
                    <p className="mt-2 rounded-sm bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-100">
                      Rejected: {a.rejection_reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="public-qa" className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Public Q&amp;A</p>
        <h2 className="mt-2 font-display text-xl text-forest">Community questions and answers</h2>
        <div className="mt-4 space-y-6">
          {loading ? (
            <p className="text-sm text-graphite/50">Loading public questions...</p>
          ) : publicQuestions.length === 0 ? (
            <p className="text-sm text-graphite/50">No approved questions yet.</p>
          ) : (
            publicQuestions.map((q) => {
              const approvedAnswers = q.qa_answers.filter((a) => a.status === "approved");
              return (
                <div key={q.id} className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">{q.asked_by_name}</p>
                  <p className="mt-2 font-display text-lg text-forest whitespace-pre-wrap">{q.question}</p>
                  <div className="mt-4 space-y-3 border-l-2 border-gold/50 pl-4">
                    {approvedAnswers.length === 0 ? (
                      <p className="text-sm italic text-graphite/40">Awaiting an answer.</p>
                    ) : (
                      approvedAnswers.map((a) => (
                        <div key={a.id}>
                          <p className="text-sm leading-relaxed text-graphite/80 whitespace-pre-wrap">{a.answer}</p>
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                            - {a.answered_by_name}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
