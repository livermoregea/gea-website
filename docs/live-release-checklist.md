# GEA One live-release checklist

Prepared October 14, 2026. Automated checks apply to this local checkout. Manual
items remain unchecked until verified on a production-configured preview.

## Cleanup completed

- [x] Removed the destructive operational reset script and its dedicated SQL fixture.
- [x] Removed references to the reset procedure from the officer documentation.
- [x] Removed the root Mac metadata file.
- [x] Confirmed local environment secrets, build output, dependencies, and TypeScript cache are ignored by Git.
- [x] Kept application source, production SQL migrations, documentation, and regression tests. Tests are not public Next.js pages.

Removing a script does not remove or restore any records in Supabase. No live
database cleanup, migration, deployment, commit, or push was performed here.

## Automated verification

- [x] `node --test tests/*.cjs`: **95 passed, zero failed**.
- [x] `npm run build`: production compilation and type validation passed.
- [x] `git diff --check`: passed.

The Node suite covers account routing, role boundaries, form failures/retries,
profile pending states, accessibility label associations, task editing/deadline
rules, PEET/tracking calculations, account API authorization, exports, notification
handling, draft navigation, and mobile attendance status/notes, explicit saving,
and failed-save retries. It does not replace real-device browser checks.
SQL regression fixtures were exercised during feature development in disposable
local databases; they are retained for repeatable future testing.

## Before deploying the application

- [ ] Confirm the host has the intended production `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Check which migrations have already been applied. Apply only the outstanding production migrations in order, before deploying code that reads the new fields:

  1. `supabase/officerboard.sql`
  2. `supabase/officer-accountability.sql`
  3. `supabase/super-admin.sql`
  4. `supabase/teacher-super-admin.sql`
  5. `supabase/officer-task-followthrough.sql`
  6. `supabase/officer-task-editing.sql`
  7. `supabase/officer-task-submissions.sql`

- [ ] Apply `supabase/application-archives.sql` if application archiving is part of this release and has not been installed. Verify existing `forum_admin_overrides.sql` setup if verified moderation overrides are enabled. Fresh installations use `schema.sql`; SQL files under `tests/` are disposable fixtures, not production migrations.
- [ ] Confirm the production task table has `original_due_date` and `submission_description`, and officer task/cancellation RPCs are present.
- [ ] Check the intended super-admin owner and approved teacher memberships. Teacher profiles automatically grant admin/super-admin access; ordinary student signup must not grant staff access.
- [ ] Review actual Supabase records: remove/deactivate remaining test memberships through the appropriate trusted administration process and confirm intended officers, tasks, meetings, attendance, and concerns are the records you want live.
- [ ] Review `git status` and the full diff. Include the new application files, shared components/helpers, required SQL migrations, docs, and tests; confirm no secrets or local artifacts are staged. Keep `BUILDERS_ENABLED = false` unless that feature is intentionally launching.

## Minimum manual smoke test

Use separate student, officer, and teacher/admin accounts, plus an anonymous
browser session. Use controlled sample data in a production-configured preview;
do not create destructive test records in the live academy data.

- [ ] **Anonymous and sign-in:** the public header says Sign in. Correct credentials succeed; incorrect credentials show a useful error and permit retry. Sign out works; an offline/failed request does not falsely claim the session ended.
- [ ] **Role destinations:** a regular student lands in the forum; officers and teachers/admins land at GEA One home. Head to home returns to the right destination. The signed-in menu has Head to home and Sign out.
- [ ] **Merged workspace:** admins see one Academy workspace card. Academy administration and Officer accountability switch within the shared frame. Direct officer URLs send staff into that frame; ordinary officers keep their own dashboard. Students and users without active membership cannot open restricted tools by entering the URL directly.
- [ ] **Forum:** create a post, reply, vote/unvote, and report using an authorized sample account; confirm actions persist after refresh and selected votes are identified correctly. Check moderation with a designated admin.
- [ ] **Profile requests:** submit a change, see Pending review immediately and after refresh, approve/reject it as admin, and check the member sees the result. A connection failure preserves entered values and permits retry.
- [ ] **Task permissions:** an assigned task is editable by its assigner, not its assignee or an unrelated reviewer. A self-created task allows only description changes and a date within three days of its original deadline; repeated edits cannot extend that window. Submitted self-created tasks and closed tasks remain locked.
- [ ] **Submission and PEET:** submit description-only, link-only, and combined work. Empty work is rejected. Review the evidence and score 3/3/3: the total is 85, meets expectations, and uses the good-score mint color. Confirm history survives refresh. Test cancellation with independent review using sample records.
- [ ] **Attendance and meetings:** create a sample meeting, record and save attendance, switch meetings and return, and reload. On a phone, confirm each officer card offers all statuses and notes without sideways scrolling, and that the fixed Save bar stays usable with the keyboard and larger text. Resize to desktop and back with unsaved edits; choices and notes must remain. Verify unsaved changes are protected when leaving by a workspace link or signing out. Check partial-save failures retain unsaved rows. Recording an unexcused absence requests an explanation within 24 hours; unanswered incidents automatically become strikes at expiry. Repeated saves must not duplicate the strike or request.
- [ ] **Volunteer and accountability:** log actual service times, approve/return a log, and check verified totals. Exercise a concern, officer response, and reviewer decision. Attendance and conduct counts remain separate. Only authorized reviewers/advisors can make the corresponding decisions.
- [ ] **Admin operations:** use sample records to confirm account creation/access editing, teacher invitations, student management, profile reviews, interview slots, leadership changes, and announcement controls. If archiving is used, verify an export before testing its clearing action in the preview.
- [ ] **Device/accessibility:** inspect home, forum, workspace, task modal, and roster at phone and desktop widths and 200% text size. Use keyboard navigation and a screen reader. Confirm dialog opening/closing focus, errors, table scrolling, reduced motion, and no clipped or covered actions.

## After deployment

- [ ] Open the deployed site in a fresh browser session and repeat sign-in, role destination, workspace navigation, forum read, and sign-out checks.
- [ ] Check hosting/server logs and Supabase errors for missing columns/functions, permission failures, or failed account requests.
- [ ] Confirm test accounts/records and private data are not visible in the public site, and no service key appears in browser-delivered content.

The remaining design improvements documented in `gea-one-design-review.md`
(self-service password recovery, older admin feedback consistency, and a more
compact bulk roster) are distinct from the automated checks above. Live browser
and screen-reader verification have not been completed by this cleanup pass.

## October 18 admin and AI scoring review

See [the current admin and AI release review](admin-ai-release-review.md) for the
249-test result, isolated production build, dependency security fixes, disposable
PEET database fixture, live synthetic provider check, and remaining authenticated
browser and deployment gates. The earlier results above are historical.

## Attendance and conduct explanations

Apply `supabase/officer-strike-responses.sql` after the strike-notification migration
(and the Discord workspace migrations if using the bot), then deploy. Verify a new
unexcused absence and conduct strike each show an unanswered request on the member's
website and send one private Discord form to a linked member. Submit from either
surface, refresh the other, and confirm reviewers see the explanation. Test a
revoked strike, a disabled member, an unlinked member, and blocked Discord DMs;
the website form must remain available for active members. No production migration
or live Discord messages are sent by the local verification tests.

Apply `supabase/officer-strike-response-window.sql`, then run
`supabase/officer-strike-response-scheduler.sql` in the Supabase SQL editor as
`postgres`. Verify `gea-officer-strike-response-expiry` is active and has successful
runs under Integrations → Cron → History. Keep Vercel crons empty on Hobby.
Deadline enforcement now runs inside the database without Vercel or an external
scheduler. Configure Discord delivery/retries separately; see
[deployment and Discord retries](discord.md#vercel-hobby-deployment-and-discord-retries). Check that
website and Discord show the same deadline, a timely reply remains pending for
review, a late reply is rejected, and a timed-out incident becomes a strike on the
next scheduler tick. `tests/officer-strike-response-window.sql` verifies the
boundary rules, repeated processing, permissions, corrected absences, and the
third-strike advisor review in a disposable local database.
