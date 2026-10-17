# GEA One planning and follow-through

Apply `supabase/gea-operations.sql` **after `officer-shared-tasks.sql` and before deploying the updated site**. The migration is additive and safe to reapply. Fresh installations include it at the end of `supabase/schema.sql`. No handbook or handoff space is included.

Officers use a single **Officer workspace**. Ordinary officers open `/officerboard`; staff with officer access open `/admin-portal-x7k9/officers` inside their academy workspace. GEA One home has one workspace destination, with no separate Planning or Inbox card.

The workspace has six sections:

- **Overview:** next actions and updates in one list. Updates point to the underlying work. Weekly summaries and the control for marking updates seen are in a collapsed **Updates & weekly summaries** section. Marking an update seen never completes pending work.
- **My work / Officers:** the existing task, PEET, attendance, volunteer, and private accountability records, with the directory and team roster for reviewers. Help requests live beneath the tasks. The selected officer’s **Summary** shows their progress; **Concerns & notes** holds private accountability records.
- **Calendar:** filterable agenda containing meetings, volunteer/outreach events, task deadlines, and staff-only interview availability. Individual events and filtered lists export as `.ics`. These are imports, not live subscriptions; export again after changes.
- **Meetings:** agenda and meeting-notes Google Docs, and secretary/reviewer roll call. The secretary and reviewers save an agenda Google Doc link and a meeting-notes Google Doc link. All officers can open the linked documents. Written agendas and minutes from the previous workflow remain in collapsed history.
- **Events:** organizer, staffing, supplies, recap, and preparation checklists. Participation and verified hours remain in My work (Officers for reviewers).
- **Reports:** date-filtered accomplishments, completed projects, verified service, and attendance, with CSV and print/PDF exports. Personal evaluations and accountability records are excluded.

Old `/operations` links redirect officers into the matching workspace section, preserving task and meeting identifiers. Saved digest links continue to work. Task and roster records stay mounted after opening My work (Officers for reviewers) so switching sections preserves roster drafts. Meeting/event forms prompt before discarding unsaved edits; sign-out and page navigation use the existing draft guard.

Staff without active officer access can read their academy updates through `/operations`, but do not receive officer tools or records. No permissions or database schema change is needed for the unified navigation.

## Secretary permissions and safeguards

Document sharing access is managed in Google Docs. Saving a link does not change Google sharing permissions.

The secretary's roll call returns only officer names, positions, and attendance statuses. It never reveals absence notices, reviewer notes, evaluations, strikes, or audit history. Saves preserve existing private reviewer notes. A disabled officer loses access immediately. Attendance never generates a strike automatically. Existing rules about future attendance and corrections linked to confirmed strikes still apply.

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
