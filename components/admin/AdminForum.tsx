"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import QuestionContent from "@/components/QuestionContent";

type ForumQuestion = {
  id: string;
  question: string;
  asked_by_name: string;
  asked_by_auth_user_id: string | null;
  created_at: string;
};

type ForumAnswer = {
  id: string;
  question_id: string;
  answer: string;
  answered_by_name: string;
  answered_by_auth_user_id: string | null;
  parent_answer_id: string | null;
  created_at: string;
  upvote_count: number;
  downvote_count: number;
  report_count: number;
};

type VoteRow = {
  id: string;
  answer_id: string;
  voter_auth_user_id: string;
  value: number;
  created_at: string;
};

type ReportRow = {
  id: string;
  answer_id: string;
  reporter_auth_user_id: string;
  reason: string;
  created_at: string;
};

type ProfileRow = {
  auth_user_id: string;
  full_name: string | null;
  display_username?: string | null;
};

type ThreadNode = ForumAnswer & {
  replies: ThreadNode[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildProfileMap(rows: ProfileRow[], prefix: string) {
  const map = new Map<string, string>();
  for (const row of rows) {
    const label = row.display_username || row.full_name || `${prefix} user`;
    map.set(row.auth_user_id, label);
  }
  return map;
}

function buildThread(answers: ForumAnswer[]) {
  const nodes = new Map<string, ThreadNode>();
  const roots: ThreadNode[] = [];

  for (const answer of answers) {
    nodes.set(answer.id, { ...answer, replies: [] });
  }

  nodes.forEach((node) => {
    if (node.parent_answer_id && nodes.has(node.parent_answer_id)) {
      nodes.get(node.parent_answer_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortTree = (items: ThreadNode[], depth = 0) => {
    items.sort((a, b) => {
      if (depth === 0) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    items.forEach((item) => sortTree(item.replies, depth + 1));
  };

  sortTree(roots);
  return roots;
}

function renderCommentNode({
  node,
  depth = 0,
  onDeleteAnswer,
}: {
  node: ThreadNode;
  depth?: number;
  onDeleteAnswer: (id: string, label: string) => void;
}) {
  return (
    <div
      key={node.id}
      className={`rounded-sm bg-paper p-4 ring-1 ring-forest/10 ${depth > 0 ? "border-l-2 border-gold/30" : ""}`}
      style={{ marginLeft: depth * 18 }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
            {node.answered_by_name}
          </p>
          <p className="mt-1 text-xs text-graphite/50">
            Commented on {formatDate(node.created_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
            +{node.upvote_count} / -{node.downvote_count}
          </p>
          <p className="mt-1 text-xs text-graphite/50">{node.report_count} reports</p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-graphite/80">{node.answer}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDeleteAnswer(node.id, node.answer)}
          className="rounded-full bg-red-50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-red-700 transition hover:bg-red-100"
        >
          Delete Comment
        </button>
      </div>

      {node.replies.length > 0 && (
        <div className="mt-4 space-y-3">
          {node.replies.map((reply) => renderCommentNode({ node: reply, depth: depth + 1, onDeleteAnswer }))}
        </div>
      )}
    </div>
  );
}

export default function AdminForum() {
  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [answers, setAnswers] = useState<ForumAnswer[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<ProfileRow[]>([]);
  const [teacherProfiles, setTeacherProfiles] = useState<ProfileRow[]>([]);
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);

    if (!hasSupabaseConfig()) {
      setQuestions([]);
      setAnswers([]);
      setVotes([]);
      setReports([]);
      setStudentProfiles([]);
      setTeacherProfiles([]);
      setAdminIds([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const [
      { data: questionData, error: questionError },
      { data: answerData, error: answerError },
      { data: voteData, error: voteError },
      { data: reportData, error: reportError },
      { data: studentData, error: studentError },
      { data: teacherData, error: teacherError },
      { data: adminData, error: adminError },
    ] = await Promise.all([
      supabase.from("qa_questions").select("id, question, asked_by_name, asked_by_auth_user_id, created_at").order("created_at", { ascending: false }),
      supabase
        .from("qa_answers")
        .select("id, question_id, answer, answered_by_name, answered_by_auth_user_id, parent_answer_id, created_at, upvote_count, downvote_count, report_count")
        .order("created_at", { ascending: false }),
      supabase.from("qa_answer_votes").select("id, answer_id, voter_auth_user_id, value, created_at").order("created_at", { ascending: false }),
      supabase.from("qa_answer_reports").select("id, answer_id, reporter_auth_user_id, reason, created_at").order("created_at", { ascending: false }),
      supabase.from("student_profiles").select("auth_user_id, full_name, display_username"),
      supabase.from("teacher_profiles").select("auth_user_id, full_name"),
      supabase.from("admins").select("auth_user_id"),
    ]);

    if (questionError || answerError || voteError || reportError || studentError || teacherError || adminError) {
      setMessage("We couldn’t load all forum activity right now.");
    }

    setQuestions((questionData as ForumQuestion[]) ?? []);
    setAnswers((answerData as ForumAnswer[]) ?? []);
    setVotes((voteData as VoteRow[]) ?? []);
    setReports((reportData as ReportRow[]) ?? []);
    setStudentProfiles((studentData as ProfileRow[]) ?? []);
    setTeacherProfiles((teacherData as ProfileRow[]) ?? []);
    setAdminIds(((adminData as { auth_user_id: string }[]) ?? []).map((row) => row.auth_user_id));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const studentMap = useMemo(() => buildProfileMap(studentProfiles, "Student"), [studentProfiles]);
  const teacherMap = useMemo(() => buildProfileMap(teacherProfiles, "Teacher"), [teacherProfiles]);
  const adminSet = useMemo(() => new Set(adminIds), [adminIds]);

  function resolveName(authUserId: string | null) {
    if (!authUserId) return "Unknown user";
    return studentMap.get(authUserId) || teacherMap.get(authUserId) || (adminSet.has(authUserId) ? "Admin" : authUserId);
  }

  const selectedQuestion = questions.find((question) => question.id === selectedQuestionId) ?? questions[0] ?? null;
  const answersForSelectedQuestion = selectedQuestion
    ? buildThread(answers.filter((answer) => answer.question_id === selectedQuestion.id))
    : [];

  const activityItems = useMemo(() => {
    const postItems = questions.map((question) => ({
      key: `post-${question.id}`,
      type: "post" as const,
      created_at: question.created_at,
      label: `${question.asked_by_name} posted a question`,
      detail: question.question,
    }));

    const answerItems = answers.map((answer) => {
      const parentQuestion = questions.find((question) => question.id === answer.question_id);
      const parentAnswer = answers.find((candidate) => candidate.id === answer.parent_answer_id);
      return {
        key: `answer-${answer.id}`,
        type: "answer" as const,
        created_at: answer.created_at,
        label: `${answer.answered_by_name} replied`,
        detail: `${answer.answer}${parentQuestion ? ` • in "${parentQuestion.question}"` : ""}${parentAnswer ? ` • replying to ${parentAnswer.answered_by_name}` : ""}`,
      };
    });

    const voteItems = votes.map((vote) => {
      const target = answers.find((answer) => answer.id === vote.answer_id);
      const targetQuestion = target ? questions.find((question) => question.id === target.question_id) : null;
      return {
        key: `vote-${vote.id}`,
        type: "vote" as const,
        created_at: vote.created_at,
        label: `${resolveName(vote.voter_auth_user_id)} ${vote.value === 1 ? "upvoted" : "downvoted"}`,
        detail: target
          ? `"${target.answer}"${targetQuestion ? ` • under "${targetQuestion.question}"` : ""}`
          : "Vote target no longer exists",
      };
    });

    const reportItems = reports.map((report) => {
      const target = answers.find((answer) => answer.id === report.answer_id);
      return {
        key: `report-${report.id}`,
        type: "report" as const,
        created_at: report.created_at,
        label: `${resolveName(report.reporter_auth_user_id)} reported a comment`,
        detail: target ? `"${target.answer}"` : "Report target no longer exists",
      };
    });

    return [...postItems, ...answerItems, ...voteItems, ...reportItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [answers, questions, reports, resolveName, votes]);

  async function deleteQuestion(id: string, label: string) {
    if (!hasSupabaseConfig()) return;
    if (!window.confirm(`Delete this post and all of its comments?\n\n${label}`)) return;

    const supabase = createClient();
    const { error } = await supabase.from("qa_questions").delete().eq("id", id);
    if (error) {
      setMessage("We couldn’t delete that post.");
      return;
    }

    if (selectedQuestionId === id) {
      setSelectedQuestionId(null);
    }
    setMessage("Post deleted.");
    load();
  }

  async function deleteAnswer(id: string, label: string) {
    if (!hasSupabaseConfig()) return;
    if (!window.confirm(`Delete this comment and its replies?\n\n${label}`)) return;

    const supabase = createClient();
    const { error } = await supabase.from("qa_answers").delete().eq("id", id);
    if (error) {
      setMessage("We couldn’t delete that comment.");
      return;
    }

    setMessage("Comment deleted.");
    load();
  }

  if (loading) return <p className="text-sm text-graphite/50">Loading forum activity...</p>;

  return (
    <div className="space-y-6">
      {message && (
        <p className="rounded-sm bg-forest/[0.05] p-4 text-sm text-graphite/80 ring-1 ring-forest/10">
          {message}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/5">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-gold">Posts</p>
          <p className="mt-2 font-display text-2xl text-forest">{questions.length}</p>
        </div>
        <div className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/5">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-gold">Comments</p>
          <p className="mt-2 font-display text-2xl text-forest">{answers.length}</p>
        </div>
        <div className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/5">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-gold">Votes</p>
          <p className="mt-2 font-display text-2xl text-forest">{votes.length}</p>
        </div>
        <div className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/5">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-gold">Reports</p>
          <p className="mt-2 font-display text-2xl text-forest">{reports.length}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/5">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Forum Feed</p>
            <p className="mt-2 text-sm text-graphite/70">
              Every post in the forum, newest first. Select one to inspect its thread.
            </p>
          </div>

          {questions.length === 0 ? (
            <p className="text-sm text-graphite/50">No forum posts yet.</p>
          ) : (
            questions.map((question) => {
              const answerCount = answers.filter((answer) => answer.question_id === question.id).length;
              const isActive = question.id === selectedQuestion?.id;

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setSelectedQuestionId(question.id)}
                  className={`block w-full rounded-sm border p-4 text-left transition ${
                    isActive
                      ? "border-gold bg-paper shadow-sm"
                      : "border-forest/10 bg-paper/70 hover:border-forest/20 hover:bg-paper"
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                    {question.asked_by_name}
                  </p>
                  <p className="mt-2 line-clamp-3 font-display text-base text-forest whitespace-pre-wrap">
                    {question.question}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-graphite/50">
                    <span>{answerCount} comment{answerCount === 1 ? "" : "s"}</span>
                    <span>{formatDate(question.created_at)}</span>
                  </div>
                </button>
              );
            })
          )}
        </aside>

        <main className="space-y-6">
          {!selectedQuestion ? (
            <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
              <p className="text-sm text-graphite/50">Select a forum post to inspect it.</p>
            </div>
          ) : (
            <div className="space-y-6 rounded-sm bg-paper p-5 ring-1 ring-forest/10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">
                    {selectedQuestion.asked_by_name}
                  </p>
                  <QuestionContent question={selectedQuestion.question} className="mt-2" />
                  <p className="mt-3 text-xs text-graphite/50">Posted {formatDate(selectedQuestion.created_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteQuestion(selectedQuestion.id, selectedQuestion.question)}
                  className="rounded-full bg-red-50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-red-700 transition hover:bg-red-100"
                >
                  Delete Post
                </button>
              </div>

              <section>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Thread</p>
                  <p className="text-sm text-graphite/60">
                    {answersForSelectedQuestion.length} top-level comment
                    {answersForSelectedQuestion.length === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="mt-4 space-y-4">
                  {answersForSelectedQuestion.length === 0 ? (
                    <p className="text-sm text-graphite/50">No comments on this post yet.</p>
                  ) : (
                    answersForSelectedQuestion.map((node) =>
                      renderCommentNode({
                        node,
                        onDeleteAnswer: deleteAnswer,
                      }),
                    )
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      <section className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Activity Log</p>
            <h2 className="mt-2 font-display text-xl text-forest">Who did what</h2>
          </div>
          <p className="text-sm text-graphite/60">Latest {activityItems.length} activity items</p>
        </div>

        <div className="mt-5 space-y-3">
          {activityItems.length === 0 ? (
            <p className="text-sm text-graphite/50">No activity yet.</p>
          ) : (
            activityItems.slice(0, 50).map((item) => (
              <div key={item.key} className="rounded-sm bg-paper p-4 ring-1 ring-forest/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                      {item.type}
                    </p>
                    <p className="mt-1 text-sm font-medium text-forest">{item.label}</p>
                  </div>
                  <p className="text-xs text-graphite/50">{formatDate(item.created_at)}</p>
                </div>
                <p className="mt-2 text-sm text-graphite/70 whitespace-pre-wrap">{item.detail}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
