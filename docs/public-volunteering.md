# Shared volunteer events

Apply `supabase/public-volunteering.sql`, then `supabase/shared-volunteer-events.sql`
after the officer and teacher-super-admin migrations. Deploy the application
changes together. Both migrations are included in `supabase/schema.sql` for fresh
installations. Apply the shared migration last; it converts the former public
event table into a safe view of the shared event records.

In the Officer workspace, create or edit a volunteer/outreach event and check
**Open to public volunteers AND leadership**. Leave it unchecked for leadership
only. Leadership meetings cannot be made public. Public events offer a separate
public description, signup switch, and optional public volunteer capacity. Officer
notes and planning documents remain private. Changes to the title, schedule,
location, or cancellation immediately update the same event on the public page.

Members find **Volunteer** at `/volunteer`. Anyone can browse published public
opportunities; signing up requires a GEA One login, without officer membership.
A volunteer enters their roster name, while account identity and email come from
the authenticated session. Members can see their own signup and service record,
and withdraw before the event starts. Full, closed, leadership-only, and cancelled
events reject new public signups. Changing an event back to leadership-only closes
its public listing but retains existing volunteers' signup history.

Staff use **Academy admin → Public Volunteering** at
`/admin-portal-x7k9/volunteers` for public rosters and attendance. Event edits here
also change the same shared event in the Officer workspace; a draft here pauses
public visibility while retaining the leadership schedule. Attendance is recorded
after the event starts and service minutes are verified after it ends. Coordinator
notes are shared with the volunteer. Officer attendance and officer service totals
stay in the Officer workspace; public registrations never create officer records.

`officer_events` is the event source. `public_volunteer_events` is a view exposing
only intended public event fields, and `public_volunteer_signups` references the
same event IDs. The shared migration preserves all former public event IDs,
signups, attendance, and verified minutes. The old event table is retained as an
inaccessible archive. Existing leadership events stay private by default.

Database functions lock the shared event row for signup, withdrawal, attendance,
and capacity updates. A version counter detects stale public-admin edits after
officer schedule changes. Members can only read their own public signup records;
staff can manage public rosters. The safe public view never exposes officer notes.

Validation: `node --test tests/public-volunteering.cjs tests/meeting-schedule.cjs`.
Run `tests/public-volunteering.sql` before the shared migration in the disposable
officer fixture database, then `tests/shared-volunteer-events.sql` for conversion,
privacy, audience switching, and synchronization checks. Never run fixtures against
production.
