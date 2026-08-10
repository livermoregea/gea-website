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
  qa_answers: ForumComment[];
};

type VoteRow = {
  answer_id: string;
  value: number;
};

type ReportRow = {
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

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

function QuestionCard({
  post,
  expanded,
  displayName,
  authUserId,
  voteMap,
  reportedSet,
  onToggle,
  onVote,
  onReport,
  onRefresh,
}: {
  post: ForumPost;
  expanded: boolean;
  displayName: string;
  authUserId: string | null;
  voteMap: Map<string, -1 | 0 | 1>;
  reportedSet: Set<string>;
  onToggle: () => void;
  onVote: (commentId: string, value: -1 | 0 | 1) => Promise<void>;
  onReport: (commentId: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const comments = useMemo(() => buildCommentTree(post.qa_answers, voteMap, reportedSet), [post.qa_answers, reportedSet, voteMap]);
  const commentCount = post.qa_answers.filter((comment) => comment.status === "approved").length;
  const preview = post.question.length > 220 ? `${post.question.slice(0, 220).trimEnd()}...` : post.question;

  return (
    <article className="overflow-hidden rounded-2xl border border-forest/10 bg-paper shadow-[0_12px_35px_rgba(18,53,36,0.08)]">
      <button
        type="button"
        onClick={onToggle}
        className="block w-full px-5 py-4 text-left transition hover:bg-forest/[0.02]"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-semibold text-gold">
            {post.asked_by_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-graphite/50">
              <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1 text-forest">
                {getForumBoardLabel(post.forum_board)}
              </span>
              <span>{post.asked_by_name}</span>
              <span>•</span>
              <span>{formatDate(post.created_at)}</span>
            </div>
            <h3 className="mt-3 whitespace-pre-wrap text-xl font-semibold leading-tight text-forest sm:text-2xl">
              {post.question}
            </h3>
            {!expanded && (
              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-graphite/70">
                {preview}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-graphite/50">
              <span className="rounded-full bg-forest/[0.05] px-3 py-1">{commentCount} comments</span>
              <span className="rounded-full bg-forest/[0.05] px-3 py-1">Open thread</span>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-forest/10 px-5 py-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)]">
            <div className="rounded-xl border border-forest/10 bg-forest/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Add a comment</p>
              <div className="mt-3">
                <AnswerForm
                  questionId={post.id}
                  answeredByName={displayName}
                  answeredByAuthUserId={authUserId}
                  submitLabel="Post Comment"
                  placeholder="Join the discussion..."
                  onSubmitted={onRefresh}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Comments</p>
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
                      onVote={onVote}
                      onReport={onReport}
                      onRefresh={onRefresh}
                    />
                  ))}
                </div>
              )}
            </div>
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
  onVote,
  onReport,
  onRefresh,
  depth = 0,
}: {
  comment: ThreadComment;
  questionId: string;
  displayName: string;
  authUserId: string | null;
  onVote: (commentId: string, value: -1 | 0 | 1) => Promise<void>;
  onReport: (commentId: string) => Promise<void>;
  onRefresh: () => void;
  depth?: number;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <div
      className={`rounded-xl border border-forest/10 bg-paper p-4 ${
        depth > 0 ? "border-l-2 border-l-gold/40" : ""
      }`}
      style={{ marginLeft: depth * 18 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-forest">{comment.answered_by_name}</p>
          <p className="mt-1 text-xs text-graphite/50">Posted {formatDate(comment.created_at)}</p>
        </div>
        <div className="rounded-full bg-forest/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-forest">
          Score {comment.score}
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-graphite/80">{comment.answer}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onVote(comment.id, comment.myVote === 1 ? 0 : 1)}
          className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] transition ${
            comment.myVote === 1
              ? "bg-forest text-gold"
              : "bg-forest/[0.06] text-forest hover:bg-forest/10"
          }`}
        >
          Upvote ({comment.upvote_count})
        </button>
        <button
          type="button"
          onClick={() => onVote(comment.id, comment.myVote === -1 ? 0 : -1)}
          className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] transition ${
            comment.myVote === -1
              ? "bg-forest text-gold"
              : "bg-forest/[0.06] text-forest hover:bg-forest/10"
          }`}
        >
          Downvote ({comment.downvote_count})
        </button>
        <button
          type="button"
          onClick={() => setReplying((current) => !current)}
          className="rounded-full bg-forest/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-forest transition hover:bg-forest/10"
        >
          {replying ? "Cancel Reply" : "Reply"}
        </button>
        <button
          type="button"
          onClick={() => onReport(comment.id)}
          disabled={comment.reportedByMe}
          className="rounded-full bg-forest/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-forest transition hover:bg-forest/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {comment.reportedByMe ? "Reported" : `Report (${comment.report_count})`}
        </button>
      </div>

      {replying && (
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
}: {
  authUserId: string | null;
  displayName: string | null;
}) {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [voteMap, setVoteMap] = useState<Map<string, -1 | 0 | 1>>(new Map());
  const [reportedSet, setReportedSet] = useState<Set<string>>(new Set());
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
  const composerRef = useRef<HTMLElement | null>(null);

  async function load() {
    setLoading(true);
    setMutationError(null);

    if (!hasSupabaseConfig()) {
      setPosts([]);
      setVoteMap(new Map());
      setReportedSet(new Set());
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
        "id, question, asked_by_name, created_at, forum_board, status, rejection_reason, qa_answers(id, answer, answered_by_name, created_at, parent_answer_id, answered_by_auth_user_id, status, rejection_reason, upvote_count, downvote_count, report_count)",
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
    let nextVoteMap = new Map<string, -1 | 0 | 1>();
    let nextReportedSet = new Set<string>();

    if (authUserId && commentIds.length > 0) {
      const [{ data: voteRows }, { data: reportRows }] = await Promise.all([
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
      ]);

      nextVoteMap = new Map(
        ((voteRows as VoteRow[]) ?? []).map((row) => [row.answer_id, row.value as -1 | 0 | 1]),
      );
      nextReportedSet = new Set(((reportRows as ReportRow[]) ?? []).map((row) => row.answer_id));
    }

    setPosts(nextPosts);
    setVoteMap(nextVoteMap);
    setReportedSet(nextReportedSet);
    setMyQuestions((questionData as MyQuestion[]) ?? []);
    setMyAnswers((answerData as MyAnswer[]) ?? []);
    setMyVotes((voteData as MyVote[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [authUserId, refreshTick]);

  const isSignedIn = Boolean(authUserId);
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

      const aScore = a.qa_answers.reduce((total, comment) => total + (comment.upvote_count - comment.downvote_count), 0);
      const bScore = b.qa_answers.reduce((total, comment) => total + (comment.upvote_count - comment.downvote_count), 0);
      return bScore - aScore || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [normalizedSearch, posts, selectedBoard, sortMode]);

  useEffect(() => {
    if (selectedPostId && !visiblePosts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(null);
    }
  }, [selectedPostId, visiblePosts]);

  const selectedPost = visiblePosts.find((post) => post.id === selectedPostId) ?? null;

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

  async function handleVote(commentId: string, value: -1 | 0 | 1) {
    if (!authUserId || !hasSupabaseConfig()) return;

    const supabase = createClient();
    setMutationError(null);

    const currentValue = voteMap.get(commentId) ?? 0;
    if (currentValue === value) return;

    if (value === 0) {
      const { error } = await supabase
        .from("qa_answer_votes")
        .delete()
        .eq("answer_id", commentId)
        .eq("voter_auth_user_id", authUserId);

      if (error) {
        setMutationError("We couldn’t update that vote.");
        return;
      }
    } else {
      const { error } = await supabase.from("qa_answer_votes").upsert(
        {
          answer_id: commentId,
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

  async function handleReport(commentId: string) {
    if (!authUserId || !hasSupabaseConfig()) return;

    const supabase = createClient();
    setMutationError(null);

    const { error } = await supabase.from("qa_answer_reports").insert({
      answer_id: commentId,
      reporter_auth_user_id: authUserId,
      reason: "Community report",
    });

    if (error) {
      if (error.code === "23505") {
        setReportedSet((current) => new Set(current).add(commentId));
        return;
      }
      setMutationError("We couldn’t submit that report.");
      return;
    }

    setRefreshTick((tick) => tick + 1);
  }

  if (!isSignedIn) {
    return (
      <section className="rounded-2xl border border-forest/10 bg-paper p-6 shadow-[0_12px_35px_rgba(18,53,36,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Community Forum</p>
        <h2 className="mt-3 text-2xl font-semibold text-forest">Sign in to join the conversation</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-graphite/70">
          Once you&apos;re signed in, you can browse posts, search the feed, jump between boards, reply to
          threads, vote, and report spam.
        </p>
        <div className="mt-5">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-full bg-forest px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
          >
            Log In
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="border-y border-forest/10 bg-paper/70">
        <div className="flex flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:gap-5">
          <div className="flex items-center gap-3 lg:w-56">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-lg font-black text-gold">
              G
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">GEA Forum</p>
              <p className="text-sm text-graphite/60">Ask, answer, and follow the discussion</p>
            </div>
          </div>

          <div className="flex-1">
            <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-full border border-forest/15 bg-paper px-4 py-3 shadow-sm">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-graphite/50">
                <path
                  fill="currentColor"
                  d="M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"
                />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search anything..."
                className="w-full bg-transparent text-sm text-graphite outline-none placeholder:text-graphite/45"
              />
              <span className="hidden rounded-full border border-forest/10 px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-graphite/45 sm:inline-flex">
                Search
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:w-56 lg:justify-end">
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="inline-flex min-h-11 items-center rounded-full bg-forest px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
            >
              Create
            </button>
          </div>
        </div>
      </section>

      {composerOpen && (
        <section
          ref={composerRef}
          id="create-post"
          className="rounded-3xl border border-forest/10 bg-paper p-5 shadow-[0_10px_30px_rgba(18,53,36,0.06)]"
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Write a new post</p>
              <h2 className="mt-3 text-3xl font-semibold text-forest">Start a thread</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite/70">
                Pick a board, write your post, and publish it into the forum without leaving the page.
              </p>
              <div className="mt-5">
                <AskQuestionForm
                  key={selectedBoard}
                  defaultName={displayName ?? ""}
                  authUserId={authUserId}
                  defaultBoard={selectedBoard === "all" ? "general" : selectedBoard}
                  onSubmitted={() => setRefreshTick((tick) => tick + 1)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <section className="rounded-2xl border border-forest/10 bg-forest/[0.03] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Boards</p>
                <h3 className="mt-3 text-lg font-semibold text-forest">Choose your community</h3>
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBoard("all")}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selectedBoard === "all"
                        ? "border-gold/40 bg-gold/10 text-forest"
                        : "border-forest/10 bg-paper text-forest hover:bg-forest/[0.03]"
                    }`}
                  >
                    <span className="block font-semibold">All boards</span>
                    <span className="mt-1 block text-xs text-graphite/50">Everything on the forum</span>
                  </button>
                  {FORUM_BOARDS.map((board) => (
                    <button
                      key={board.value}
                      type="button"
                      onClick={() => setSelectedBoard(board.value)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        selectedBoard === board.value
                          ? "border-gold/40 bg-gold/10 text-forest"
                          : "border-forest/10 bg-paper text-forest hover:bg-forest/[0.03]"
                      }`}
                    >
                      <span className="block font-semibold">{board.label}</span>
                      <span className="mt-1 block text-xs text-graphite/50">{board.description}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-forest/10 bg-forest/[0.03] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Guidance</p>
                <h3 className="mt-3 text-lg font-semibold text-forest">Keep it useful</h3>
                <p className="mt-3 text-sm leading-relaxed text-graphite/70">
                  Clear posts get better answers. Choose the right board, keep titles specific, and use the forum to
                  share questions, updates, and solutions.
                </p>
              </section>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="bg-transparent">
          <div className="sticky top-4 space-y-6">
            <section className="rounded-2xl border border-forest/10 bg-paper p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Post / Create</p>
              <h2 className="mt-3 text-xl font-semibold text-forest">Start a thread</h2>
              <p className="mt-2 text-sm leading-relaxed text-graphite/70">
                Open the composer above to draft a post with more breathing room.
              </p>
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-forest px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
              >
                Write a new post
              </button>
            </section>

            <section className="rounded-2xl border border-forest/10 bg-paper p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Communities</p>
              <h2 className="mt-3 text-xl font-semibold text-forest">Boards</h2>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedBoard("all")}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedBoard === "all"
                      ? "border-gold/40 bg-gold/10 text-forest"
                      : "border-forest/10 bg-paper text-forest hover:bg-forest/[0.03]"
                  }`}
                >
                  <span className="block font-semibold">All boards</span>
                  <span className="mt-1 block text-xs text-graphite/50">Everything on the forum</span>
                </button>
                {FORUM_BOARDS.map((board) => (
                  <button
                    key={board.value}
                    type="button"
                    onClick={() => setSelectedBoard(board.value)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selectedBoard === board.value
                        ? "border-gold/40 bg-gold/10 text-forest"
                        : "border-forest/10 bg-paper text-forest hover:bg-forest/[0.03]"
                    }`}
                  >
                    <span className="block font-semibold">{board.label}</span>
                    <span className="mt-1 block text-xs text-graphite/50">{board.description}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-forest/10 pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Feed</p>
              <h2 className="mt-2 text-2xl font-semibold text-forest">What everybody has posted</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSortMode("best")}
                className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.15em] transition ${
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
                className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.15em] transition ${
                  sortMode === "new"
                    ? "bg-forest text-gold"
                    : "bg-paper text-forest hover:bg-forest/[0.03]"
                }`}
              >
                New
              </button>
            </div>
          </div>

          {mutationError && (
            <p className="rounded-2xl border border-forest/10 bg-paper px-4 py-3 text-sm text-graphite/70">
              {mutationError}
            </p>
          )}

          <div className="space-y-4">
            {loading ? (
              <p className="text-sm text-graphite/50">Loading posts...</p>
            ) : visiblePosts.length === 0 ? (
              <div className="rounded-2xl border border-forest/10 bg-paper p-5 text-sm text-graphite/60">
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
                  voteMap={voteMap}
                  reportedSet={reportedSet}
                  onToggle={() => setSelectedPostId((current) => (current === post.id ? null : post.id))}
                  onVote={handleVote}
                  onReport={handleReport}
                  onRefresh={() => setRefreshTick((tick) => tick + 1)}
                />
              ))
            )}
          </div>
        </main>

        <aside className="bg-transparent">
          <div className="sticky top-4 space-y-6">
            <section className="rounded-2xl border border-forest/10 bg-paper p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Your History</p>
              <h2 className="mt-3 text-xl font-semibold text-forest">Posts, replies, votes</h2>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-paper p-3 ring-1 ring-forest/10">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-graphite/50">Posts</p>
                  <p className="mt-2 text-2xl font-semibold text-forest">{myQuestions.length}</p>
                </div>
                <div className="rounded-xl bg-paper p-3 ring-1 ring-forest/10">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-graphite/50">Replies</p>
                  <p className="mt-2 text-2xl font-semibold text-forest">{myAnswers.length}</p>
                </div>
                <div className="rounded-xl bg-paper p-3 ring-1 ring-forest/10">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-graphite/50">Votes</p>
                  <p className="mt-2 text-2xl font-semibold text-forest">{myVotes.length}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-forest/10 bg-paper p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Recent Activity</p>
                  <h2 className="mt-2 text-xl font-semibold text-forest">Your latest moves</h2>
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
                    <div key={item.key} className="rounded-xl border border-forest/10 bg-paper p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-graphite/40">{item.type}</p>
                        <p className="text-xs text-graphite/50">{formatDate(item.created_at)}</p>
                      </div>
                      <p className="mt-2 font-medium text-forest">{item.label}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-graphite/70">{item.detail}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
