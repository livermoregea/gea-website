# GEA Builders integration

The student’s original HTML/CSS/JS prototype lives in the separate `GEA Builders`
folder. Its copy, philosophy, fictional examples, rubric, and milestone levels have
been adapted into the academy’s Next.js site. Original files are preserved.

## Launch status

Builders is temporarily hidden from the public site while the program details are
being decided. `BUILDERS_ENABLED` in `lib/site-features.ts` is `false`: the public
route returns 404, and navigation, project cards, and profile links omit Builders.
Set that flag to `true` to restore the route and its links together. The staff admin
workspace and the implementation are preserved for continued preparation.

## Where to find it

- `/builders`: overview, authenticated submissions and private progress, public wall,
  build philosophy, and ideas. Linked in navigation, the community cards, and student profiles.
- `/admin-portal-x7k9/builders`: project reviews, edited public stories, and recognition.
  Access requires a row in the existing `admins` allowlist. Teacher access alone does
  not grant Builders review access. Existing authentication is reused.

## Database setup

For an existing Supabase project, run `supabase/builders.sql` in its SQL editor.
Fresh installations include the same migration at the end of `supabase/schema.sql`.
No new environment variables or service-role key are required for Builders.
The site shows an unavailable message until the migration is installed.

Do not import the prototype’s demo submissions or browser storage into production.

## Behavior and privacy

Students submit a title, location category, problem, solution, GEA skills, team credits,
a Google Drive video link, and a public-wall preference. Identity comes from the
signed-in student profile; it cannot be supplied as an email in the submission.
Officers request changes with feedback or approve with rubric criteria (10/5/5/5).
Unfinished forms are held in memory while switching Builders sections. New builds and
revisions keep separate drafts, and failed submissions retain their draft. Reloading
or closing the page warns about unsaved work; drafts are not written to browser storage
and do not survive a reload. Successful submissions clear only their own draft.

The database calculates points, and only approvals earn points. Each revision is
stored as a new record with a unique link to its earlier submission, preserving
feedback and preventing duplicate resubmissions. Approved submissions cannot be
resubmitted or reviewed again, avoiding double awards and conflicting decisions.

New approvals remain hidden. Officers edit and explicitly publish the public story.
The public wall returns only the first name, title, location category, problem,
and build story. No student identifiers, emails, videos, private feedback, team
lists, or totals are exposed. Opted-out or officer-hidden projects never appear.
Students can remove an existing story from the wall without losing points. Allowing
sharing again requires an officer to republish. Recognition tracks certificates
and meeting shout-outs separately for milestones at 10, 30, 60, and 100 points.

Tables use RLS for students’ own records and approved officers. Browser roles
have no direct table write privileges. Every write function validates its caller,
inputs, and allowed transition in the database. Officer removal takes effect on
subsequent reads and writes. No prototype passcode or browser-only storage is used.

## Validation and rollout

- `npm run build`
- `node --test tests/builders.cjs tests/builders-drafts.cjs` for milestone boundaries and setup error handling
- `psql -v ON_ERROR_STOP=1 -f tests/builders.sql` **only against a disposable empty
  PostgreSQL database**. The test creates fixture roles and tables; never run it in
  the production Supabase project. It exercises separate students, anonymous and
  unapproved users, officer removal, forged writes, revisions, review transitions,
  points, recognition thresholds, and public-wall privacy.
- Before inviting students, confirm the school-approved Google Drive sharing setting
  with GEA staff. The form asks students to grant officers viewing access using that
  setting; it does not require public link sharing. Video access remains controlled
  by Google Drive. Officers should check access before awarding evidence points.
- Pilot with two student accounts and an approved officer. Submit → request changes
  → revise → approve → publish → opt out, and confirm the experience across devices.

This integration does not change the existing site’s deployment setup. Applying the
migration and deploying the repository are required to make it available on the live site.
