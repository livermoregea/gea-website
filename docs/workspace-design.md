# Admin and officer workspace design

## Summary

GEA One serves student officers, the secretary, and academy reviewers. Its main job is to make assigned work and meeting records easy to find and update. The design uses GEA's existing cream and forest palette with a compact workspace switch, quiet section navigation, and prominent actions only where work is saved or submitted.

The starting design needed work: navigation looked like a row of actions, stacked navigation rows competed, and admin labels and buttons used different scales. The implementation addresses those findings. Visual rating remains provisional until an authenticated browser review is available.

## Review and applied changes

- **High — navigation hierarchy.** A later general button selector overrode navigation borders, rounding, and backgrounds. The general selector now has low specificity and excludes section navigation and embedded officer records. Regression checks evaluate the cascade at 320, 390, 768, and 1440px. The workspace switch sits in the header, separate from section navigation. `layout.md › Best practices`: “Group related items to clearly express related information or functions.”
- **High — competing control treatments.** Administration and officer tools share 44px control targets, 8px corners, and 14px action labels. Solid forest is reserved for primary actions; secondary actions are outlined or text. Destructive officer actions have red labels and borders. `buttons.md › Style`: “Use style — not size — to visually distinguish the preferred choice among multiple options.”
- **Medium — repeated containers and headings.** Queue headers and editing sections use spacing and dividers instead of repeated bordered cards. Repeated uppercase section labels were removed. The admin notification action now accompanies the section heading rather than occupying another toolbar row. These reductions are design judgments applying the grouping principle above.
- **Medium — density and alignment.** Labels use readable body typography rather than small, widely spaced uppercase text. Application navigation stacks its directional label and applicant name properly. Dashboard attention items use the same list treatment as officer updates, with the whole row clickable.

## Tokens and layout plan

The active site appearance is light. Dark counterparts below document the intended roles for a future site-wide appearance implementation; this pass does not activate a partial dark theme.

| Role | Light | Dark counterpart | Text contrast on surface, light / dark |
| --- | --- | --- | --- |
| Page | #F6F3EC | #101A15 | — |
| Surface | #FFFFFF | #14221B | — |
| Content | #172D25 | #EEF4EF | 14.60 / 14.77 |
| Secondary content | #53665D | #B4C4B9 | 6.13 / 9.05 |
| Accent | #064E3B | #97D8B4 | 9.72 / 10.04 |
| Divider | #D6DFD8 | #354B3E | Decorative; not the sole indicator of selection |

The type scale is 32px maximum workspace title, 24px admin section title, 20px queue titles, 16px inputs and body copy, and 14px utility labels. Existing display type is retained sparingly for names and identity. Data uses tabular numerals where relevant.

Regular widths align the title and workspace switch horizontally, then show section navigation and useful content columns. Compact widths keep the same reading order, wrap the header, display the six officer sections in two rows, and stack working columns. Administration uses a native section picker on compact widths. No new nested page hierarchy is introduced.

```text
Regular: [Workspace title + identity]      [Admin | Officers] [Home]
         [Overview  Officers  Calendar  Meetings  Events  Reports]
         [Primary working content        | Supporting content]

Compact: [Workspace title + identity]
         [Admin | Officers]                              [Home]
         [Overview    My work    Calendar]
         [Meetings    Events     Reports]
         [Primary working content]
         [Supporting content]
```

The signature is GEA's forest selection and primary actions on the existing cream page. Familiar controls carry the navigation; extra badges, decorative panels, and motion would add little to routine student work. The shared action hover transition is 120ms and disabled for reduced motion. No decorative entrance animation was added.

## Quality checks

Keep keyboard focus visible, native labels and selects, safe-area padding around mobile save controls, and existing protections against discarding work. Desktop meeting and overview columns and compact report cards remain available. Secretary attendance and document permissions are unchanged.

The implementation was reviewed against the Apple design skill's accessibility, layout, typography, color, iOS, macOS, buttons, tab bars, toolbars, and cross-platform references. These are translated to web controls rather than copying native Apple chrome. The plan was checked for unnecessary decoration: the repeated GEA badge and unrelated Forum shortcut were removed from the staff header; forum management remains available through administration.

Automated selector-cascade checks, component/interaction tests, TypeScript, and production compilation cover the implementation. Live visual review, browser zoom, and authenticated role walkthroughs still need a browser session; source-level checks do not establish those results.

## Overview and officer records

Overview is the dashboard: current PEET, attendance, verified service, active and completed work, upcoming meetings/deadlines, and next actions. Reviewers see a team snapshot; ordinary officers see their own progress. Selecting a snapshot opens that officer's detailed record in the Officers section. Detail forms and task workflows stay there rather than appearing on the dashboard.

The dashboard reuses `peetSummary` and `trackingSummary`; it introduces no combined attendance/PEET score. Participation uses the same contract year as officer records, while PEET and work totals remain cumulative. The team PEET figure is the mean of evaluated active officers' existing scores; officers without evaluations are excluded rather than counted as zero. Shared tasks count once in team task totals. Service totals include only verified hours at approved, noncancelled events. Dashboard queries reuse the already loaded, permission-filtered records.
