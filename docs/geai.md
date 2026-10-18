# GEAI dashboard briefings

GEAI replaces the expanded notifications list on the officer overview and administration dashboard with up to three linked priorities chosen and ordered by rules. AI writes only the short descriptions underneath those items; the list, headlines, links, and overview introduction come from the site. Task actions remain directly below it; all workspace updates and weekly digest controls remain in collapsed disclosures. Both layouts adapt to phones.

## Setup

1. Run **all of `supabase/gea-geai.sql`** in the Supabase SQL editor after the existing operations/account migrations. It is also included at the end of `supabase/schema.sql` for new databases. This adds the cache, queue, leases, and daily request counter.
2. Keep the existing server-only `GROQ_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Set a random server-only `CRON_SECRET` in the deployment environment. Never prefix these with `NEXT_PUBLIC_`.
3. Deploy `vercel.json`. It schedules `GET /api/operations/geai/refresh` daily at 13:00 UTC (6 a.m. Pacific daylight time / 5 a.m. Pacific standard time). Vercel supplies `Authorization: Bearer <CRON_SECRET>` automatically.
4. Open the dashboard to queue its first authorized snapshot. The AI summary appears after a scheduled run. Until then, GEAI shows the saved event/task description excerpt, labeled **Description**, or rule-based guidance if there is no saved text.

The default daily schedule is compatible with Vercel Hobby. For a plan that supports more frequent cron jobs, change the schedule to `0 */6 * * *` for every six hours. Alternatively, an existing external scheduler can call that same endpoint every six hours with the bearer secret. Do not configure both schedules unless intended. See [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) and [securing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

`GROQ_GEAI_MODEL` optionally selects a separate available Groq model; it falls back to `GROQ_PEET_MODEL`, then `llama-3.3-70b-versatile`. GEAI uses the same JSON-object transport and strict local Zod validation as PEET. Its response schema contains descriptions only, with at most 260 characters for each of the three selected items.

## Request limits and freshness

- **Opening or refreshing the dashboard makes zero Groq calls.** `POST /api/operations/geai` authenticates the viewer, loads records through their Supabase session/RLS, updates their queued snapshot, and returns only a matching cached summary.
- All viewers have separate summaries. A shared summary would risk exposing another officer's tasks or staff-only queues.
- Only the secret-protected scheduler calls Groq. Each invocation claims at most **six jobs**, and SQL permits at most **24 attempts per UTC day across the entire deployment** and **one attempt per user per six hours**. With the default daily schedule, at most six users are processed each day; remaining users wait their turn. The six-hour schedule supports up to 24 attempts per day. Limits are deliberately conservative and can mean a longer wait on larger rosters.
- Database locks, leases, and budget reservations work across serverless instances and overlapping scheduler runs. Reservations include failed or interrupted attempts. SDK retries are disabled.
- Unchanged snapshots reuse cached text for up to 24 hours. The current Pacific calendar date is part of the snapshot. Changes to visible tasks, permissions, or dates immediately stop displaying the older summary and show live priorities until background generation catches up. The worker cannot publish an older result over a newer queued snapshot.
- The worker summarizes the latest **queued** snapshot from a recent dashboard visit, not a live service-role read of all users' tasks. Inactive viewers (no visit in 48 hours) are skipped. This avoids recreating RLS with a privileged client.
- Refresh reloads records and cached text; it does not bypass scheduling or the budget. Missing SQL/configuration, provider failures, or exhausted budgets leave the dashboard's live snapshot usable. No model call happens on a cache miss.

## Data and output boundaries

The model receives only the three visible, rule-selected task/reminder/event facts from records the viewer could read when queued. Task items also include the first **600 characters** of their written assignment instructions from the viewer’s permission-filtered task record. Meeting/event items include up to **600 characters** of their directly entered description (`officer_events.notes`). Emails, student IDs, meeting minutes, evaluation justifications, submitted-work descriptions, and linked deliverable contents are excluded. GEAI does not fetch external documents or links. Longer instructions remain available in the original task. Titles, details, and assignment instructions are treated as untrusted data; embedded directions to change the model’s behavior are not instructions for GEAI. One background call writes all visible descriptions in a batch. The model references source IDs; the server requires exactly the selected IDs, rejects missing/invented/duplicate references, and attaches descriptions in the original rule-based order. AI cannot change titles, links, or which items appear. AI text is plain React text, not HTML. This validates structure and links; users can still inspect original records to verify a generated claim.

The queue and cached text are server-only tables. Page responses are `private, no-store`. Cache keys include a fresh snapshot of the viewer's records and role context. Auth account deletion cascades to their GEAI cache; the daily counter contains no user IDs.

## Verification

Run `node --test tests/geai.cjs` for source filtering, structured output, provider-free page reads, access checks, and scheduler authentication. The cache migration is also tested locally with PostgreSQL for concurrent leases, stale-result rejection, cross-user isolation, RLS permissions, and the global daily cap.

## Greeting and presentation

Signed-in home, administration, officer workspaces, and the forum show a large greeting in green with the viewer's display name in gold. The greeting follows Pacific time (morning before noon, afternoon until 5 p.m., then evening), updates each minute, and refreshes when the tab regains focus.

The GEAI mark uses four abstract green-and-gold shapes around an open center and is a native SVG in `public/images/geai-mark.svg`. The inline pinwheel rotates while its four pieces expand and contract during loading. Each dashboard entry and cache refresh also plays a lightweight loading shimmer, followed by a short word and priority reveal. This animation presents the saved briefing; it never triggers generation or changes the saved update timestamp. Reduced-motion preferences disable the animation, and screen readers receive the complete summary rather than individual animated words.

Each priority includes a short description beneath its headline. Cached model-written text is labeled **GEAI**; until it is available, the saved description excerpt is shown as **Description**, with rule-based **Next step** guidance used only when no description exists. The AI receives the item’s title, status, date, workflow guidance, and a bounded excerpt of its written task instructions, so its description explains the item without inventing assignments or writing a tutorial. Submitted work waiting for review must not become a new obligation. Cache format version 2 invalidates the previous AI-selected list format; existing JSON cache tables need no additional SQL migration.

Editing the included instruction excerpt changes the existing snapshot fingerprint automatically. Stale descriptions stop displaying until the next scheduled batch; refresh still makes zero AI calls. The three-item batch limit, output limits, and daily request budget stay the same. This requires no new SQL migration.

## Meeting and event descriptions

Reviewers can write a **Meeting description** or **Event description** when scheduling an item, or open **Edit schedule & description** on an existing item. The same field is available in the older event editor. It saves through the existing event-notes column and event RPC, preserves existing notes, and requires no new SQL. Existing reviewer permissions still control editing; officers can read the description above the agenda/plan links. Internal descriptions are separate from the public volunteering description.

Use this area for the purpose, preparation, and expected officer participation. Google Docs links remain available for full agendas and plans. GEAI reads the bounded local text during its next scheduled batch; it does not open or fetch linked documents. Editing this text changes the snapshot fingerprint, so older cached descriptions are replaced by live workflow guidance until the next batch is ready.

## Local background generation and diagnostics

Vercel cron does not run on localhost. `npm run dev` now starts Next.js plus a local timer that calls the existing protected worker once per minute. The launcher creates a temporary development-only bearer secret for its child process; it does not write or print the secret. The timer only runs when the Groq key and Supabase service key exist. Set `GEAI_DEV_SCHEDULER=0` to disable it. An existing development server must be restarted to use the launcher. `--port` / `-p` and `PORT` select the local port.

These timer checks read the database queue; only eligible jobs call Groq. The same global 24/day budget and six-hour per-user interval apply, including when local development and production share a database. Opening the page or clicking Refresh still never calls Groq. Production continues to use the Vercel schedule and requires its own `CRON_SECRET` deployment setting.

The dashboard distinguishes saved text from **GEAI** output and reports when generation is pending, unconfigured, or blocked by missing cache setup. A saved description updates immediately after a record edit, without waiting for AI. To check a local run, look for `[GEAI] Background descriptions: N/M updated.` in the terminal; a zero update count is not a successful generation.
