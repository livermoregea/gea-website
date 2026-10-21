# GEA One in Discord

This module uses the website's canonical officer records, attendance RPCs, task participants, PEET rubric, independent reviewer checks, and CAGE calculator. Ordinary Discord roles never grant database permissions. All commands respond privately; document links, notes, clarification answers, and scores stay out of public webhooks.

## Setup

1. Apply `supabase/discord.sql` after the current officer migrations, including `officer-preregistration.sql`, `officer-shared-tasks.sql`, `gea-peet-ai.sql`, `officer-individual-contributions.sql`, and the current attendance/strike migrations. It is safe to reapply. Do not run test fixture SQL in production.
2. Create a Discord application and bot in the [Developer Portal](https://discord.com/developers/applications). Set its Interactions Endpoint URL to `https://YOUR_DOMAIN/api/discord/interactions` after deploying the environment variables below. Signature-verified PING works without database access.
3. Set `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, and `DISCORD_GUILD_ID` in the server environment. Never put bot, webhook, service-role, Groq, or cron secrets in `NEXT_PUBLIC_*` variables or chat.
4. Install the app in your guild with `bot` and `applications.commands` OAuth scopes. Grant View Channel, Send Messages, and Embed Links only in the intended channels. No Administrator or Message Content intent is needed. Members should allow DMs from the bot; clarification falls back to the private interaction response if DMs are blocked.
5. Create private `#gea-review` and officer-only `#tasks` and `#attendance` channels. Set `DISCORD_REVIEW_CHANNEL_ID` to the review channel ID. Optionally create incoming webhooks for `DISCORD_WEBHOOK_TASKS`, `DISCORD_WEBHOOK_ATTENDANCE`, and `DISCORD_WEBHOOK_ANNOUNCEMENTS`. Avoid public attendance channels. Webhooks contain task status/deadline updates, named attendance receipts, and academy evaluation milestones at 1, 10, 25, 50, 100, 250, 500, and 1,000 evaluations, without personal attendance reasons or scores.
6. Enable Discord in Supabase Authentication → Providers. Enter the Discord OAuth client ID/secret there, and set the provider callback URL shown by Supabase in the Discord OAuth portal. Add `https://YOUR_DOMAIN/auth/callback` to Supabase's allowed redirect URLs. Enable manual identity linking in Supabase Auth for existing accounts.
7. Existing officers sign in using their original school account, then use **Connect Discord** on Account Home. Later they can use **Continue with Discord**. Supabase automatically links matching verified email identities; the callback binds the verified Discord identity to the canonical officer profile and honors a same-origin `next` path. Different-email identities must be linked while signed into the original account. Preregistered officers must finish their existing reserved-ID signup first. No profile IDs, tasks, or sessions are transferred based on an unverified email or a Discord display name.
8. Set `GROQ_API_KEY`, optional `GROQ_PEET_MODEL`, `SUPABASE_SERVICE_ROLE_KEY`, and a random `CRON_SECRET`. The native `@ai-sdk/groq` provider is used for Discord AI work.
9. Register commands from a trusted terminal with server credentials loaded: `node --env-file=.env.local scripts/register-discord.mjs`. This upserts these commands without deleting other application commands. Assignment and review commands default to Manage Server members; use Discord's Integrations command permissions to allow your reviewer role. The attendance command is available to secretaries and reviewers, enforced by database permissions. Database permissions remain authoritative.
10. For immediate website notifications, create a Supabase **Database Webhook** on `public.discord_jobs` for **INSERT**. Choose HTTP POST to `https://YOUR_DOMAIN/api/discord/jobs` and add `Authorization: Bearer YOUR_CRON_SECRET` as a header. Supabase delivers this asynchronously after the database transaction. Also schedule this endpoint every minute, with the same header, for retries. Use an external scheduler or a Vercel plan supporting minute cron; if using Vercel, add `{ "path": "/api/discord/jobs", "schedule": "* * * * *" }` to its cron list. No hosting-plan change is made automatically. Inspect `discord_jobs.failed` and `attempts` for delivery problems.

## Commands and workflow

- `/tasks` or `/submit-task`: choose one of your 25 most recent open tasks, open the modal, add personal work notes and a required Project / Doc Link. Evidence is committed before Groq is called. Existing shared deliverables are preserved; personal contribution evidence is stored separately.
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

There is a small crash window between the initial response and persisting its post-response job. For strict durable acceptance before ACK, persist the job on the request path (with a sub-three-second database timeout) or use an external ingress queue; that would change the requirement that all database mutations occur after ACK.

This release covers the officer task, review, attendance, event lookup, and score workflows above. Meeting minutes, volunteer time logs, strikes/appeals, roster provisioning, academy applications, and forum moderation still use the website. Committee channel notifications do not implement membership-based group assignment. Add those workflows through the fixed database action allowlist when their Discord UX is defined.

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

The registration script now respects Discord's command rate limits. If Discord returns HTTP 429, it waits for the supplied retry delay and retries the same command. Keep the terminal running until all eight `Registered /...` lines appear. Re-running the script updates the commands without deleting unrelated application commands. If it stops with another HTTP error, resolve that error before expecting the remaining commands to appear.

## Interactive Discord attendance

Run `/mark-attendance` with no arguments. Choose the meeting by name and date from a dropdown; the closest events to today appear first. Secretaries see meetings; reviewers can also choose service events. Event lists and rosters paginate in groups of 25.

The private roster lets you select one or more officers, then choose Present, Tardy, Excused, Unexcused, or Not recorded. **Mark all present** fills only unmarked officers and preserves existing or drafted exceptions. Nothing is written to attendance until **Save attendance**. **Discard** closes the draft without saving. The same private message updates as you work, and no names or event UUIDs need typing. Officers do not need linked Discord accounts to appear in the roster.

Roster sessions belong to the reviewer/secretary who opened them and expire after one hour. Every operation rechecks active access, version, and ownership. Saving a meeting uses `save_meeting_attendance`; stale status changes reject the entire batch instead of overwriting a website/other-reviewer edit. Reviewer-only service-event saves use the existing attendance RPC and preserve private notes. Notification jobs are queued only by committed attendance changes.

To activate: apply the full updated `supabase/discord.sql`, deploy the website code, **then** rerun `node --env-file=.env.local scripts/register-discord.mjs` to replace the old required command options with the roster command. The existing single-officer handler remains compatible with old registrations during deployment. Do not switch the registered command to the no-argument definition before deploying its handler. Verify locally with `tests/discord-roll-call.cjs` and, in an empty disposable PostgreSQL database only, `tests/discord-roll-call.fixture.sql`.
