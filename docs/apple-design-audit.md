# Design review: GEA website

## Summary

Reviewed and improved the site's public pages, account flows, student tools, staff components, and shared navigation against Apple's Human Interface Guidelines. The verified public and guest states are **Good**: clearer controls, readable text, accessible feedback, and adaptable layouts retain the forest-green, warm-paper palette and school photography. This is a web implementation review, not Apple certification; authenticated workflows and assistive-technology testing remain incomplete.

## Critical findings corrected

- **Contrast and legibility.** Small gold text and faint secondary text were difficult to read. Replaced text gold with separate light/dark accessible accent tokens, strengthened muted text, placeholders and field boundaries, and raised tiny labels to rem-based 12px styles. Light accent on paper measures 6.23:1; dark accent on forest measures 8.11:1; placeholders on white measure 6.20:1. These measurements describe the shared color pairs, not every possible photo or user-generated surface. `accessibility.md › Vision`: “Strive to meet color contrast minimum standards.” [Apple's contrast evaluation criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/sufficient-contrast-evaluation-criteria) specify 4.5:1 for ordinary text and 3:1 for meaningful nontext elements.
- **Unnamed fields and missing feedback.** Associated labels or accessible names across the site's 100 input, select, and textarea controls. Added email/password autocomplete, invalid-email guidance, and announced error/success/loading states. Account failures now clear the busy state and support retry. `entering-data.md › Best practices`: “Be clear about the data you need.”
- **Keyboard navigation and dialogs.** Strengthened visible focus indicators; repaired menu Escape handling and focus return; converted announcement overlays to native dialogs with focus containment, Escape dismissal, scroll locking, and focus restoration. Added meaningful headings to access-denied and unavailable states. `modality.md › Best practices`: “Always give people an obvious way to dismiss a modal view.” [Apple's modality guidance](https://developer.apple.com/design/human-interface-guidelines/modality).
- **Uncontrolled motion.** Added explicit previous/next and pause/play controls to homepage photography. Manual navigation pauses rotation; reduced-motion preferences stop automatic playback. The SSP background video also respects reduced motion and has a playback control. Decorative video stays outside the accessibility tree. `motion.md › Best practices` and `accessibility.md › Vision` guide the motion and readable-content review.

## Improvements implemented

- **High — Layout and target sizes.** Shared buttons and inline button links have 44px minimum targets; checkbox/radio labels provide larger clickable regions. Text fields use 16px type. Layouts accommodate wrapping and enlarged text rather than hiding horizontal overflow. Dialogs scroll within the viewport. `layout.md › Adaptability`; `accessibility.md › Mobility`.
- **Medium — Action feedback.** Added actionable network failure messages and retry paths to staff operations, clipboard actions, and question reporting. Destructive student, leadership-seat, and interview-slot actions ask for confirmation and explain the effect. `feedback.md › Best practices`; `buttons.md › Role`.
- **Medium — Embedded video.** The SSP instruction video loads only on request and can be closed. Written instructions and an external video link remain available. The provider's loaded iframe previously produced accessibility violations; provider-owned controls cannot be repaired in this repository.
- **Medium — System preferences.** Added stronger contrast and forced-color support, opaque surfaces for reduced transparency, and consistent keyboard focus styling. Existing reduced-motion animation rules remain in place. `color.md › Inclusive color`; `accessibility.md › Vision`.

## What works

School photography and the green/paper palette give the site a recognizable identity. Rounded surfaces, the compact admissions notice, and the homepage fact bar create hierarchy without restoring the oversized admissions card. The late-November application notice, student-only account invitation, and hidden Builders page remain in place. No student testimonials or current-activity section was added.

## Verification

- Production build, TypeScript and build-time lint checks passed.
- All 29 repository tests passed, including accessible form naming and account error/retry behavior.
- Axe checks with WCAG A/AA, WCAG 2.1 AA, and best-practice rules passed on 24 public/guest route states, including nine protected-page guest fallbacks.
- Public routes checked at 1440px; core pages also checked at 320px and 768px without horizontal overflow.
- Eight routes checked at 200% text size on desktop without horizontal overflow.
- Seven core routes checked at 320px with 200% text size without horizontal overflow after correcting button wrapping, the homepage fact bar, teaser sizing, and the SSP timer.
- Browser interaction checks passed for mobile-menu Escape dismissal, reduced-motion media defaults, instruction-video load/close, and the Builders 404 response.
- Screenshots reviewed at desktop and 320px mobile widths.

## Remaining verification and decisions

- **High — Authenticated coverage.** Staff/student components were reviewed in source, but real signed-in states, populated tables, announcements supplied by the database, and complete multi-step workflows need testing with appropriate test accounts and data. No live destructive operation was performed.
- **Medium — Assistive technology.** Actual VoiceOver use, browser zoom beyond the tested text enlargement, and every image/announcement combination need a manual pass. Automated checks do not establish complete accessibility.
- **Critical — Third-party player limitation.** After explicitly loading YouTube, its own controls may still have accessibility defects. The default first-party state avoids those defects and offers written and external alternatives; provider behavior is outside this codebase's control.
- **Medium — Privacy consistency.** The privacy page's analytics wording should be reconciled with the Vercel Analytics and Speed Insights components in the layout. Tracking policy was not changed as part of this design review.
- **High — Eligibility enforcement.** Signup restricts addresses to the configured LVJUSD domain. That restriction alone does not prove current enrollment or GEA membership; enrollment verification is a separate product/security decision.

## Platform notes

This is a responsive website, so browser semantics, rem-based type, native HTML dialogs, and keyboard conventions implement the relevant HIG principles. Native-app navigation, SF Symbols, Liquid Glass, and Apple's point-size specifications were not imposed on the site's branding. Color measurements and automated accessibility findings use web WCAG criteria, while HIG informs hierarchy, feedback, motion, and interaction design.

Review performed October 12, 2026. Changes are local and have not been deployed.
