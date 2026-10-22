# GEA One planning and follow-through

Apply `supabase/gea-operations.sql` **after `officer-shared-tasks.sql` and before deploying the updated site**. The migration is additive and safe to reapply. Fresh installations include it at the end of `supabase/schema.sql`. No handbook or handoff space is included.

Officers use a single **Officer workspace**. Ordinary officers open `/officerboard`; staff with officer access open `/admin-portal-x7k9/officers` inside their academy workspace. GEA One home has one workspace destination, with no separate Planning or Inbox card.

The workspace has six sections:

- **Overview:** next actions and updates in one list. Updates point to the underlying work. Weekly summaries and the control for marking updates seen are in a collapsed **Updates & weekly summaries** section. Marking an update seen never completes pending work.
- **My work / Officers:** the existing task, PEET, attendance, volunteer, and private accountability records, with the directory and team roster for reviewers. Help requests live beneath the tasks. The selected officer’s **Summary** shows their progress; **Concerns & notes** holds private accountability records.
- **Calendar:** filterable agenda containing meetings, volunteer/outreach events, task deadlines, and staff-only interview availability. Individual events and filtered lists export as `.ics`. These are imports, not live subscriptions; export again after changes.
- **Meetings:** agenda and meeting-notes Google Docs, and secretary/reviewer roll call. The secretary and reviewers save an agenda Google Doc link and a meeting-notes Google Doc link. All officers can open the linked documents. Written agendas and minutes from the previous workflow remain in collapsed history.
- **Events:** organizer and a Google Doc planning sheet link. Staffing, supplies, preparation items, and recaps live in the linked document. Participation and verified hours remain in My work (Officers for reviewers).
- **Reports:** date-filtered accomplishments, completed projects, verified service, and attendance, with CSV and print/PDF exports. Personal evaluations and accountability records are excluded.

Old `/operations` links redirect officers into the matching workspace section, preserving task and meeting identifiers. Saved digest links continue to work. Task and roster records stay mounted after opening My work (Officers for reviewers) so switching sections preserves roster drafts. Meeting/event forms prompt before discarding unsaved edits; sign-out and page navigation use the existing draft guard.

Staff without active officer access can read their academy updates through `/operations`, but do not receive officer tools or records. No permissions or database schema change is needed for the unified navigation.

## Secretary permissions and safeguards

Document sharing access is managed in Google Docs. Saving a link does not change Google sharing permissions.

The secretary's roll call returns only officer names, positions, and attendance statuses. It never reveals absence notices, reviewer notes, evaluations, strikes, or audit history. Saves preserve existing private reviewer notes. A disabled officer loses access immediately. Each unexcused absence starts a 24-hour explanation window after applying the strike response window migrations. Existing rules about future attendance and corrections linked to confirmed strikes still apply.

Attendance saves are atomic for the submitted batch and reject stale statuses. Meeting notes and event plans use version checks to prevent overwriting another editor. Operational edits enter the existing reviewer-only audit log. New tables have RLS; browsers write only through permission-checked RPCs.

## Weekly digests and reminders

Members opt into weekly summaries under Overview → Updates & weekly summaries. A summary is stored in their inbox once per Pacific calendar week, with links to relevant work. First-visit generation works without a scheduler. Digests can be downloaded as text. No email, Signal message, or push notification is sent.

For delivery while nobody is visiting, configure `GEA_DIGEST_CRON_SECRET` and the existing server-only `SUPABASE_SERVICE_ROLE_KEY`, then have your hosting scheduler call:

```text
GET /api/operations/digest
Authorization: Bearer <GEA_DIGEST_CRON_SECRET>
```

Schedule once each Monday (for example, 16:00 UTC, which is 8 or 9 AM Pacific depending on daylight saving). The endpoint is idempotent within the same week. The service-only database function reads enabled preferences and builds per-user snapshots; disabled/unaffiliated accounts are skipped. It never changes Auth identities, impersonates users, or sends messages. A digest's visibility also checks its original officer/reviewer/staff scope, so losing reviewer access removes access to old reviewer summaries.

## Validation

```bash
npm run build
node --test tests/*.cjs
```

In an **empty disposable local PostgreSQL database only**, run the existing migration-stage SQL fixtures in their documented order through `tests/officer-shared-tasks.sql`, followed by `tests/gea-operations.sql`. Do not run fixture tests in Supabase. The new fixture verifies secretary isolation, attendance updates and conflicts, note versions, agenda-to-task assignment, event organizer rights, helper visibility, notification isolation, disabled-member denial, and weekly digest idempotency.

## Google Doc meeting links update

Apply `supabase/meeting-document-links.sql` after `gea-operations.sql` before using **Save document links**. This small additive migration adds the two URL fields and a permission-checked save function. It preserves existing agenda items, written notes, decisions, and audit history. Document updates use the existing meeting version to reject stale edits. Only HTTPS links to Google Docs documents are accepted; other hosts and document types are rejected. Fresh installations include this update in `schema.sql`.

Run `tests/meeting-document-links.sql` after `tests/gea-operations.sql` only in the disposable fixture database.

## Mobile workspace layout

The officer workspace uses one page header and shared section navigation. Internal task, meeting, calendar, and event links switch the visible section without a page reload. Reviewer scheduling is available directly beside the meeting/event selector. Individual officer records use native section and officer selectors on phones, while desktop keeps the directory and record navigation. Active task sections are always expanded; archives remain disclosures. Document editing and help requests are secondary inline controls. Attendance saves stay reachable at the bottom on phones, and accomplishment reports use cards instead of a wide table. Officer records already loaded by the page are reused for updates and reports to avoid duplicate database reads.

On wide screens (1100px and above), meeting documents and attendance sit side by side; overview updates and weekly summaries share a main column and a quieter side column. Tablet and phone layouts keep the same content order in a single column. Desktop retains the officer directory beside the selected record and the full report table.

## Event and volunteer planning sheets

Apply `supabase/event-planning-document.sql` after `gea-operations.sql` and `meeting-document-links.sql`, before deploying this update. Fresh installations include it in `schema.sql`. Organizers and reviewers can save or remove a Google Doc planning sheet link; only reviewers can reassign organizers. All active officers can open the saved link. Cancelled events are read-only. Google Docs controls document sharing.

The website no longer edits staffing, supplies, recaps, or preparation checklists. Existing data remains stored without being overwritten by document-link saves. Link saves validate Google Docs URLs, reject stale versions, and use the existing audit log.

Run `tests/event-planning-document.sql` after `tests/meeting-document-links.sql` only in a disposable fixture database.

## Event requests and assignments

Apply `supabase/event-participant-assignments.sql` after `officer-shared-tasks.sql` before deploying this update. Fresh installations include it in `schema.sql`. Existing commitments become participation requests.

In Events, reviewers can find officers, assign or unassign them, and edit their role and participation notes. The volunteer roster and individual officer records offer the same controls. Officers can request participation or withdraw their request. Requests and assignments are independent: withdrawing a request leaves the reviewer assignment in place, and unassigning leaves an officer's request in place. Participation details are visible only to the officer and reviewers under existing row permissions. Cancelled events are read-only. Assignment edits reject stale versions and enter the audit log. Requests and assignments never award service hours; actual service still requires verification.

Run `tests/event-participant-assignments.sql` in the disposable fixture database after `tests/officer-shared-tasks.sql`.

## Compact officer workspace

The officer and reviewer workspace starts with work that needs an action. Ordinary officers see their assigned and shared tasks first, ordered by deadline, with **Submit work** directly beside each task. Saved clarification requests appear as **Answer questions**, including when the original task is already submitted. Work waiting for a reviewer is grouped separately. Overview links open the existing task dialog in place.

The main navigation contains Overview, Tasks (My tasks for officers), Meetings, and Events. Calendar, attendance, volunteer service, officer records, reports, and authorized account tools are grouped under **More**. The task badge counts work requiring an action rather than unread notices. Phones show Overview, My tasks (Tasks for reviewers), and More as three touch-sized destinations; Meetings and Events move into the full-width More menu alongside the other sections. Desktop keeps its direct Meetings and Events tabs. Both retain the existing unsaved-change guards.

Progress statistics, team officer snapshots, and waiting submissions use disclosures. The overview shows the next three meetings/events; Calendar keeps the full schedule. Task reminders and calendar entries are not repeated in the other-actions list. Additional updates remain expandable, and marking updates seen does not complete their underlying work.

This layout update requires no new migration. Clarification labels use a read of the existing AI review table; installations awaiting AI setup can still open the officer workspace. Existing evaluation, submission, and membership permissions remain authoritative. Verification includes rendered officer/reviewer views, deadline ordering, shared-task isolation, visible task actions, direct dialog links, and guarded navigation. Live browser and device rendering were not available for this pass.

On phones, task actions sit beneath the title and due date with a 48px minimum touch height. Task dialogs use single-column score inputs, 16px form text, and safe-area padding. The More menu stays within the workspace width and scrolls on short screens. Automated responsive-style and interaction checks cover these rules; live phone/browser rendering remains to be verified.

Meetings and events also have a short description directly in GEA One. Reviewers can add it when scheduling or through **Edit schedule & description**. Officers see it above the document links. Google Docs remain optional supporting links. This reuses the existing event-notes field and does not require another database migration.


### Professionalism and conduct logging

Reviewers can open **More → Conduct & strikes**, select an officer, and choose **Log conduct strike**. Attendance and conduct remain separate categories. Incidents stay pending during a 24-hour response window; unanswered incidents automatically become strikes after it ends. Apply `supabase/officer-strike-responses.sql` and then `supabase/officer-strike-response-window.sql` after `officer-strike-notifications.sql` to let officers explain their circumstances from **Concerns & notes** or the bot's private Discord form. Unanswered active incidents appear in the officer's attention list. Reviewers see the explanation alongside the incident and can revoke a strike after reviewing it. A timely response keeps the incident pending for reviewer judgment. See [Discord setup and delivery behavior](discord.md#attendance-and-conduct-explanations).
