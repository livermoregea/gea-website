# Officer Board and PEET

`/officerboard` uses existing Supabase Auth accounts. Officers get their own tasks,
evaluations, and progress; PEET reviewers see the roster, all submitted work, and
an individual officer’s progress. Reviewers start with a searchable directory of officer-name buttons. Selecting a name opens a compact overview. Topic buttons beside the name show Overview, Tasks & PEET, Attendance, Volunteer, or Accountability, one topic at a time. On larger screens the name and topic buttons stay visible while scrolling; compact screens keep them in normal flow. Switching officers preserves the current topic, allowing quick comparisons. On desktop the officer list remains beside the record; on mobile Change officer returns to the directory. Completed tasks use responsive cards with scores, feedback, dates, and readable action buttons rather than a wide table. Review and cancellation queues are scoped to the selected officer, and attendance entry is pinned to that person. A shared academic-year selector updates attendance, volunteer, and accountability records together; task totals and cumulative PEET include all task history. Super admins open account management and website administration from the Administration menu. Task actions live inside the Tasks & PEET topic, with bulk assignment available from the directory. The page is excluded from search indexing.

## Whole-roster tracking

Reviewers have a **Team roster** tab alongside the officer directory. For attendance, choose the school year and meeting, then mark Present, Late, Excused, or Unexcused. Desktop uses a comparison table; phones use compact officer cards with a native status picker and notes action. A fixed mobile save bar shows the unsaved-officer count, Discard, and Save attendance. Both layouts share drafts, including notes, across viewport changes. Unmarked attendance stays unrecorded. **Mark unrecorded present** affects only displayed officers without a status; it preserves existing late or absence decisions and reviewer notes. **Save attendance** writes only changed rows through the existing Supabase attendance RPC. Each row is transactional; if a batch encounters errors, successful rows are kept and the message identifies unsaved rows for retry. Attendance never creates a strike automatically.

Attendance choices and notes remain while switching meetings, years, and roster topics. Pending changes block leaving the roster until saved or explicitly discarded; browser reloads also warn about unsaved changes. Teachers and advisor-only profiles are excluded from the roster.

Volunteer tracking lists every officer’s commitment, check-in/out, verification status, approved-event count, and verified hours. Reviewers can log service and verify or return work from a row. **All events · year overview** provides the participation matrix across the school year. Totals use the same verified, approved, noncancelled-event rules as each individual dashboard. Both views retain access to event creation/editing, search, and individual profiles. All records use the existing Supabase tables and permission-checked RPCs; no new schema is required for the roster.

## Set up the existing database

For an existing database, apply unapplied migrations in this order: `officerboard.sql`, `officer-accountability.sql`, `super-admin.sql`, `teacher-super-admin.sql`, `officer-task-followthrough.sql`, `officer-task-editing.sql`, and `officer-task-submissions.sql` from `supabase/`.
Fresh installations include the same migration at the end of `schema.sql`.
Reapplying the migration preserves records. Basic officer tracking uses the existing public Supabase configuration. Account
administration additionally requires `SUPABASE_SERVICE_ROLE_KEY` on the server.

The existing site has `student_profiles`, `teacher_profiles`, and `admins`, with
different identifiers and permissions. `officer_profiles.id` references the same
`auth.users.id`; it is a dedicated portal membership record, not another login.
PEET permissions are intentionally independent of the existing `admins` list:
site admins include officers who should not automatically be performance reviewers.

Add approved members using their existing **Auth user UUID**, from Authentication
→ Users. Provision roles in the SQL editor or another trusted database service:

```sql
insert into public.officer_profiles (id, name, role, position, reviewer_kind)
values
  ('OFFICER_AUTH_USER_UUID'::uuid, 'Officer Name', 'officer', 'Secretary', null),
  ('PRESIDENT_AUTH_USER_UUID'::uuid, 'President Name', 'admin', 'President', 'president'),
  ('ADVISOR_AUTH_USER_UUID'::uuid, 'Advisor Name', 'admin', 'Academy Advisor', 'advisor')
on conflict (id) do update set name = excluded.name, role = excluded.role,
  position = excluded.position, reviewer_kind = excluded.reviewer_kind;
```

Replace the placeholder UUIDs and names before running. Student/officer accounts are enrolled explicitly. Existing and new teacher
profiles are automatically enrolled as super admins by the teacher-access migration;
signup metadata never assigns portal permissions. The `admin` role
here means **PEET reviewer**. Browsers cannot grant or edit portal roles.
To revoke review access while retaining the person's task history:

```sql
update public.officer_profiles set role = 'officer', reviewer_kind = null
where id = 'REVIEWER_AUTH_USER_UUID'::uuid;
```

Open `/officerboard` and sign in with the existing account. Enrolled members also
get an **Open Officer Board** link on their account profile. An authenticated account
without membership gets an access message and no task data. Missing database setup
gets a setup message rather than a broken or publicly visible dashboard.

## Task workflow and scoring

Only the assigner can edit an assigned task. Officers can edit the description of
their own self-created, in-progress tasks and move the deadline within three days
of its original date; titles and assignees remain fixed. Task deletion is disabled, including through older RPCs and direct database deletes. Officers request cancellation with a reason; another reviewer approves or declines. Pending requests keep the task active. Reviewers may cancel other officers’ tasks with a recorded reason. Their own tasks always require independent review. Requests and decisions are stored and audited in Supabase.

Reviewers use a searchable officer roster with individual progress cards, and can select several officers when adding a task. Supabase creates a separate task per unique officer in a single transaction, with a shared assignment batch ID. Teachers and advisors remain reviewers and cannot be assigned officer tasks; eligibility is also enforced by a database trigger. Emails distinguish separate accounts with the same name. Existing tasks assigned to faculty remain stored; this migration does not guess replacement assignees.

Work submission requires a description, an HTTP(S) link, or both, and moves the
task to `submitted`. Assignees cannot change a submitted task or their scores.
Reviewers check the submitted work, enter three
scores from 1.0–4.0, and save feedback. Submission time and original completion time
are shown; re-evaluations update the evaluation time and preserve completion time.

Evaluation and completion are a single database transaction. Adjustments update
the single evaluation for the task, avoiding duplicate weighting. The score is
`AVG((efficiency + effectiveness + time) / 3) / 4 * 100` for completed, evaluated
tasks belonging to the selected officer. No evaluated work shows an em dash, not
zero. In-progress and awaiting-review tasks do not lower the score. A 3.0 average
is 75/100, Meets Expectations. Database numeric precision is preserved; displayed
overall scores round to one decimal. Approved cancellations preserve task details, products, prior evaluations, and audit history. Cancelled tasks are excluded from active/completed counters and PEET totals, including removal-review score snapshots. They appear in a separate history section and cannot be edited, submitted, or evaluated.

Successful saves refresh the board immediately. Other open boards refresh on
window focus; this does not require configuring Supabase Realtime. Server reads
page through visible records to avoid Supabase's response cap dropping old scores.

## Onboarding and accessibility

The four-step introduction opens until the member closes or skips it.
`officer_profiles.peet_onboarding_seen_at` records completion in Supabase, across
devices. The persistent **What is PEET?** button reopens it. No tracking records or
onboarding flags are persisted in local storage. Dialogs use native modal focus containment, Escape, Close/Cancel buttons,
and focus restoration. Motion respects reduced-motion preferences, controls have
labels, and the history table scrolls on narrow screens.

## Validation

```bash
npm run build
node --test tests/*.cjs
```

Run `tests/officerboard.sql` only against a **disposable empty local PostgreSQL
database**. It creates fixture roles and Auth records, reapplies the migration,
and checks officer isolation, rejected direct writes and role escalation, valid
transitions, reviewer assignments, score ranges, atomic completion, adjustment
without double counting, access revocation, and anonymous access denial. Never
run the test fixture in your existing Supabase project.

Before inviting officers, use one reviewer and two officer accounts to verify the
full submit → review → adjust workflow in the configured Supabase environment,
including product sharing permissions. This code does not upload files or change
the sharing permissions of linked documents.

Permission design follows Supabase’s [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [database function security](https://supabase.com/docs/guides/database/functions)
guidance: fixed search paths, explicit execution grants, RLS on all portal tables,
and caller checks inside every write function.


## Contract-based tracking

The implementation follows the supplied **GEA Leadership Team Accountability &
Operating Contract, 2026–2027**, particularly Articles I, IV, and VI. It does not
import names, strike records, or hours from the screenshots: those records need
to be entered against verified Auth user IDs. Existing PEET reviewers default to
`reviewer_kind = 'president'` during migration; designate actual advisors explicitly.
The database requires an advisor to evaluate a President's PEET tasks.

- **Attendance:** reviewer-managed meeting calendar and roll call. Present, late,
  excused, unexcused, and unmarked are distinct. Officers submit absence notices
  with a server timestamp. A notice does not automatically excuse an absence.
- **Volunteer:** commitments are independent of actual participation. Officers
  submit check-in/out records, or reviewers enter historical records for them.
  Supabase calculates whole minutes; reviewers verify the log. Only approved logs
  at non-cancelled GEA-approved outreach/volunteer events count toward the two-event
  officer minimum. Advisor accounts can record service but are not subject to the
  officer requirement. Rejected logs can be corrected and resubmitted; approved
  logs are locked until a reviewer returns them. There is one log per officer/event.
- **Strikes:** attendance and conduct/professionalism are counted independently
  per academic year. Documenting a concern creates an in-portal notice and future
  response deadline, not a confirmed strike. Officers can explain circumstances.
  Confirmation requires their response or expiration of the response opportunity,
  plus documented human review. Neither an absence nor a low PEET score generates
  a strike. Use official Signal/email channels to draw attention to the portal
  notification; the app does not send messages to external channels.
- **Reviews:** one confirmed strike shows the peer-review stage, two show advisor
  review, and three in a single category open a formal removal review in the same
  transaction. The review keeps a snapshot of confirmed incidents and the PEET
  score. Only an advisor can record retention or removal approval. Removal approval
  requires three still-confirmed strikes. No account or leadership listing is
  removed automatically. Subsequent confirmations reopen a resolved review with a
  new snapshot; the prior outcome remains in the audit log.
- **Corrections and notes:** concerns can be dismissed, confirmed strikes can be
  revoked, and reviewers maintain officer-visible general notes. A linked confirmed
  attendance strike must be revoked before changing its absence to excused/present.
  Previously recorded strikes and decisions are retained, rather than deleted.
- **Audit and privacy:** calendars are shared with portal members. Personal attendance,
  explanations, service, concerns, notes, and reviews are readable by their owner
  and designated reviewers. Database triggers record changes in the RLS-protected
  `officer_tracking_audit`; browser clients cannot modify the audit log or roles.

Times are stored as `timestamptz`, schedules display in America/Los_Angeles, and forms
explicitly identify the device time zone used for entry. School-year filters keep
annual volunteer and accountability totals separate from cumulative PEET totals.

Run `tests/officer-accountability.sql` after `tests/officerboard.sql` in the **same
disposable test database** to exercise the contract workflows, role isolation,
volunteer verification/corrections, strike-response windows, three-strike review,
advisor-only outcomes, President evaluation restrictions, audit immutability, and
database-backed onboarding. No production database is changed by the local tests.

## Super-admin account management

Run `supabase/super-admin.sql` **after both officer portal migrations**. It promotes
an existing Auth account matching `jaden.jir@lvjusd.org`, adds its site-admin and
President memberships, and returns the promoted user ID. It does not create that
login, change its password, or send email. If the final query returns no rows,
check that the address belongs to an Auth user in this Supabase project.

Super-admin access is stored in `super_admins`, a separate trusted allowlist.
Teacher profiles automatically grant this role through database triggers. Ordinary
non-teacher site admins, Presidents, and signup metadata cannot grant this role. Provisioning the role requires the SQL editor or a trusted service.
Your runtime account is authorized by Auth user UUID, not by an email comparison.
Changing the login email later does not drop its role.

A super admin gets **Accounts** and **Website admin** sections on `/officerboard`.
Website administration embeds the existing site tools, including leadership,
applications, Q&A, Builders, announcements, profile changes, and teacher invites.
A super admin has full site/PEET reviewer permissions, including the explicit
ability to evaluate President tasks and record formal-review outcomes. Ordinary
Presidents still require advisor review of their own PEET work. Response windows,
score ranges, and the three-confirmed-strike removal threshold remain enforced.

The Accounts section can:

- Add student/teacher logins with an initial password of 12–128 characters, or
  attach profile access to an existing login by email or a directory selection.
- Edit names, login emails, student usernames, class years, and student IDs.
  An omitted student ID preserves the existing one; new student profiles require it.
- Designate officers, President reviewers, and Academy Advisors on existing accounts.
  Teacher membership automatically grants super-admin and officer-board access.
  **Grant officer access** is available for other members and independent reviewer roles.
- Remove student or teacher **profile access** after a confirmation and recorded
  reason. Student removal deletes its profile and dependent student records and
  revokes legacy upperclassman access. Teacher removal deletes its profile and outstanding teacher invites, revokes
  its automatic super-admin/site-admin/portal permissions, and preserves tracking
  history. The Auth login and independently granted permissions remain, as stated
  explicitly in the confirmation. Removing your own access
  through this interface is blocked.

`SUPABASE_SERVICE_ROLE_KEY` is required on the server for Auth administration.
It is never exposed to browser code. The account API validates the authenticated
super-admin membership on each request, requires same-origin writes, and prevents
cached directory responses. Validated profile changes and sanitized audit records
are committed together in the database using service-role-only RPCs. Passwords and
student ID numbers are excluded from directory responses and audit snapshots.

Attaching roles never resets an existing password. Public student signup also
cannot overwrite an existing teacher or staff password. Failed profile creation
attempts clean up the newly created Auth login; failed email/profile changes attempt
to restore the prior login email and report recovery failures. No invitation or
password email is automatically sent from these account actions.

Run `tests/super-admin.sql` **last**, after the officerboard and accountability
fixtures, in the same disposable local PostgreSQL database. It verifies bootstrap,
allowlist isolation, service-only writes, audited profile creation/edit/removal,
identity preservation, and protection against self-removal and privilege escalation.
`tests/super-admin-route.cjs` checks server authorization, CSRF protections, password
preservation, pagination, validation, and recovery of partial Auth/profile failures.

## Sign-in destinations

All sign-in forms use `/account/redirect`. Students without staff or officer roles
land directly in the forum at `/dashboard#qa`. Officers, teachers, and admins land
at `/account`, the GEA One home, with links to the forum and their authorized
workspaces. Disabled officer memberships do not grant a workspace shortcut.
The GEA One navigation menu offers **Head to home** and **Sign out**. Profile
settings are available within GEA One home and the forum, rather than the menu.
Existing workspace routes and their server/database permission checks remain.


## Automatic teacher super-admin access

Apply `supabase/teacher-super-admin.sql` after `super-admin.sql`. It backfills
existing teachers and installs a trigger for future teacher-profile creation,
including Accounts actions and accepted private teacher invitations. Teachers
reuse their existing Auth login; no new password or account is needed. Their
trusted teacher membership grants site-admin and super-admin access and an active
Officer Board profile. New portal profiles default to Academy Advisor permissions.
Existing independent officer/President assignments are preserved.

The migration tracks explicit and teacher-derived grants separately. Removing a
teacher profile revokes only the grants it introduced. An automatically introduced
portal identity is disabled instead of deleted, preserving tasks, evaluations,
attendance, volunteer history, and audit records. Re-adding the teacher restores
the same identity. Independently granted portal roles and the owner's explicit
super-admin grant remain in place. Disabled members cannot read or mutate portal
records through direct database calls; guards cover all existing portal write RPCs.

Because teacher enrollment now grants full privileges, direct teacher-profile and
teacher-invitation writes require a super admin. Non-teacher site admins cannot
self-promote by creating their own teacher profile or invite. Authenticated browser
clients cannot modify the grant-source flags or provisioning ledger.

Run `tests/teacher-super-admin.sql` in the disposable database, after the
other portal fixtures. It verifies backfill, new teacher promotion, account
management by teachers, revocation, restoration without data loss, preservation
of independent permissions, and ordinary-admin escalation denial.

## Task followthrough migration checks

Run `tests/officer-task-followthrough.sql` after all earlier SQL fixture tests in the disposable database. It reapplies the migration and checks private request visibility, blocked deletion and teacher assignment, atomic batch assignments, independent cancellation decisions, continued work while pending, immutable cancelled tasks, and audit records. Historical migration-stage tests must run before this final migration because they verify the permissions at those earlier stages.


## Task editing permissions

Apply `supabase/officer-task-editing.sql` after `officer-task-followthrough.sql`
before deploying the updated dashboard. Only the original assigner can edit an
assigned task; reviewer or super-admin access does not override ownership.
For self-created tasks, only the description and deadline can change while the
task is in progress. The deadline must remain within three calendar days of the
original deadline, even across repeated edits, and cannot be cleared. Tasks created
without a deadline allow description changes only. Existing active tasks use their
deadline at migration time as the fixed original date. Submitted self-created tasks,
completed tasks, and cancelled tasks remain locked. Database triggers enforce the
same restrictions for direct writes and RPC calls, and existing audit logging remains.

Run `tests/officer-task-editing.sql` last in the disposable fixture database.


## Written task submissions

Apply `supabase/officer-task-submissions.sql` after `officer-task-editing.sql`
before deploying the dashboard. Officers can submit a written description, an
HTTP/HTTPS link, or both. Empty submissions and descriptions over 10,000 characters
are rejected by the database. Submission evidence is separate from the assigned
task description and appears in the task list, review form, and completed history.
Existing link-only submissions and older two-argument submission calls remain valid.
Run `tests/officer-task-submissions.sql` last in the disposable fixture database.


## Unified staff workspace

Staff users now share one GEA One workspace under `/admin-portal-x7k9`.
**Academy administration** contains the existing admin sections; **Officer
accountability** at `/admin-portal-x7k9/officers` embeds the officer tools beneath
the same header and navigation. Officer tools require an active officer membership
in addition to staff access, and reviewer/super-admin permissions remain unchanged.
Staff visits to the legacy `/officerboard` route redirect into this workspace.
Ordinary officers retain their standalone officer dashboard. GEA One home shows
one academy-workspace card for staff and a separate community-forum card.
