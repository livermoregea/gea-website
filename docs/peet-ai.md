# AI-assisted PEET review

PEET evaluates **Efficiency, Effectiveness, and Time**, using the existing **1.0–4.0** scale in increments of 0.1. **3.0 = Meets Expectations.** The app averages the three dimensions and displays `(average ÷ 4) × 100`. This feature saves approved scores to the existing `peet_evaluations` table and completes the existing officer task through `evaluate_officer_task`. It uses the same overall PEET average as manual evaluations.

## Setup

Install with `npm ci`. For an existing Supabase project:

1. Open [`supabase/gea-peet-ai.sql`](../supabase/gea-peet-ai.sql).
2. Copy the entire file into Supabase → SQL Editor → New query, then run it.
3. Apply it after the existing officer migrations, including `officer-shared-tasks.sql` and `officer-task-submissions.sql`. If you installed an earlier version of this migration, rerun the current file, then reapply `officer-individual-contributions.sql` if installed: it adds supporting-link storage and allows reviewers to see requested clarification on submitted tasks while retaining existing records.

This deployment file contains ordinary SQL and requires no `psql` commands. Fresh installations include it at the end of `schema.sql`.

`tests/peet-ai.fixture.sql` is a local test fixture, not a deployment migration. Its `\ir` commands include other files through the `psql` terminal client and are not supported by Supabase's SQL editor. Do not remove those commands and run the remaining fixture against a real project: the fixture creates test Auth, role, and membership records.

Configure these server variables in `.env.local` and your deployment:

```dotenv
GROQ_API_KEY=your-groq-key
GROQ_PEET_MODEL=llama-3.3-70b-versatile
SUPABASE_SERVICE_ROLE_KEY=your-existing-service-role-key
```

Keep the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never expose either server key with a `NEXT_PUBLIC_` prefix.

Groq [deprecated the requested Llama model for free/developer accounts on August 16, 2026](https://console.groq.com/docs/deprecations); enterprise committed-spend accounts are exempt. The requested default is retained. Other accounts must set `GROQ_PEET_MODEL` to an available replacement, such as `openai/gpt-oss-120b`, and validate its recommendations before production use.

## Workflow

PEET lives directly inside the existing **Tasks & PEET** section of the officer workspace. There is no separate PEET destination or queue.

- **Submit work** opens the task's work description and supporting link, then its submitter clarification questions, inside the existing task dialog.
- **Evaluate** opens that task's submitted work, submitter Q&A, reviewer questions, and editable recommended scores inside the same task evaluation dialog.
- **Submission & clarification** on a submitted task reopens saved questions and answers for the submitter, including questions requested by a reviewer on an older submission.

Saved clarification resumes when the task dialog is reopened. Closing the dialog is disabled during loading or writes. Completing submitter answers or approving scores closes the dialog and refreshes the existing task list and PEET average. Manual submission/evaluation remains available in a secondary disclosure; completed-task score corrections retain the existing manual form. Older `/peet` bookmarks redirect into officer tasks, preserving a valid task ID.

1. **Submitter clarification.** Choose **Submit work** on an assigned/shared officer task and describe the completed work, with an optional supporting link. The AI reads the original task goals, deadline and available submission evidence, then asks 1–3 targeted questions about contribution, results, resources, assistance and timing. Answer every question to submit the work for reviewer clarification. Already submitted tasks can also enter the AI flow. The draft and answers survive reloads. Single-person tasks retain one review. With `officer-individual-contributions.sql`, collaborative tasks have one private reflection/review record per participant, a shared deliverable, and independent scores.
2. **Reviewer clarification.** Choose **Evaluate** on a submitted task. An independent authorized reviewer sees the original goals, deliverables, submission timing, supporting link and submitter's Q&A. For a submission without saved clarification, the reviewer can request questions for its submitter directly in this dialog; the submitter responds from their task row before scoring proceeds. Optional reviewer observations help the AI generate 2–4 questions about agreed goals/quality expectations, how the person's deliverables performed, resource/time use, assistance, rework and deadlines. The reviewer answers these questions in their own words. The AI does not ask the reviewer to pick numeric scores.
3. **AI scoring and reviewer approval.** Only after both sides' Q&A does the AI recommend Efficiency, Effectiveness and Time scores with an evidence-based justification. The reviewer can edit each dimension before approving. Any changed score requires a reason. Approval writes a normal PEET evaluation and updates the task/overall average atomically. There is no cumulative point award or separate scoring scale.

Reviewer questions and recommendations belong to the reviewer who supplied those observations. Another reviewer must generate their own questions before scoring or approving. Editing observations requires fresh reviewer questions; editing answers requires recalculation. Refreshing questions preserves the prior Q&A and recommendation in `review_history`, then clears the active recommendation. No live link contents are fetched; reviewers must inspect linked deliverables themselves.

## APIs

All endpoints require a cookie-authenticated Supabase session. Success returns `{ task }`, failure `{ error }`. JSON schemas reject unknown fields and excessive lengths. Browser mutations reject foreign origins.

- `POST /api/peet/evaluate-submission`: `{ officerTaskId, description, category, submissionUrl?, requestForSubmitter? }`. Reads original goals from Supabase, verifies participation, generates submitter questions, and saves a `clarification` draft. Existing records are returned rather than duplicated. `requestForSubmitter: true` requires an independent reviewer and an already submitted task; the server uses its actual assignee, saved description, and saved supporting link instead of trusting replacement evidence in the request.
- `POST /api/peet/finalize-submission`: `{ taskId, version, answers }`. Here and below, `taskId` is the AI review ID. Validates ownership, saved question count, state and version. Calls `submit_officer_task` if the original task is still in progress, then moves the AI record to `pending`.
- `POST /api/peet/clarify-review`: `{ taskId, version, reviewerNotes }`. Generates and stores targeted reviewer questions from original task context and submitter Q&A, without generating scores.
- `POST /api/peet/evaluate-review`: `{ taskId, version, answers }`. Requires questions generated for the current reviewer and a complete answer set. Scores using the original context and both sides' saved Q&A. Returns `{ efficiency, effectiveness, time, justification }` inside `task.recommendation`.
- `POST /api/peet/approve`: `{ taskId, version, scores: { efficiency, effectiveness, time }, overrideReason? }`. Validates all three scores; a reason is required if they differ from the recommendation. Uses the authenticated reviewer's `approve_gea_peet_task` RPC, which calls `evaluate_officer_task` in the same transaction. Duplicate approval returns the original decision without changing its evaluation.

## Persistence and safeguards

`gea_peet_tasks` is a clarification/recommendation history attached by a unique `task_id` to `tasks`. It stores the original source context, submitter Q&A, reviewer questions/answers, prior review rounds, AI scores, final approved scores, reviewer adjustment reason, model identifiers, actor IDs and timestamps. The authoritative current PEET evaluation remains `peet_evaluations`. Later manual corrections use the existing evaluation workflow; the AI record retains its original approved decision for history.

RLS isolates submitters/shared participants to their tasks. Reviewers can see finalized clarification and requested clarification on already submitted tasks; unsubmitted drafts remain restricted to participants. Browsers cannot insert/update/delete AI histories or forge model outputs. Service-only functions save validated model results after API cookie authorization; approval always runs as the actual reviewer. The President's task or shared contribution requires an advisor (or existing super-admin permission). Reviewers cannot evaluate their own/shared tasks. Disabled officers lose access through the existing membership helpers.

Task locks and versions prevent concurrent edits from silently overwriting a review. Changed original goals, deadline or deliverables invalidate an active recommendation and require fresh reviewer questions. Original-task and AI-record lock ordering is consistent with manual evaluation. Approval retries cannot duplicate or overwrite the approved evaluation. An existing manual evaluation closes the original task, preventing a stale AI recommendation from replacing it.

`gea_peet_ai_requests` enforces a shared per-identity limit of 12 AI calls per ten minutes; failed provider calls count. Provider requests time out and use bounded retries. Prompt text treats all supplied data as evidence rather than instructions, and `generateObject` validates the complete response with strict Zod schemas.

The OpenAI provider uses Groq's `https://api.groq.com/openai/v1` chat completions endpoint. SDK middleware selects JSON object mode for compatibility with the requested Llama model. The schema is supplied in the prompt; validation still enforces the exact dimensions and ranges. No evaluation is approved by an AI call alone.

## Validation

```sh
npm run build
node --test tests/*.cjs
```

`tests/officer-task-peet.cjs` and `tests/unified-officer-sections.cjs` verify in-dialog submission/review, persisted clarification, request activity, legacy submissions, and manual fallback. `tests/peet-ai.cjs` mocks the Groq transport and verifies the actual endpoint/response format, strict PEET rubric, both clarification stages, reviewer ownership, task changes, final score edits and rendered controls without live API calls.

Run `psql -v ON_ERROR_STOP=1 -f tests/peet-ai.fixture.sql` only in a new empty disposable local database. It uses the real officer submission/evaluation migrations plus small membership fixtures, applies the AI migration twice, and checks RLS, denied writes, clarification ordering, reviewer identity, changed goals, prior Q&A history, edited-score approval, actual `peet_evaluations` updates, the existing average formula, duplicate approval, disabled access and shared rate limits. Never run fixture setup in a real Supabase project.


## Collaborative contributions

Apply `supabase/officer-individual-contributions.sql` **after** this feature's existing migrations. It changes the unique review key to `(task_id, student_id)` and stores evaluation subjects in `peet_evaluations.officer_id`. The first participant delivers the team output. Each participant separately describes their own contribution and completes their clarification questions. Reviewers select a contributor, answer questions about that person's work, and approve or override only that person's scores. A secondary form supports manual individual evaluations after the person's reflection is submitted. No task-wide manual score is allowed for an individual-scoring collaboration.

The shared delivery timestamp and each officer's reflection timestamp are separate. Prompts explicitly prohibit assigning equal scores from shared output or treating the delivery timestamp as proof of someone's personal completion timing. No participant can read another officer's reflection or review any part of their own team task. Existing completed group scores are preserved; open unscored collaborations upgrade. Run the disposable local fixture `tests/officer-individual-contributions.fixture.sql` with psql for permission, independent scoring, legacy compatibility, and task-completion checks. Never paste that test fixture into Supabase.
