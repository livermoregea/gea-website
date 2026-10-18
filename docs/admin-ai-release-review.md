# Admin and AI scoring release review

Reviewed October 18, 2026. Scope: the current local checkout, including existing uncommitted changes. No deployment or live database migration was performed.

## Result

Local automated checks pass. Production sign-off remains conditional on verifying the deployment environment, installed migrations, and authenticated browser behavior. This is a review against Apple’s design guidance, not an approval or certification from Apple.

## Fixes made

- Upgraded Next.js from 15.5.20 to 15.5.28 and updated compatible dependencies. Overrode the framework’s older PostCSS with the project’s patched PostCSS 8 dependency. The lockfile captures these versions.
- Admin application lists/details, profile requests, teacher invitations, and pending forum reviews now report database errors instead of treating failed reads as successful empty results. Failed reads preserve previously loaded records.
- Interview slot creation/deletion blocks concurrent submissions, releases its busy state after failures, preserves failed form input, and exposes load retry. Inputs have required constraints; time entry identifies the local timezone. Deletion confirmation mentions the effect on bookings.
- Teacher invitation generation validates whole-number expiry between 1 and 365 days, prevents concurrent requests, and recovers from network failures.
- PEET submitter, legacy, and reviewer flows disclose remote Groq processing. Reviewer copy identifies AI limitations and supporting-link limitations. Generated initial clarification is explicitly labeled as AI.
- PEET request parsing limits actual streamed bytes, including chunked uploads and multibyte characters, before buffering the full request. Error responses explicitly disable caching.
- Added an optional `GEA_NEXT_DIST_DIR` build directory override so release checks can use separate output. The ordinary output remains `.next`; this review used `.next/release-check`.

## Verification

- `node --test tests/*.cjs`: **249 passed, zero failed**. Includes new tests for admin read failures, duplicate slot submission, retry after network failure, streamed byte limits, and reviewer disclosure.
- `GEA_NEXT_DIST_DIR=.next/release-check npm run build`: passed production compilation, type validation, and page generation. An earlier shared-output build failed at generated icon-route collection; the clean isolated build passed. Font downloads required network access.
- `npm audit --omit=dev`: **zero vulnerabilities** at review time. The full audit still reports seven findings in development dependencies, including Tailwind 3’s glob/parser dependencies; these require separate build-tool remediation. Do not treat the production-only audit as a clean full dependency audit.
- `tests/peet-ai.fixture.sql`: passed against a newly initialized, disposable local PostgreSQL 15 database; the migration was applied twice. The fixture checks RLS, unauthorized writes, submitter/reviewer separation, stale reviews, adjusted scores, actual PEET evaluation integration, duplicate approvals, disabled access, and shared request limits. The temporary database server was stopped afterward.
- One live Groq request using synthetic assignment evidence returned a valid recommendation under the actual PEET schema and rubric. It used the locally configured `openai/gpt-oss-120b`, sent no student data, and wrote no database records. This verifies connectivity and output structure, not grading fairness or correctness across real assignments.
- Local production HTTP smoke checks: admin dashboard, applications, students, login, and the Apple icon returned 200; protected admin pages displayed the sign-in gate. All five PEET endpoints returned 401 for anonymous requests with valid synthetic bodies. GEAI page requests were rejected with 403 by the origin guard; that smoke check did not reach its authentication guard. No authenticated browser behavior was inferred from these checks.
- `git diff --check`: passed.

## Design review

**Summary — Good, within the limits of a source and rendered-component review.** The screen’s job is to help staff inspect evidence and make accountable decisions. The existing restrained green-and-gold identity, task-centered dialogs, and visible clarification stages support that purpose. No official Apple review occurred.

**What works**

- Human approval remains necessary, numeric edits require an explanation, and manual submission/evaluation remains available. This follows `generative-ai.md › Best practices`: “Keep people in control.” See [Apple’s generative AI guidance](https://developer.apple.com/design/human-interface-guidelines/generative-ai).
- Shared admin controls and PEET buttons have a 44px minimum height; PEET form fields use 48px minimum height on narrow screens. Labels, explicit keyboard focus styles, native dialogs, status text, and reduced-motion rules are present. `accessibility.md › Mobility`: “Offer sufficiently sized controls.” See [Apple’s accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility).
- The admin navigation switches to a labeled native section picker on narrow screens. PEET dimensions stack vertically. These are appropriate web translations of `layout.md › Adaptability`; native macOS menu-bar and window conventions do not apply to this website.
- Contrast calculated from source colors: admin muted text `#53665d` on white **6.13:1**; PEET hints `#54685e` on white **5.97:1**; white primary-button text on `#164c3a` **9.86:1**; clarification label `#476454` on `#f6f8f5` **6.11:1**; error text `#9b2525` on white **7.82:1**. These pairs exceed the 4.5:1 normal-text minimum. This is a sample, not an exhaustive computed-style contrast audit.

**Improvements addressed**

- **Medium:** Added reviewer processing disclosure and AI limitations, following `generative-ai.md › Transparency`: “Communicate where your app uses AI.”
- **Medium:** Made failed reads and slot-save progress explicit, following `feedback.md › Best practices`: “Show people when a command can’t be carried out and help them understand why.”

**Craft notes**

Keep the existing quiet layout and use gold for selective emphasis. Additional decorative surfaces would compete with evidence and review decisions. This is design judgment. The current review does not justify a visual redesign.

## Remaining release gates

- Verify the production Supabase project has all required officer/shared-task/submission migrations and `supabase/gea-peet-ai.sql`. GEAI briefings additionally require `supabase/gea-operations.sql`, `supabase/gea-geai.sql`, and the scheduler configuration documented in `docs/geai.md`. Local fixture success does not verify the hosted project.
- Confirm production server-only keys and a supported Groq model. Local model configuration does not establish production configuration. The code’s Llama default is retired for free/developer accounts according to [Groq’s deprecation notice](https://console.groq.com/docs/deprecations); set an available production model explicitly and validate its grading with representative examples.
- Complete an authenticated preview walkthrough as an officer, independent reviewer, and advisor/admin: submit clarification, answer reviewer questions, recalculate after edits, override with a reason, approve, and confirm the task and overall score update. Verify manual fallback when the provider is unavailable.
- Complete actual browser checks at narrow phone and desktop widths, 200% zoom, keyboard-only input, and VoiceOver, including focus restoration, error announcements, long evidence, loading, and retry. The in-app browser execution tool was unavailable in this session; no screenshot or real screen-reader inspection was performed.
- Review the full pending diff before deploying; this checkout contains substantial changes that predate this review.
