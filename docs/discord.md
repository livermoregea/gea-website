# GEA One in Discord

This module uses the website's canonical officer records, attendance RPCs, task participants, PEET rubric, independent reviewer checks, and CAGE calculator. Ordinary Discord roles never grant database permissions. All commands respond privately; document links, notes, clarification answers, and scores stay out of public webhooks.

## Setup

1. Apply `supabase/discord.sql` after the current officer migrations, including `officer-preregistration.sql`, `officer-shared-tasks.sql`, `gea-peet-ai.sql`, `officer-individual-contributions.sql`, and the current attendance/strike migrations. It is safe to reapply. Do not run test fixture SQL in production.
2. Create a Discord application and bot in the [Developer Portal](https://discord.com/developers/applications). Set its Interactions Endpoint URL to `https://YOUR_DOMAIN/api/discord/interactions` after deploying the environment variables below. Signature-verified PING works without database access.
3. Set `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, and `DISCORD_GUILD_ID` in the server environment. Never put bot, webhook, service-role, Groq, or cron secrets in `NEXT_PUBLIC_*` variables or chat.
4. Install the app in your guild with `bot` and `applications.commands` OAuth scopes. Grant View Channel, Send Messages, and Embed Links only in the intended channels. No Administrator or Message Content intent is needed. Members should allow DMs from the bot; clarification falls back to the private interaction response if DMs are blocked.
5. Create private `#gea-review` and officer-only `#tasks` and `#attendance` channels. Set `DISCORD_REVIEW_CHANNEL_ID` to the review channel ID. Optionally create incoming webhooks for `DISCORD_WEBHOOK_TASKS`, `DISCORD_WEBHOOK_ATTENDANCE`, and `DISCORD_WEBHOOK_ANNOUNCEMENTS`. Avoid public attendance channels. Webhooks contain task status/deadline updates, named attendance receipts, and academy evaluation milestones at 1, 10, 25, 50, 100, 250, 500, and 1,000 evaluations, without personal attendance reasons or scores.
6. Enable Discord in Supabase Authentication → Providers. Enter the Discord OAuth client ID/secret there, and set the provider callback URL shown by Supabase in the Discord OAuth portal. Add `https://YOUR_DOMAIN/auth/callback` to Supabase's allowed redirect URLs. Enable manual identity linking in Supabase Auth for existing accounts.
7. Existing officers sign in using their original school account, then use **Connect Discord** on Account Home. Discord linking is available only after signing into an active officer account; there is no public Discord sign-in/link button. Students, staff without officer membership, disabled officers, and anonymous visitors cannot start the website linking flow. The connection route and callback recheck current officer access before authorization or binding. Supabase automatically links matching verified email identities; the callback binds the verified Discord identity to the canonical officer profile and honors a same-origin `next` path. Different-email identities must be linked while signed into the original account. Preregistered officers must finish their existing reserved-ID signup first. No profile IDs, tasks, or sessions are transferred based on an unverified email or a Discord display name.
8. Set `GROQ_API_KEY`, optional `GROQ_PEET_MODEL`, `SUPABASE_SERVICE_ROLE_KEY`, and a random `CRON_SECRET`. The native `@ai-sdk/groq` provider is used for Discord AI work.
9. Register commands from a trusted terminal with server credentials loaded: `node --env-file=.env.local scripts/register-discord.mjs`. This upserts these commands without deleting other application commands. Assignment and review commands default to Manage Server members; use Discord's Integrations command permissions to allow your reviewer role. The attendance command is available to secretaries and reviewers, enforced by database permissions. Database permissions remain authoritative.
10. For immediate website notifications, create a Supabase **Database Webhook** on `public.discord_jobs` for **INSERT**. Choose HTTP POST to `https://YOUR_DOMAIN/api/discord/jobs` and add `Authorization: Bearer YOUR_CRON_SECRET` as a header. Supabase delivers this asynchronously after the database transaction. Also schedule this endpoint every minute, with the same header, for retries. Use an external scheduler or a Vercel plan supporting minute cron; if using Vercel, add `{ "path": "/api/discord/jobs", "schedule": "* * * * *" }` to its cron list. No hosting-plan change is made automatically. Inspect `discord_jobs.failed` and `attempts` for delivery problems.

## Commands and workflow

- `/tasks`: browse your task history with pagination and open task management controls. `/submit-task`: choose an open task and submit personal work notes with an optional supporting link. Evidence is committed before Groq is called. Shared team deliverables and personal contribution evidence are stored separately.
- The bot asks 1–3 targeted questions in DM, with an **Answer questions** modal. If DMs fail, questions appear in the private response. Submitting answers sends the contribution into the existing pending-review state and posts a review button in `#gea-review`.
- `/review-task`: choose a pending contribution. The independent reviewer answers targeted questions about expectations, quality, resources, and timing. Groq then supplies a recommendation with **Approve recommendation**, **Adjust scores**, **Request revision**, and **Reject** controls. Approval is one click after reviewer clarification, as required by the existing website contract. The President's work requires an advisor; participants cannot review their own task. Versions and permissions are rechecked in the database at every mutation.
- Revision and rejection retain evidence and award no score. Both return the contribution for clarification; rejection is recorded in reviewer feedback rather than introducing a new website status. The officer can reopen `/submit-task` if a feedback DM fails.
- `/assign-task officer:@Officer channel:#committee`: create the title, expectations, and deadline in a modal. The officer must have linked Discord. Assignments automatically go to the channel configured for the officer’s roster position. The optional channel overrides that destination for this assignment receipt; task ownership belongs to the named officer. Channels themselves are not officer identities or permission groups.
- `/absence-notice`: choose an upcoming meeting/event and describe absence or tardiness. Notice does not automatically excuse attendance.
- `/events`: browse meeting/event details and submit advance absence notices. Actual attendance remains subject to website event timing and strike correction rules.
- `/score`: privately displays the same PEET and CAGE calculation as the website. PEET uses all eligible tasks; confirmed attendance/conduct strikes use the website's current contract year. No evaluations produces N/A.

Complexity, Impact, and Autonomy inform clarification, but the established scores remain Efficiency, Effectiveness, and Time (1.0–4.0). AI cannot open Google Docs or project URLs; officers and reviewers supply the evidence. No automatic approval or speculative scoring occurs.

## Delivery and operations

Incoming interactions verify Ed25519 signatures against the unmodified request body and reject timestamps older than five minutes. Requests are limited to the configured application/guild; DMs support private follow-up controls. Discord requires an initial response within three seconds, so modal responses are immediate and other actions defer with an ephemeral response before work runs in Next.js `after()`. See [Discord's interaction contract](https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx).

Post-response work inserts a durable job, then immediately starts a bounded worker. Cron handles retries using expiring leases and `SKIP LOCKED`, up to five attempts. Mutating officer actions use transactional idempotency keys; AI assessment inserts are unique per task/officer. Discord message delivery is at least once, so a delivery retry can duplicate a receipt. Interaction tokens expire after 15 minutes; jobs discard them after 14 minutes. Finished and terminal jobs scrub payloads. Keep failed-job monitoring and a retention policy for action/draft history.

Successful website task saves and assignments, meeting-workspace saves, and reviewer attendance saves immediately signal `/api/discord/dispatch`. This same-origin POST verifies the current session and officer/reviewer access, responds with 202, and starts delivery in `after()`. Its keepalive request survives the navigation/refresh following a save. It accepts no message payload or channel destination. The worker also checks for jobs created by the command it just processed, so a Discord assignment does not wait for a second command to send its notification. Each invocation drains ready batches until the queue is empty or its 30-second budget is reached; there is no fixed three-batch/15-job cutoff. Saving a task or attendance still succeeds if delivery fails; the durable outbox retains failed deliveries for the protected worker's retries.

This website/command delivery fix requires a deployment, with no additional SQL or command registration. Keep the externally scheduled `CRON_SECRET`-protected `/api/discord/jobs` call for retries and backlog recovery; a website wake request is not a replacement for that schedule. Changes made directly in the Supabase dashboard require that external worker trigger too.

Task submission requires a written explanation; a supporting HTTP(S) link is optional. Raw submitted modal text is saved before business validation in `discord_form_drafts`, separate from validated submissions. Validation and processing failures offer **Edit submitted form**, which reopens the submitted fields with their original formatting. AI failures also offer **Resume submission** using that officer's validated evidence. Reopening `/submit-task` and selecting the task offers recovery; an existing clarification reopens its saved questions without another AI request. Older retried interactions cannot overwrite newer form text. Server logs contain an allowlisted failure category and job ID, never raw provider errors or submitted evidence. Recovery does not approve scores.

Existing installations must apply `supabase/discord-draft-recovery.sql` before deploying this update (the same definitions are included in `supabase/discord.sql` for new installations). Command registration is unchanged. Opening a modal performs only a bounded, owner-scoped draft read before the immediate modal response; draft writes, validation, and AI processing remain in the background. A failed read asks the officer to retry instead of opening a blank replacement. Drafts are service-role only and should be included in your private-data retention policy.

Discord does not send modal keystrokes to the bot: it can preserve text only after the officer presses Submit. Closing an unsubmitted modal cannot be recovered by the bot. On the website, submission explanations, optional links, categories, shared deliverable descriptions, and submitter clarification answers save in this browser as the officer types, scoped by officer and task (and clarification version). They survive refreshes and failed validation/network/AI requests, and clear only after the server confirms success. A visible warning appears if browser storage is unavailable; browser drafts do not synchronize between devices.

There is a small crash window between the initial response and persisting its post-response job. For strict durable acceptance before ACK, persist the job on the request path (with a sub-three-second database timeout) or use an external ingress queue; that would change the requirement that all database mutations occur after ACK.

The officer workspace is available through `/officer` and the commands below. Account provisioning, initial Discord identity linking, academy applications, and forum moderation remain website/account-administration workflows. Discord roles do not grant database privileges.

## Verification

Run `node --test tests/discord.cjs tests/peet.cjs tests/peet-ai.cjs` and `npx tsc --noEmit`. `tests/discord.fixture.sql` runs only in an empty disposable PostgreSQL database and checks real RPC permissions, identity binding, durable evidence, idempotency, and queue leasing. Live OAuth, Discord delivery, Groq requests, and scheduler execution require configured credentials and a deployed HTTPS endpoint.

Groq provider reference: [AI SDK Groq provider](https://ai-sdk.dev/providers/ai-sdk-providers/groq).

## First-time Discord setup, click by click

You do not need an existing bot. Start with these steps:

1. In the Discord desktop app, click **+** in the server list → **Create My Own** → **For a club or community**. Name the server **GEA One**.
2. Open **Server Settings → Roles**. Create **GEA Officer** and **GEA Reviewer**. Assign those roles to the appropriate members. These roles control channel visibility; reviewer rights must also exist in GEA One.
3. Create text channels **tasks**, **attendance**, **announcements**, and **gea-review**. In channel permissions, deny **View Channel** to `@everyone`, allow officers in the first three, and allow reviewers in **gea-review**. Grant the bot access after installing it.
4. Open the [Discord Developer Portal](https://discord.com/developers/applications), click **New Application**, and name it **GEA One**. From **General Information**, copy the **Application ID** and **Public Key** into `DISCORD_APPLICATION_ID` and `DISCORD_PUBLIC_KEY` in your hosting provider's environment variables.
5. Open **Bot**. Create the bot if needed, then use **Reset Token** and save the resulting token as `DISCORD_BOT_TOKEN`. Keep privileged gateway intents disabled; this module does not read channel messages.
6. Under **OAuth2 → URL Generator**, select **bot** and **applications.commands**. Under bot permissions select **View Channels**, **Send Messages**, and **Embed Links**. Open the generated installation URL, choose your new server, and authorize it. You must have permission to manage that server.
7. In Discord, enable **User Settings → Advanced → Developer Mode**. Right-click the server → **Copy Server ID** → save as `DISCORD_GUILD_ID`. Right-click **gea-review** → **Copy Channel ID** → save as `DISCORD_REVIEW_CHANNEL_ID`.
8. For each notification channel, open **Edit Channel → Integrations → Webhooks → New Webhook**, name it **GEA One**, then **Copy Webhook URL**. Save each URL to the corresponding `DISCORD_WEBHOOK_*` variable. A webhook URL is a secret.
9. In Supabase, open your project → **Authentication → Sign In / Providers → Discord**, enable it, and paste the Discord OAuth client ID and client secret from the application's **OAuth2** page. Copy Supabase's callback URL into Discord **OAuth2 → Redirects**. This is Supabase's URL, distinct from the website's `/auth/callback` URL.
10. In Supabase **Authentication → URL Configuration**, set your deployed website as the Site URL and allow `https://YOUR_DOMAIN/auth/callback`. Enable **manual identity linking** in Supabase Auth settings so officers can connect their existing accounts.
11. Apply the migration, set the remaining environment variables, deploy the website, and register the slash commands using the command in Setup. Set up the database webhook and retry scheduler described in Setup step 10. In Discord's application **General Information**, set **Interactions Endpoint URL** to `https://YOUR_DOMAIN/api/discord/interactions` and save. Discord verifies the endpoint immediately.
12. In Discord **Server Settings → Integrations → GEA One**, allow **GEA Reviewer** to use the admin commands and secretaries to use **mark-attendance**. In GEA One, verify those same people have reviewer/advisor access. Sign into the website with the original officer account, click **Connect Discord**, then try `/score` in **tasks**.

If an option's label has moved, look for the same provider, OAuth, role, or integration setting. Never send bot tokens, client secrets, Groq keys, service-role keys, or webhook URLs in this chat. The non-secret website domain, server ID, and channel IDs are enough to discuss the remaining setup.


## Automatic officer task channels

Create officer channels such as **vp**, **secretary**, **publicist**, **treasurer**, and **reps**. Give the GEA One bot View Channel, Send Messages, and Embed Links in each channel. Map their channel IDs in your server environment:

| Officer position | Environment variable |
| --- | --- |
| President | `DISCORD_CHANNEL_PRESIDENT` |
| Vice President / VP | `DISCORD_CHANNEL_VICE_PRESIDENT` |
| Secretary | `DISCORD_CHANNEL_SECRETARY` |
| Publicist | `DISCORD_CHANNEL_PUBLICIST` |
| Treasurer | `DISCORD_CHANNEL_TREASURER` |
| Representatives | `DISCORD_CHANNEL_REPS` |
| 9th Grade Representative (optional separate channel) | `DISCORD_CHANNEL_REP_9` |
| 10th Grade Representative (optional separate channel) | `DISCORD_CHANNEL_REP_10` |

Set each assignee’s **Position** in the GEA One officer roster. Both website and Discord assignments use that field, including common abbreviations such as VP, Rep 9, and Rep 10. Grade representatives use their grade channel if configured, otherwise the shared reps channel. Unknown or unconfigured positions use `DISCORD_WEBHOOK_TASKS`. A configured channel that fails delivery stays in the retry queue rather than sending its contents to a different channel.

The bot posts an embed with the task title/status, deadline, assignee, position, and task ID. New assignments, reassignment to another officer, and task status changes go to the receiving officer’s channel. Existing queued notifications without position information retain the general tasks webhook behavior. An explicit `/assign-task channel:#committee` overrides the destination for the initial assignment receipt only; later status updates use the officer’s channel. Submission notes and project links are not included in these channel notifications.

For an existing installation, reapply the updated `supabase/discord.sql` to upgrade the assignment outbox trigger and command handler, then redeploy with the channel environment variables. No new command registration is required. Live delivery still needs the database webhook/worker from Setup step 10. Channel access remains controlled by Discord channel permissions.

## Already-linked Discord accounts

Account Home displays **Discord already linked** when the authenticated GEA One login has a verified Discord identity. **Check Discord connection** runs the existing officer-binding RPC again, without starting another OAuth authorization. If the identity is linked but officer access is not yet synced, the card says so; successful checks confirm that commands are ready.

Supabase's `identity_already_exists` return is handled both at `/auth/callback` and when Supabase sends it to the website home page. This error alone never grants access: the server checks the current authenticated user's verified identities before syncing the officer profile. If that login has no Discord identity, it directs the user to sign into the original connected account or ask an advisor for help. It never transfers an identity between accounts.

## Attendance in officer channels and role pings

Saving or correcting attendance routes a receipt to the officer’s roster-position channel: VP attendance goes to the configured VP channel, secretary attendance goes to the secretary channel, and so on. The message shows the officer, event, and status. Clearing a mark says attendance is not recorded yet. Saving unchanged attendance does not post another receipt; advance absence notices alone do not create a recorded-attendance receipt. The officer does not need a personal Discord link for position-channel delivery. No attendance DMs are sent; pending private-DM jobs from older versions are retired.

Use the same `DISCORD_CHANNEL_*` mappings as task notifications. Add matching `DISCORD_ROLE_*` IDs to ping just the corresponding Discord role: for example, `DISCORD_CHANNEL_VICE_PRESIDENT` identifies the VP channel and `DISCORD_ROLE_VICE_PRESIDENT` identifies the VP role. The available suffixes are PRESIDENT, VICE_PRESIDENT, SECRETARY, PUBLICIST, TREASURER, REPS, REP_9, and REP_10. Grade reps fall back to the shared reps channel and role when their grade mapping is unset. Role pings apply to task notifications too. Without a role ID, the message posts without a ping. Allow the bot to mention the intended role in Discord; role/channel IDs are different values.

The `DISCORD_WEBHOOK_ATTENDANCE` channel is an optional shared attendance overview for the secretary and reviewers. Set `DISCORD_ATTENDANCE_OVERVIEW=true` to enable it; it defaults to off, so ordinary attendance notifications go only to the officer channels. Set that channel’s Discord permissions for the secretary/reviewers if you want it private. Overview messages never ping officer roles. Missing officer channel configuration stays visible as a failed/retryable job instead of falling back to a different channel. Each role-channel receipt and overview update has a separate job, so a delivery problem cannot block saving attendance or repeat the other successful delivery.

Reapply `supabase/discord.sql` and deploy the worker changes with the channel/role environment variables to activate this behavior. Test with `node --test tests/discord.cjs tests/discord-account-link.cjs` and, in an empty disposable PostgreSQL database only, `tests/discord-attendance.fixture.sql`.

## Secretary roll call

Active officers with **Position = Secretary** in the GEA One roster can open **Attendance**, choose a meeting, mark individual statuses or **Mark all present**, then **Save attendance**. Both secretaries can have this position; no reviewer/admin role is needed. The attendance tab uses the existing `meeting_roll_call` and `save_meeting_attendance` RPCs, which omit private absence explanations and reviewer notes, preserve existing notes, reject stale changes, and prevent marking actual attendance before a meeting starts.

Secretaries can also use `/mark-attendance` for meetings after linking Discord. It opens an event dropdown and roster, using the same safe meeting-attendance RPC when saved. Service-event attendance and private reviewer notes still require a reviewer. Reapply `supabase/discord.sql`, deploy the website, and rerun `scripts/register-discord.mjs` to update the command’s default permissions. Discord Integrations can restrict command visibility to the secretary/reviewer roles; the database checks actual GEA One privileges on every request. Attendance notifications follow the same officer-channel and optional president overview configuration regardless of who takes roll.

## Missing slash commands after registration

The registration script respects Discord's command rate limits. If Discord returns HTTP 429, it waits for the supplied retry delay and retries the same command. Keep the terminal running until every command has a `Registered /...` line. Re-running the script updates the commands without deleting unrelated application commands. If it stops with another HTTP error, resolve that error before expecting the remaining commands to appear.

## Interactive Discord attendance

Run `/mark-attendance` with no arguments. Choose the meeting by name and date from a dropdown; the closest events to today appear first. Secretaries see meetings; reviewers can also choose service events. Event lists and rosters paginate in groups of 25.

The private roster lets you select one or more officers, then choose Present, Tardy, Excused, Unexcused, or Not recorded. **Mark all present** fills only unmarked officers and preserves existing or drafted exceptions. Nothing is written to attendance until **Save attendance**. **Discard** closes the draft without saving. The same private message updates as you work, and no names or event UUIDs need typing. Officers do not need linked Discord accounts to appear in the roster.

Roster sessions belong to the reviewer/secretary who opened them and expire after one hour. Every operation rechecks active access, version, and ownership. Saving a meeting uses `save_meeting_attendance`; stale status changes reject the entire batch instead of overwriting a website/other-reviewer edit. Reviewer-only service-event saves use the existing attendance RPC and preserve private notes. Notification jobs are queued only by committed attendance changes.

To activate: apply the full updated `supabase/discord.sql`, deploy the website code, **then** rerun `node --env-file=.env.local scripts/register-discord.mjs` to replace the old required command options with the roster command. The existing single-officer handler remains compatible with old registrations during deployment. Do not switch the registered command to the no-argument definition before deploying its handler. Verify locally with `tests/discord-roll-call.cjs` and, in an empty disposable PostgreSQL database only, `tests/discord-roll-call.fixture.sql`.

## Officer workspace in Discord

Apply **`supabase/discord-officer-workspace.sql`** after the existing Discord and website migrations listed at the top of that file. Deploy the code, then run:

```sh
node --env-file=.env.local scripts/register-discord.mjs
```

This is an additive migration, not the reset script. It preserves existing tasks, attendance, personal reflections, and verified hours. No new credentials are required. The bot needs access to each configured officer channel and `DISCORD_REVIEW_CHANNEL_ID`. Allow the reviewer role to use `/verify-hours` and `/event-requests` through Discord Integrations; database permissions still decide who can act. Do not register the new commands before deploying their handlers.

| Officer workflow | Discord entry point |
| --- | --- |
| Discover officer tools | `/officer` |
| View open/completed/cancelled tasks, full goals, personal reflections and evaluations | `/tasks`; select a task |
| Create a personal or shared task; select teammates from the officer roster | `/create-task` |
| Edit your own open task and its participants | `/tasks` → select task → Edit task / participants |
| Submit a personal reflection, optional link, and shared team deliverable | `/submit-task` or task controls |
| Answer AI clarification; reopen saved questions | Existing private questions and Answer questions button |
| Request task help, select a helper, mark unblocked | `/task-help` or task controls |
| Request independent cancellation review | `/cancel-task` or task controls |
| View meetings, service events, schedules, attendance, participation and planning links | `/events` |
| Request/withdraw participation in an existing service event | `/request-event` → select event → Request/withdraw |
| Submit an advance absence/tardiness notice | `/absence-notice` or event controls |
| Log actual service times and work notes | `/log-hours`; scheduled times are editable drafts |
| View verified/pending hours, optionally by academic year | `/service-hours [year:2026-2027]` |
| Read attendance/absence notices and service/conduct records privately | `/my-attendance`, `/my-records` |
| Read meeting notes and full agenda; add an agenda item | `/events` → meeting controls |
| Secretary/reviewer: edit document links and assign agenda actions to an officer | Meeting controls; existing website permissions apply |
| Organizer/reviewer: planning Google Doc, add/check event checklist items | Service-event controls |
| Change weekly workspace digest preference | `/officer` → Weekly digest settings |
| PEET and CAGE scores | `/score` |
| Reviewer: inspect submitted times/notes and verify or return a service log | `/verify-hours` or reviewer-channel notification |
| Reviewer: inspect participation requests and assign officers to events | `/event-requests` or reviewer-channel notification |
| Reviewer: inspect task help and decide cancellation requests | `/task-requests` or reviewer-channel notification |

`/request-event` means requesting to participate in an **existing** service event. It does not create a new event or approve the request automatically. Requests and reviewer assignments remain independent, just as on the website. A reviewer sees the request in the private review channel and can assign the officer in Discord.

Shared tasks keep one canonical team deliverable. The first contributor supplies the **team deliverable description** separately from **their personal contribution**. Later teammates submit their own contribution and clarification without replacing the shared deliverable. Each contribution has its own assessment and independent review; one officer's approval does not award everyone the same score. The roster includes active officers who have not personally linked Discord. Each newly added participant receives an assignment receipt in their position channel; shared task status updates reach the other participants too.

Personal reflections and shared deliverable descriptions support up to 5,000 characters using the continuation fields. Task descriptions support up to 10,000 characters across the three task-detail fields. Raw submitted fields are saved before business validation, including formatting errors. Long private records are paginated instead of discarding their remaining text. Team selection is paginated and stored in a private, owner-scoped draft; successful task creation is idempotent. Use `/officer` → **Resume a task draft** to recover unfinished team selection and submitted form text. The one-hour UI lease is renewed for the authenticated owner; expiration does not discard their writing, and canonical permissions are checked again on save.

Only a **reviewer-verified actual service log** counts as verified hours. Attendance, an event assignment, or a participation request never awards hours. Verification from either the website or Discord queues a role-channel receipt containing the officer, event, and the verified duration. Returning a previously verified log queues a correction saying it no longer counts as verified. Pending logs notify the private reviewer channel. No work notes or reviewer feedback are posted to officer channels. Approved logs remain locked against officer edits; stale review controls reject changes rather than approving a different snapshot.

Verify locally with `node --test tests/discord-officer-workspace.cjs tests/discord.cjs tests/discord-dispatch.cjs tests/peet-ai.cjs` and `npx tsc --noEmit`. `tests/discord-officer-workspace.fixture.sql` exercises the actual website RPCs and permission checks in a fresh disposable PostgreSQL database only; never run that test fixture in a live project.

### Attendance and conduct explanations

Apply `supabase/officer-strike-responses.sql` after `officer-strike-notifications.sql`
and the Discord workspace migrations, then apply `supabase/officer-strike-response-window.sql` and
`supabase/officer-strike-president-updates.sql`, and deploy the website. No command
registration change is needed. Fresh databases include the website RPC and trigger
in `schema.sql`; configure Discord using the migrations above as usual.

New unexcused attendance records automatically create a pending incident and queue one
private response request for an active officer with linked Discord. Manually
recorded conduct/attendance strikes use the same request. The bot sends a DM with
**Explain your circumstances** and **Read incident details** buttons. Submitted
explanations are stored on the incident, visible to its officer and authorized
reviewers. `/my-records` → **My conduct records** also offers the response form.
Discord accepts up to 4,000 characters; the website accepts up to 10,000.

The website and Discord message show a fixed response deadline, 24 hours after the
incident is recorded. An explanation submitted before the deadline keeps the
incident pending for reviewer judgment. Without a response, it automatically
becomes a confirmed strike after the deadline. Late forms are rejected in the
database, even if the timeout worker has not run yet. Reviewers cannot confirm an
unanswered incident before its 24 hours are up. Existing confirmed strikes keep
their historical decisions unless you apply the one-time reissue described below.

`vercel.json` schedules `/api/accountability/expire` every minute. Set `CRON_SECRET`
and `SUPABASE_SERVICE_ROLE_KEY` in the deployment. The endpoint uses the service-only
`expire_officer_strike_responses` RPC and works independently of Discord delivery.
Use hosting that supports minute cron, or invoke this endpoint every minute with
`Authorization: Bearer YOUR_CRON_SECRET` from an external scheduler. Expiration
runs on the first scheduler tick after the deadline (normally within one minute).
Timely explanations, dismissed incidents, and corrected/cancelled absences do not
automatically become strikes. Third confirmed strikes still open advisor review.

Delivery uses the existing outbox webhook, immediate dispatch, and retry scheduler.
If a DM fails, the bot posts a generic alert in `DISCORD_NOTICES_CHANNEL_ID`,
mentioning only the affected officer: “@Name, please check the GEA website for a
notice.” Set this to your **notices** channel ID and give the bot View Channel and
Send Messages permissions. Set `NEXT_PUBLIC_SITE_URL` to the public website origin
to include an **Open GEA website** link button. The public alert contains no incident
reason, category, date, strike status, or response text. It never pings an entire
role or @everyone. A successful DM does not post a channel alert. If both delivery
methods fail, the outbox retries as usual; the website form remains available.
The 24-hour deadline still runs from the recorded notice time, including when
Discord delivery fails. The worker rechecks the current Discord link, active access, incident
status, and response before sending. It skips resolved or already answered requests.
The normal workflow migrations do not send DMs for historical strikes; use the one-time reissue below. Explanations and
incident reasons are never posted to role channels by this feature.

Validation: `node --test tests/officer-strike-notifications.cjs tests/discord-officer-workspace.cjs tests/discord-dispatch.cjs tests/discord.cjs`.
Run `tests/officer-strike-response-window.sql` only against a disposable empty local database.

### Reissue existing strikes with the new response system

Deploy the updated website/bot with notices-channel configuration and minute cron,
then apply `supabase/officer-strike-response-reissue.sql` after the response-window
and Discord migrations, while the Discord worker is idle. It renews every active
confirmed/pending strike for active officers, across all years, with a fresh
24-hour deadline starting at migration execution. Dismissed/revoked records and
disabled accounts are skipped. Reopened incidents do not count as confirmed strikes
until an unanswered deadline expires or a reviewer decides after a response.

Each linked officer gets a new DM for each incident, using the same notices-channel
fallback. The message explains that the existing incident was reopened and asks the
officer to submit or confirm their explanation again. Previous explanation text
remains available on the website as a draft; the old timestamp and decision remain
in tracking audit history. Unlinked officers receive the renewed website notice.

The migration reactivates the existing outbox row, even if its previous delivery
finished or failed. The existing outbox webhook/worker delivers these receipts;
after applying, invoke the protected `/api/discord/jobs` endpoint to drain them if
needed. Reapplying the migration does not extend deadlines, reopen later incidents,
or queue another round of DMs. Rollout counts and start time are recorded in the
service-only `officer_strike_response_reissues` table. This is a data rollout for
existing installations; fresh empty databases do not need it.

Verify with `tests/officer-strike-response-reissue.sql` in a disposable local database.

### President notice updates

Apply `supabase/officer-strike-president-updates.sql` after the response-window
migration, before running the existing-strike reissue. Set
`DISCORD_CHANNEL_PRESIDENT` to the private president channel ID; the bot needs
View Channel and Send Messages. `NEXT_PUBLIC_SITE_URL` adds a link to the officer's
reviewer-only website record. Fresh databases include the functions and trigger
in `schema.sql`.

The president channel receives officer name/position, update time, and response
deadline for these events:

- Notice delivered by DM.
- DM blocked or unavailable, with the notices-channel fallback posted.
- Both DM and fallback delivery failed.
- First explanation submitted, whether from the website or Discord.

A delivery error is described as blocked or unavailable because Discord delivery
can fail for reasons besides a member's DM settings. No incident reason or response
text is copied to the channel. The officer's notice delivery and the president's
update have independent outbox jobs: a president-channel delivery failure cannot
undo an officer response or turn a successful DM into a fallback channel notice.
Each delivery outcome is queued once per incident/notice window; a changed outcome
after a retry gets its own update. Response edits do not repeat the received
notification. Reissuing an incident starts a new window, so its new delivery and
response produce new updates. Stale delivery outcomes from an earlier window are
ignored. Network delivery retains the outbox's usual at-least-once behavior.

Verify the database trigger and delivery receipt RPC in
`tests/officer-strike-president-updates.sql` in a disposable local database only.
