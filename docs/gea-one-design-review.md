# Design review: GEA One and officer accountability

## Summary

**Overall rating: Good after this pass, with remaining improvements below.**
GEA One’s job is to take each member directly to their community and authorized
work. Its recognizable element is the forest-and-gold One badge; routine controls
should stay quieter than the work itself. The role-based home and unified staff
workspace now support that structure.

This is a responsive Next.js/React **web** review using the Apple design skill.
Apple’s accessibility, hierarchy, feedback, and writing principles apply here;
native macOS menu-bar rules, native iOS tab-bar conventions, and App Store account
requirements are not treated as web requirements.

Evidence: current source, supplied screenshots, static control inspection,
server-rendered route tests, simulated form interactions, and calculated color
contrast. Live browser, device, VoiceOver, keyboard traversal, and enlarged-text
rendering were unavailable. Those are verification limits, not confirmed failures.

## Scope

The static inventory covers **34 components, 319 input/button/select/textarea
declarations, 26 form declarations, and seven dialog/modal declarations**.
These counts describe source declarations, including conditional UI; they are not
counts of live interactions tested. Server routes and shared styles were reviewed
alongside that inventory.

| Flow | Areas examined | Result of this pass |
| --- | --- | --- |
| Account access | Student/staff sign-in, student registration, teacher invites, sign-out | Selected states, busy states, focused errors, exact password handling, visible sign-out failures |
| Account home | Role-based destinations, welcome panel, profile access | Retained the focused forum/workspace split and existing branding |
| Forum | Posting, comments, voting, reporting, feed controls | Added accessible selected states to votes; existing labels and permission-specific actions retained |
| Profile | Details, pending requests, approval requests, officer-only accounts | Fixed missing request lookup IDs, connection failure recovery, immediate pending state, and return navigation |
| Staff workspace | Shared frame, section navigation, dashboard, applications, archive/detail views, students, invites, website, leadership, profile reviews, slots, moderation, optional Builders | Examined navigation, controls, feedback, and destructive actions; legacy feedback consistency remains below |
| Officer work | Directory, topics, tasks, written/link submissions, PEET review/history | Focused errors, clearer onboarding copy, wrapping controls, preserved score semantics |
| Attendance and service | Bulk attendance, event forms, service logs and verification | Protected drafts when following links, unloading, or signing out; improved compact layouts |
| Accountability | Absence explanations, concerns, response deadlines, separate strike categories, removal review, notes | Retained staged review and explicit labels; uses shared dialog/error improvements |
| Account administration | Account directory, access grants, removal confirmations | Preserved explicit removal consequences and confirmation; shared focused error treatment |

## Improvements completed

### High — Profile request status and retry reliability

The profile-details queries omitted `id`, even though the pending-request lookup
needed it. The editor also lacked exception cleanup: a rejected connection could
leave it saving indefinitely. Queries now include IDs; failed requests retain
entries and release the saving state; successful requests immediately show the
pending screen so they cannot be submitted twice while refresh is pending.
Officer-only accounts now show their officer identity and a route to request help.

`feedback.md › Best practices`: “Show people when a command can’t be carried out
and help them understand why.”

### High — Unsaved roster and profile changes

Roster protection previously covered unloading only, and did not protect the new
workspace links. Dirty roster/profile edits now protect ordinary links, sign-out,
and unloading. Same-page anchors, downloads, and new-tab links do not interrupt
people. Roster drafts still survive topic/meeting changes inside the component.

`feedback.md › Best practices`: “Warn people when they initiate a task that can
cause data loss that’s unexpected and irreversible.”

### High — Sign-out failures and credential handling

A failed sign-out response previously still cleared the UI and navigated away.
It now reports the failure and leaves the signed-in state available for retry.
Sign-in no longer trims password characters; valid leading/trailing spaces reach
authentication unchanged. Email normalization remains separate.

This is an interaction-reliability judgment, supported by the feedback principle
above; it is not a claim about a particular native authentication requirement.

### Medium — Accessible control states and error recovery

Sign-in/create-account buttons now expose their selected state with `aria-pressed`
in a named group and cannot switch modes during submission. Forms expose busy
state. Forum vote buttons also expose whether they are selected. Shared account
and officer errors receive focus and retain their inline alert announcement.

`accessibility.md › Vision`: “Convey information with more than color alone.”

### Medium — Dialog orientation

Native dialogs remain the interaction primitive. On opening, focus moves to a
visible heading when one is present; closing restores focus to the invoking
control when it still exists. The background no longer scrolls behind an open
dialog. Existing busy-state dismissal locks and native focus containment remain.

`modality.md › Best practices`: “Always give people an obvious way to dismiss a
modal view.” Live focus trapping and screen-reader announcements still need QA.

### Medium — Compact and enlarged-content layouts

Officer topic buttons and history actions can wrap. The academic-year selector
now has a 44px minimum height. Officer/roster sticky controls become static on
compact or short viewports, reducing the chance of covering most of the content.
Header actions can wrap, and forced-color mode retains selected-control outlines.

`layout.md › Adaptability`: “Be prepared for text-size changes.” These source
changes still require 200% text-size and mobile viewport rendering checks.

### Low — Copy and navigation

The PEET introduction now explains that completed work can be submitted as text,
a link, or both. Profile editing has a clear return link. Sign-in includes a short
support link without restoring the promotional copy previously removed.

## Color and typography checks

Calculated from source sRGB values, not sampled from screenshots:

| Use | Foreground / background | Contrast |
| --- | --- | --- |
| Primary text | `#123524` / `#F6F3EC` | 12.14:1 |
| Officer secondary text | `#56655E` / `#FFFFFF` | 6.14:1 |
| Home secondary text | `#5E625F` / `#FFFDF8` | 6.10:1 |
| Gold badge text | `#E4C766` / `#123524` | 8.11:1 |
| Destructive button text | `#FFFFFF` / `#A12727` | 7.41:1 |
| Good-score progress fill | `#6EE7B7` / `#417B68` | 3.24:1 |
| Below-expectations progress fill | `#FCD34D` / `#417B68` | 3.42:1 |

The listed text pairs exceed 4.5:1. This is a representative palette check, not
an exhaustive audit of every alpha-blended, hover, disabled, or photographic state.
PEET uses text as well as color: **75 is Meets Expectations**, not a warning.

Existing type hierarchy is appropriate: Space Grotesk for headings, Inter for
body copy, and IBM Plex Mono for restrained utility labels. Typical form/body
copy is 14–16px; officer labels are generally 12–14px. Labels use relative sizing
in most controls. Fixed-pixel structural widths still need enlarged-text QA.

`accessibility.md › Vision` supplies the contrast guidance. `typography.md ›
Supporting Dynamic Type` says to “Keep text truncation to a minimum as font size
increases.” Browser zoom/text resizing is the relevant web equivalent here.

## Remaining improvements

- **Medium — Account recovery:** sign-in now links to coordinator support, but
  there is no self-service password-reset experience. A future recovery flow needs
  real backend support and tested return URLs. This is a product-design judgment;
  adding passkeys or Apple sign-in is not required by this web review.
- **Medium — Legacy admin feedback:** several older panels combine successes,
  validation issues, and backend errors in one generic status message. Migrate
  them to distinct success/error summaries, preserving entered data and placing
  feedback next to the action. `feedback.md › Best practices`: “Consider
  integrating status feedback into your interface.”
- **Medium — Mobile volunteer roster:** attendance now uses compact officer
  cards with native status pickers, notes, and a fixed save bar on phones.
  Desktop attendance retains its comparison table. The volunteer roster still
  uses a horizontally scrollable table; a similar mobile recording layout is
  a future improvement. Attendance cards still need real-device visual checks.
- **Medium — History navigation and modal drafts:** link/unload/sign-out
  protection does not establish protection for client-side browser Back/Forward.
  Longer modal forms also do not persist drafts after intentional dismissal.
  Verify these separately before claiming complete draft protection.
- **Low — Appearance:** this web product retains its intentional light paper
  surface and dark forest panels. A complete alternate dark palette would be a
  separate feature; it is not simulated by automatically inverting this UI.

## Craft notes and what works

Keep the One badge, the home’s single forest welcome panel, and quiet content
cards. Avoid repeating large logos inside tools. Preserve the direct student
forum landing and the single staff workspace with two clearly named areas.
Native inputs/dialogs, explicit status labels, separate attendance/conduct
categories, and reviewed cancellations are appropriate foundations.

`branding.md › Best practices`: “Ensure branding always defers to content.”
No additional ornamental motion is needed for an operational academy workspace.

## Verification

Automated coverage includes account routing and membership boundaries, mode
selection, connection-failure retries, immediate profile-request pending state,
password preservation, draft-navigation guards, control-label associations,
PEET calculations, and tracking summaries. **49 targeted tests passed**, along with the production build, TypeScript checks,
and whitespace validation.

Before calling the experience fully visually verified, run the student, officer,
teacher, and admin flows at compact and desktop widths, 200% text size, keyboard
only, VoiceOver, forced colors, and reduced motion. Confirm dialog opening/closing,
failed writes, unsaved roster navigation, and scrollable tables on real devices.
No live database mutations or email sends were performed for this design review.

## Skill references

All citations above refer to the local
[Apple design skill](/Users/jasian/.agents/skills/apple-design/SKILL.md), under
`references/hig/`. The review consulted accessibility, layout, typography, color,
designing-for-macos, buttons, modality, entering-data, feedback, managing-accounts,
branding, and the cross-platform translation guide.
