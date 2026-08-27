"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import AskQuestionForm from "@/components/AskQuestionForm";
import AnswerForm from "@/components/AnswerForm";
import { FORUM_BOARDS, ForumBoard, getForumBoardLabel, isForumBoard } from "@/lib/forumBoards";

type ForumComment = {
  id: string;
  answer: string;
  answered_by_name: string;
  created_at: string;
  parent_answer_id: string | null;
  answered_by_auth_user_id: string | null;
  status: string;
  rejection_reason: string | null;
  upvote_count: number;
  downvote_count: number;
  report_count: number;
};

type ForumPost = {
  id: string;
  question: string;
  asked_by_name: string;
  created_at: string;
  forum_board: string;
  status: string;
  rejection_reason: string | null;
  upvote_count: number;
  downvote_count: number;
  report_count: number;
  qa_answers: ForumComment[];
};

type QuestionVoteRow = {
  question_id: string;
  value: number;
};

type AnswerVoteRow = {
  answer_id: string;
  value: number;
};

type QuestionReportRow = {
  question_id: string;
};

type AnswerReportRow = {
  answer_id: string;
};

type MyQuestion = {
  id: string;
  question: string;
  forum_board: string;
  status: string;
  created_at: string;
};

type MyAnswer = {
  id: string;
  answer: string;
  status: string;
  created_at: string;
  question: { question: string; forum_board: string; status: string } | null;
};

type MyVote = {
  id: string;
  value: number;
  created_at: string;
  answer: {
    answer: string;
    question_id: string;
    question: { question: string; forum_board: string; status: string } | null;
  } | null;
};

type ThreadComment = ForumComment & {
  replies: ThreadComment[];
  score: number;
  myVote: -1 | 0 | 1;
  reportedByMe: boolean;
};

type SortMode = "best" | "new";

const REPORTER_KEY_STORAGE = "gea_forum_reporter_key";
const REPORTED_QUESTION_STORAGE = "gea_forum_reported_questions";
const REPORTED_ANSWER_STORAGE = "gea_forum_reported_answers";

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function readStoredIds(key: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value) => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
}

function writeStoredIds(key: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // Ignore storage failures in privacy-restricted browsers.
  }
}

function buildCommentTree(
  comments: ForumComment[],
  voteMap: Map<string, -1 | 0 | 1>,
  reportedSet: Set<string>,
) {
  const nodes = new Map<string, ThreadComment>();
  const roots: ThreadComment[] = [];

  for (const comment of comments) {
    if (comment.status !== "approved") continue;

    nodes.set(comment.id, {
      ...comment,
      replies: [],
      score: comment.upvote_count - comment.downvote_count,
      myVote: voteMap.get(comment.id) ?? 0,
      reportedByMe: reportedSet.has(comment.id),
    });
  }

  nodes.forEach((node) => {
    if (node.parent_answer_id && nodes.has(node.parent_answer_id)) {
      nodes.get(node.parent_answer_id)?.replies.push(node);
      return;
    }

    roots.push(node);
  });

  const sortTree = (items: ThreadComment[], depth = 0) => {
    items.sort((a, b) => {
      if (depth === 0) {
        return b.score - a.score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    items.forEach((item) => sortTree(item.replies, depth + 1));
  };

  sortTree(roots);
  return roots;
}

function VotePill({
  value,
  score,
  upCount,
  downCount,
  canVote,
  onVote,
}: {
  value: -1 | 0 | 1;
  score: number;
  upCount: number;
  downCount: number;
  canVote: boolean;
  onVote: (value: -1 | 0 | 1) => void;
}) {
  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-full border border-forest/10 bg-paper shadow-[0_6px_18px_rgba(18,53,36,0.04)]">
      <button
        type="button"
        onClick={() => onVote(value === 1 ? 0 : 1)}
        disabled={!canVote}
        className={`flex min-h-10 items-center gap-1.5 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.15em] transition ${
          value === 1
            ? "bg-forest text-gold"
            : "text-forest hover:bg-forest/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
        }`}
        aria-label={`Upvote. Current count ${upCount}`}
      >
        <span aria-hidden="true">▲</span>
        <span>Up</span>
      </button>
      <div className="flex min-w-16 items-center justify-center border-x border-forest/10 bg-forest/[0.03] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.14em] text-forest/80">
        {score}
      </div>
      <button
        type="button"
        onClick={() => onVote(value === -1 ? 0 : -1)}
        disabled={!canVote}
        className={`flex min-h-10 items-center gap-1.5 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.15em] transition ${
          value === -1
            ? "bg-forest text-gold"
            : "text-forest hover:bg-forest/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
        }`}
        aria-label={`Downvote. Current count ${downCount}`}
      >
        <span aria-hidden="true">▼</span>
        <span>Down</span>
      </button>
    </div>
  );
}

function ReportMenu({
  canReport,
  reported,
  reportCount,
  onReport,
}: {
  canReport: boolean;
  reported: boolean;
  reportCount: number;
  onReport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div ref={menuRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-forest/10 bg-paper text-lg leading-none text-forest transition hover:bg-forest/[0.04]"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-sm border border-forest/10 bg-paper p-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onReport();
            }}
            disabled={!canReport || reported}
            className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm text-forest transition hover:bg-forest/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>{reported ? "Reported" : "Report"}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/45">
              {reportCount}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  post,
  expanded,
  displayName,
  authUserId,
  canVote,
  canReply,
  canReport,
  questionVoteMap,
  questionReportedSet,
  answerVoteMap,
  answerReportedSet,
  onToggle,
  onQuestionVote,
  onQuestionReport,
  onVote,
  onReport,
  onRefresh,
}: {
  post: ForumPost;
  expanded: boolean;
  displayName: string;
  authUserId: string | null;
  canVote: boolean;
  canReply: boolean;
  canReport: boolean;
  questionVoteMap: Map<string, -1 | 0 | 1>;
  questionReportedSet: Set<string>;
  answerVoteMap: Map<string, -1 | 0 | 1>;
  answerReportedSet: Set<string>;
  onToggle: () => void;
  onQuestionVote: (questionId: string, value: -1 | 0 | 1) => Promise<void>;
  onQuestionReport: (questionId: string) => Promise<void>;
  onVote: (commentId: string, value: -1 | 0 | 1) => Promise<void>;
  onReport: (commentId: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const comments = useMemo(
    () => buildCommentTree(post.qa_answers, answerVoteMap, answerReportedSet),
    [answerReportedSet, answerVoteMap, post.qa_answers],
  );
  const commentCount = post.qa_answers.filter((comment) => comment.status === "approved").length;
  const preview = post.question.length > 220 ? `${post.question.slice(0, 220).trimEnd()}...` : post.question;
  const postScore = post.upvote_count - post.downvote_count;
  const myQuestionVote = questionVoteMap.get(post.id) ?? 0;
  const reportedQuestion = questionReportedSet.has(post.id);

  return (
    <article className="overflow-hidden rounded-sm border border-forest/10 bg-paper ring-1 ring-forest/5">
      <button
        type="button"
        onClick={onToggle}
        className="block w-full px-5 py-4 text-left transition hover:bg-forest/[0.02]"
      >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-forest text-sm font-semibold text-gold">
              {post.asked_by_name.slice(0, 1).toUpperCase()}
            </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-graphite/50">
              <span className="rounded-sm border border-gold/20 bg-gold/10 px-2.5 py-1 text-forest">
                {getForumBoardLabel(post.forum_board)}
              </span>
              <span>{post.asked_by_name}</span>
              <span>•</span>
              <span>{formatDate(post.created_at)}</span>
            </div>
            <h3 className="mt-3 whitespace-pre-wrap font-display text-xl leading-tight text-forest sm:text-2xl">
              {post.question}
            </h3>
            {!expanded && (
              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-graphite/70">
                {preview}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-graphite/50">
              <span className="rounded-sm bg-forest/[0.05] px-3 py-1">{commentCount} comments</span>
              <span className="rounded-sm bg-forest/[0.05] px-3 py-1">Open thread</span>
              <span className="rounded-sm bg-forest/[0.05] px-3 py-1">
                Score {postScore}
              </span>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-forest/10 px-5 py-5">
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-sm border border-forest/10 bg-forest/[0.02] p-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Post actions</p>
                <p className="mt-1 text-sm text-graphite/60">
                  Vote on the post or open the menu to report it.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <VotePill
                  value={myQuestionVote}
                  score={postScore}
                  upCount={post.upvote_count}
                  downCount={post.downvote_count}
                  canVote={canVote}
                  onVote={(value) => onQuestionVote(post.id, value)}
                />
                <ReportMenu
                  canReport={canReport}
                  reported={reportedQuestion}
                  reportCount={post.report_count}
                  onReport={() => onQuestionReport(post.id)}
                />
              </div>
            </div>

            {canReply ? (
              <div className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/10">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
                  Add a comment
                </p>
                <AnswerForm
                  questionId={post.id}
                  answeredByName={displayName}
                  answeredByAuthUserId={authUserId}
                  submitLabel="Post Comment"
                  placeholder="Join the discussion..."
                  onSubmitted={onRefresh}
                />
              </div>
            ) : (
              <div className="rounded-sm border border-forest/10 bg-forest/[0.03] p-4 text-sm text-graphite/65">
                Sign in with an approved student account to comment on posts.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Comments</p>
              <p className="text-sm text-graphite/60">
                {comments.length} top-level comment{comments.length === 1 ? "" : "s"}
              </p>
            </div>

            {comments.length === 0 ? (
              <p className="text-sm text-graphite/50">No comments yet. Be the first to reply.</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    questionId={post.id}
                    displayName={displayName}
                    authUserId={authUserId}
                    canVote={canVote}
                    canReport={canReport}
                    canReply={canReply}
                    onVote={onVote}
                    onReport={onReport}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function CommentCard({
  comment,
  questionId,
  displayName,
  authUserId,
  canVote,
  canReport,
  canReply,
  onVote,
  onReport,
  onRefresh,
  depth = 0,
}: {
  comment: ThreadComment;
  questionId: string;
  displayName: string;
  authUserId: string | null;
  canVote: boolean;
  canReport: boolean;
  canReply: boolean;
  onVote: (commentId: string, value: -1 | 0 | 1) => Promise<void>;
  onReport: (commentId: string) => Promise<void>;
  onRefresh: () => void;
  depth?: number;
}) {
  const [replying, setReplying] = useState(false);

    return (
    <div
      className={`rounded-sm border border-forest/10 bg-paper p-4 ${
        depth > 0 ? "border-l-2 border-l-gold/40" : ""
      }`}
      style={{ marginLeft: depth * 18 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-forest">{comment.answered_by_name}</p>
          <p className="mt-1 text-xs text-graphite/50">Posted {formatDate(comment.created_at)}</p>
        </div>
        <div className="flex items-start gap-2">
          <VotePill
            value={comment.myVote}
            score={comment.score}
            upCount={comment.upvote_count}
            downCount={comment.downvote_count}
            canVote={canVote}
            onVote={(value) => onVote(comment.id, value)}
          />
          <ReportMenu
            canReport={canReport}
            reported={comment.reportedByMe}
            reportCount={comment.report_count}
            onReport={() => onReport(comment.id)}
          />
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-graphite/80">{comment.answer}</p>

      {canReply && (
        <button
          type="button"
          onClick={() => setReplying((current) => !current)}
          className="mt-4 inline-flex rounded-full border border-forest/10 bg-forest/[0.03] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-forest transition hover:bg-forest/[0.06]"
        >
          {replying ? "Cancel Reply" : "Reply"}
        </button>
      )}

      {replying && canReply && (
        <div className="mt-4 border-l-2 border-gold/40 pl-4">
          <AnswerForm
            questionId={questionId}
            answeredByName={displayName}
            answeredByAuthUserId={authUserId}
            parentAnswerId={comment.id}
            submitLabel="Post Reply"
            placeholder="Write a reply..."
            onSubmitted={() => {
              setReplying(false);
              onRefresh();
            }}
          />
        </div>
      )}

      {comment.replies.length > 0 && (
        <div className="mt-4 space-y-3">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              questionId={questionId}
              displayName={displayName}
              authUserId={authUserId}
              canVote={canVote}
              canReport={canReport}
              canReply={canReply}
              onVote={onVote}
              onReport={onReport}
              onRefresh={onRefresh}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function QAHub({
  authUserId,
  displayName,
  canCreatePost = Boolean(authUserId),
  canVote = Boolean(authUserId),
  canReply = Boolean(authUserId),
  canReport = true,
}: {
  authUserId: string | null;
  displayName: string | null;
  canCreatePost?: boolean;
  canVote?: boolean;
  canReply?: boolean;
  canReport?: boolean;
}) {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [questionVoteMap, setQuestionVoteMap] = useState<Map<string, -1 | 0 | 1>>(new Map());
  const [questionReportedSet, setQuestionReportedSet] = useState<Set<string>>(new Set());
  const [answerVoteMap, setAnswerVoteMap] = useState<Map<string, -1 | 0 | 1>>(new Map());
  const [answerReportedSet, setAnswerReportedSet] = useState<Set<string>>(new Set());
  const [myQuestions, setMyQuestions] = useState<MyQuestion[]>([]);
  const [myAnswers, setMyAnswers] = useState<MyAnswer[]>([]);
  const [myVotes, setMyVotes] = useState<MyVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<ForumBoard | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("best");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [reporterKey, setReporterKey] = useState<string | null>(authUserId);
  const composerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (authUserId) {
      setReporterKey(authUserId);
      return;
    }

    if (typeof window === "undefined") return;

    const existingKey = window.localStorage.getItem(REPORTER_KEY_STORAGE);
    if (existingKey) {
      setReporterKey(existingKey);
      return;
    }

    const nextKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    window.localStorage.setItem(REPORTER_KEY_STORAGE, nextKey);
    setReporterKey(nextKey);
  }, [authUserId]);

  async function load() {
    setLoading(true);
    setMutationError(null);

    if (!hasSupabaseConfig()) {
      setPosts([]);
      setQuestionVoteMap(new Map());
      setQuestionReportedSet(new Set());
      setAnswerVoteMap(new Map());
      setAnswerReportedSet(new Set());
      setMyQuestions([]);
      setMyAnswers([]);
      setMyVotes([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const publicPostsPromise = supabase
      .from("qa_questions")
      .select(
        "id, question, asked_by_name, created_at, forum_board, status, rejection_reason, upvote_count, downvote_count, report_count, qa_answers(id, answer, answered_by_name, created_at, parent_answer_id, answered_by_auth_user_id, status, rejection_reason, upvote_count, downvote_count, report_count)",
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    const myQuestionsPromise = authUserId
      ? supabase
          .from("qa_questions")
          .select("id, question, forum_board, status, created_at")
          .eq("asked_by_auth_user_id", authUserId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] } as any);

    const myAnswersPromise = authUserId
      ? supabase
          .from("qa_answers")
          .select("id, answer, status, created_at, question:qa_questions(question, forum_board, status)")
          .eq("answered_by_auth_user_id", authUserId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] } as any);

    const myVotesPromise = authUserId
      ? supabase
          .from("qa_answer_votes")
          .select("id, value, created_at, answer:qa_answers(answer, question_id, question:qa_questions(question, forum_board, status))")
          .eq("voter_auth_user_id", authUserId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] } as any);

    const [publicRes, questionsRes, answersRes, votesRes] = await Promise.all([
      publicPostsPromise,
      myQuestionsPromise,
      myAnswersPromise,
      myVotesPromise,
    ]);

    const { data: publicData, error: publicError } = publicRes;
    const { data: questionData, error: questionError } = questionsRes;
    const { data: answerData, error: answerError } = answersRes;
    const { data: voteData, error: voteDataError } = votesRes;

    if (publicError || questionError || answerError || voteDataError) {
      setMutationError("We couldn’t load the forum right now.");
    }

    const nextPosts = ((publicData as ForumPost[]) ?? []).map((post) => ({
      ...post,
      forum_board: isForumBoard(post.forum_board) ? post.forum_board : "general",
    }));

    const commentIds = nextPosts.flatMap((post) => post.qa_answers.map((comment) => comment.id));
    const postIds = nextPosts.map((post) => post.id);
    let nextQuestionVoteMap = new Map<string, -1 | 0 | 1>();
    let nextQuestionReportedSet = authUserId ? new Set<string>() : readStoredIds(REPORTED_QUESTION_STORAGE);
    let nextAnswerVoteMap = new Map<string, -1 | 0 | 1>();
    let nextAnswerReportedSet = authUserId ? new Set<string>() : readStoredIds(REPORTED_ANSWER_STORAGE);

    if (authUserId) {
      const questionQueries = postIds.length > 0
        ? [
            supabase
              .from("qa_question_votes")
              .select("question_id, value")
              .eq("voter_auth_user_id", authUserId)
              .in("question_id", postIds),
            supabase
              .from("qa_question_reports")
              .select("question_id")
              .eq("reporter_auth_user_id", authUserId)
              .in("question_id", postIds),
          ]
        : [];

      const answerQueries = commentIds.length > 0
        ? [
            supabase
              .from("qa_answer_votes")
              .select("answer_id, value")
              .eq("voter_auth_user_id", authUserId)
              .in("answer_id", commentIds),
            supabase
              .from("qa_answer_reports")
              .select("answer_id")
              .eq("reporter_auth_user_id", authUserId)
              .in("answer_id", commentIds),
          ]
        : [];

      const [questionVoteRes, questionReportRes, answerVoteRes, answerReportRes] = await Promise.all([
        questionQueries[0] ?? Promise.resolve({ data: [] } as any),
        questionQueries[1] ?? Promise.resolve({ data: [] } as any),
        answerQueries[0] ?? Promise.resolve({ data: [] } as any),
        answerQueries[1] ?? Promise.resolve({ data: [] } as any),
      ]);

      nextQuestionVoteMap = new Map(
        (((questionVoteRes as { data: QuestionVoteRow[] }).data) ?? []).map((row) => [
          row.question_id,
          row.value as -1 | 0 | 1,
        ]),
      );
      nextQuestionReportedSet = new Set(
        (((questionReportRes as { data: QuestionReportRow[] }).data) ?? []).map((row) => row.question_id),
      );
      nextAnswerVoteMap = new Map(
        (((answerVoteRes as { data: AnswerVoteRow[] }).data) ?? []).map((row) => [
          row.answer_id,
          row.value as -1 | 0 | 1,
        ]),
      );
      nextAnswerReportedSet = new Set(
        (((answerReportRes as { data: AnswerReportRow[] }).data) ?? []).map((row) => row.answer_id),
      );
    }

    setPosts(nextPosts);
    setQuestionVoteMap(nextQuestionVoteMap);
    setQuestionReportedSet(nextQuestionReportedSet);
    setAnswerVoteMap(nextAnswerVoteMap);
    setAnswerReportedSet(nextAnswerReportedSet);
    setMyQuestions((questionData as MyQuestion[]) ?? []);
    setMyAnswers((answerData as MyAnswer[]) ?? []);
    setMyVotes((voteData as MyVote[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [authUserId, refreshTick]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const visiblePosts = useMemo(() => {
    const filtered = posts.filter((post) => {
      const boardMatch = selectedBoard === "all" || post.forum_board === selectedBoard;
      if (!boardMatch) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        post.question,
        post.asked_by_name,
        getForumBoardLabel(post.forum_board),
        ...post.qa_answers.map((comment) => comment.answer),
        ...post.qa_answers.map((comment) => comment.answered_by_name),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    return filtered.sort((a, b) => {
      if (sortMode === "new") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      const aScore = a.upvote_count - a.downvote_count;
      const bScore = b.upvote_count - b.downvote_count;
      return bScore - aScore || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [normalizedSearch, posts, selectedBoard, sortMode]);

  useEffect(() => {
    if (selectedPostId && !visiblePosts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(null);
    }
  }, [selectedPostId, visiblePosts]);

  const selectedPost = visiblePosts.find((post) => post.id === selectedPostId) ?? null;
  const reportEnabled = canReport && Boolean(reporterKey);

  const recentActivity = useMemo(() => {
    const postItems = myQuestions.map((question) => ({
      key: `post-${question.id}`,
      type: "post" as const,
      created_at: question.created_at,
      label: `You posted in ${getForumBoardLabel(question.forum_board)}`,
      detail: question.question,
    }));

    const answerItems = myAnswers.map((answer) => ({
      key: `answer-${answer.id}`,
      type: "answer" as const,
      created_at: answer.created_at,
      label: `You replied in ${getForumBoardLabel(answer.question?.forum_board ?? "general")}`,
      detail: `${answer.answer}${answer.question ? ` • on "${answer.question.question}"` : ""}`,
    }));

    const voteItems = myVotes.map((vote) => ({
      key: `vote-${vote.id}`,
      type: "vote" as const,
      created_at: vote.created_at,
      label: `You ${vote.value === 1 ? "upvoted" : "downvoted"} a comment`,
      detail: vote.answer
        ? `"${vote.answer.answer}"${vote.answer.question ? ` • on "${vote.answer.question.question}"` : ""}`
        : "Vote target no longer exists",
    }));

    return [...postItems, ...answerItems, ...voteItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [myAnswers, myQuestions, myVotes]);

  useEffect(() => {
    if (!composerOpen) return;

    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [composerOpen]);

  async function submitQuestionVote(questionId: string, value: -1 | 0 | 1) {
    if (!authUserId || !hasSupabaseConfig()) return;

    const supabase = createClient();
    setMutationError(null);

    const currentValue = questionVoteMap.get(questionId) ?? 0;
    if (currentValue === value) return;

    if (value === 0) {
      const { error } = await supabase
        .from("qa_question_votes")
        .delete()
        .eq("question_id", questionId)
        .eq("voter_auth_user_id", authUserId);
      if (error) {
        setMutationError("We couldn’t update that vote.");
        return;
      }
    } else {
      const { error } = await supabase.from("qa_question_votes").upsert(
        {
          question_id: questionId,
          voter_auth_user_id: authUserId,
          value,
        },
        { onConflict: "question_id,voter_auth_user_id" },
      );
      if (error) {
        setMutationError("We couldn’t update that vote.");
        return;
      }
    }

    setRefreshTick((tick) => tick + 1);
  }

  async function submitAnswerVote(answerId: string, value: -1 | 0 | 1) {
    if (!authUserId || !hasSupabaseConfig()) return;

    const supabase = createClient();
    setMutationError(null);

    const currentValue = answerVoteMap.get(answerId) ?? 0;
    if (currentValue === value) return;

    if (value === 0) {
      const { error } = await supabase
        .from("qa_answer_votes")
        .delete()
        .eq("answer_id", answerId)
        .eq("voter_auth_user_id", authUserId);
      if (error) {
        setMutationError("We couldn’t update that vote.");
        return;
      }
    } else {
      const { error } = await supabase.from("qa_answer_votes").upsert(
        {
          answer_id: answerId,
          voter_auth_user_id: authUserId,
          value,
        },
        { onConflict: "answer_id,voter_auth_user_id" },
      );
      if (error) {
        setMutationError("We couldn’t update that vote.");
        return;
      }
    }

    setRefreshTick((tick) => tick + 1);
  }

  async function submitReport(targetType: "question" | "answer", targetId: string) {
    if (!hasSupabaseConfig()) return;

    const key = reporterKey ?? authUserId;
    if (!key) return;

    const response = await fetch("/api/forum/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType,
        targetId,
        reporterKey: key,
      }),
    });

    if (!response.ok) {
      setMutationError("We couldn’t submit that report.");
      return;
    }

    if (targetType === "question") {
      setQuestionReportedSet((current) => {
        const next = new Set(current);
        next.add(targetId);
        if (!authUserId) writeStoredIds(REPORTED_QUESTION_STORAGE, next);
        return next;
      });
    } else {
      setAnswerReportedSet((current) => {
        const next = new Set(current);
        next.add(targetId);
        if (!authUserId) writeStoredIds(REPORTED_ANSWER_STORAGE, next);
        return next;
      });
    }

    setRefreshTick((tick) => tick + 1);
  }

  return (
    <div className="space-y-10">
      <section className="rounded-sm bg-paper/85 px-5 py-6 ring-1 ring-forest/10 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">GEA Forum</p>
            <h2 className="mt-3 font-display text-2xl font-medium text-forest sm:text-3xl">
              Ask, answer, and follow the discussion
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite/70 sm:text-base">
              Ask questions, browse posts, and reply in the forum.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canCreatePost ? (
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="inline-flex min-h-11 items-center rounded-sm bg-forest px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
              >
                Create Post
              </button>
            ) : authUserId ? (
              <span className="inline-flex min-h-11 items-center rounded-sm border border-forest/15 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-forest/60">
                Pending approval
              </span>
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-sm bg-forest px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
              >
                Sign in to post
              </Link>
            )}
            <a
              href="#feed"
              className="inline-flex min-h-11 items-center rounded-sm border border-forest/15 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-forest transition hover:bg-forest/[0.03]"
            >
              Browse Feed
            </a>
          </div>
        </div>
      </section>

      {!canCreatePost && authUserId && (
        <section className="rounded-sm border border-forest/10 bg-forest/[0.03] px-5 py-4 text-sm leading-relaxed text-graphite/70 ring-1 ring-forest/5">
          Your account is pending approval. You can read the forum and report content, but you
          cannot post, reply, or vote yet.
        </section>
      )}

      <section className="rounded-sm bg-forest/[0.03] px-5 py-5 ring-1 ring-forest/10 sm:px-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex-1">
              <label className="sr-only" htmlFor="qa-search">
                Search posts
              </label>
              <div className="flex items-center gap-3 rounded-sm border border-forest/15 bg-paper px-4 py-3">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-graphite/50">
                  <path
                    fill="currentColor"
                    d="M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"
                  />
                </svg>
                <input
                  id="qa-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search posts, replies, or names..."
                  className="w-full bg-transparent text-sm text-graphite outline-none placeholder:text-graphite/45"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSortMode("best")}
                className={`min-h-11 rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] transition ${
                  sortMode === "best"
                    ? "bg-forest text-gold"
                    : "bg-paper text-forest hover:bg-forest/[0.03]"
                }`}
              >
                Best
              </button>
              <button
                type="button"
                onClick={() => setSortMode("new")}
                className={`min-h-11 rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] transition ${
                  sortMode === "new"
                    ? "bg-forest text-gold"
                    : "bg-paper text-forest hover:bg-forest/[0.03]"
                }`}
              >
                New
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedBoard("all")}
              className={`rounded-sm border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition ${
                selectedBoard === "all"
                  ? "border-gold/40 bg-gold/10 text-forest"
                  : "border-forest/10 bg-paper text-forest hover:bg-forest/[0.03]"
              }`}
            >
              All boards
            </button>
            {FORUM_BOARDS.map((board) => (
              <button
                key={board.value}
                type="button"
                onClick={() => setSelectedBoard(board.value)}
                className={`rounded-sm border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition ${
                  selectedBoard === board.value
                    ? "border-gold/40 bg-gold/10 text-forest"
                    : "border-forest/10 bg-paper text-forest hover:bg-forest/[0.03]"
                }`}
              >
                {board.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {composerOpen && canCreatePost && (
        <section
          ref={composerRef}
          id="create-post"
          className="rounded-sm bg-paper px-5 py-6 ring-1 ring-forest/10 sm:px-6"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
                Write a new post
              </p>
              <h3 className="mt-3 font-display text-2xl font-medium text-forest">Start a thread</h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite/70 sm:text-base">
                Pick a board, write your post, and publish it to the forum without leaving the page.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="inline-flex min-h-11 items-center rounded-sm border border-forest/15 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-forest transition hover:bg-forest/[0.03]"
            >
              Close
            </button>
          </div>
          <div className="mt-5">
            <AskQuestionForm
              key={selectedBoard}
              defaultName={displayName ?? ""}
              authUserId={authUserId}
              defaultBoard={selectedBoard === "all" ? "general" : selectedBoard}
              onSubmitted={() => setRefreshTick((tick) => tick + 1)}
            />
          </div>
        </section>
      )}

      {mutationError && (
        <p className="rounded-sm bg-forest/[0.05] p-4 text-sm text-graphite/75 ring-1 ring-forest/10">
          {mutationError}
        </p>
      )}

      <section id="feed" className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Feed</p>
            <h2 className="mt-2 font-display text-2xl font-medium text-forest sm:text-3xl">
              What everybody has posted
            </h2>
          </div>
          <div className="rounded-sm bg-forest/[0.03] px-4 py-3 ring-1 ring-forest/10">
            <p className="text-[10px] uppercase tracking-[0.15em] text-graphite/40">Showing</p>
            <p className="mt-1 text-sm text-graphite/70">
              {visiblePosts.length} post{visiblePosts.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-graphite/50">Loading posts...</p>
          ) : visiblePosts.length === 0 ? (
            <div className="rounded-sm bg-paper p-5 text-sm text-graphite/60 ring-1 ring-forest/10">
              No posts match that board or search yet.
            </div>
          ) : (
            visiblePosts.map((post) => (
              <QuestionCard
                key={post.id}
                post={post}
                expanded={selectedPost?.id === post.id}
                displayName={displayName ?? "GEA Student"}
                authUserId={authUserId}
                canVote={canVote}
                canReply={canReply}
                canReport={reportEnabled}
                questionVoteMap={questionVoteMap}
                questionReportedSet={questionReportedSet}
                answerVoteMap={answerVoteMap}
                answerReportedSet={answerReportedSet}
                onToggle={() => setSelectedPostId((current) => (current === post.id ? null : post.id))}
                onQuestionVote={submitQuestionVote}
                onQuestionReport={(questionId) => submitReport("question", questionId)}
                onVote={submitAnswerVote}
                onReport={(answerId) => submitReport("answer", answerId)}
                onRefresh={() => setRefreshTick((tick) => tick + 1)}
              />
            ))
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Your History</p>
          <h2 className="mt-3 font-display text-xl text-forest">Posts, replies, votes</h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-sm bg-forest/[0.03] p-3 ring-1 ring-forest/10">
              <p className="text-[10px] uppercase tracking-[0.15em] text-graphite/45">Posts</p>
              <p className="mt-2 text-2xl font-semibold text-forest">{myQuestions.length}</p>
            </div>
            <div className="rounded-sm bg-forest/[0.03] p-3 ring-1 ring-forest/10">
              <p className="text-[10px] uppercase tracking-[0.15em] text-graphite/45">Replies</p>
              <p className="mt-2 text-2xl font-semibold text-forest">{myAnswers.length}</p>
            </div>
            <div className="rounded-sm bg-forest/[0.03] p-3 ring-1 ring-forest/10">
              <p className="text-[10px] uppercase tracking-[0.15em] text-graphite/45">Votes</p>
              <p className="mt-2 text-2xl font-semibold text-forest">{myVotes.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
                Recent Activity
              </p>
              <h2 className="mt-3 font-display text-xl text-forest">Your latest moves</h2>
            </div>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="text-sm text-forest underline decoration-gold/40 underline-offset-4"
            >
              Create
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-graphite/50">No recent activity yet.</p>
            ) : (
              recentActivity.slice(0, 10).map((item) => (
                <div key={item.key} className="rounded-sm border border-forest/10 bg-forest/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-graphite/40">
                      {item.type}
                    </p>
                    <p className="text-xs text-graphite/50">{formatDate(item.created_at)}</p>
                  </div>
                  <p className="mt-2 font-medium text-forest">{item.label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-graphite/70">
                    {item.detail}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
