# CAGE scores

CAGE stands for **Competency Analysis of the Green Engineering Academy**.

`CAGE = 50 + 0.4 × a − 10 × s₁ − 10 × s₂`

- `a` is the officer’s PEET score on the adjusted 0–100 scale (3.0 → 85%, 3.5 → 92.5%, 4.0 → 100%), across all school years.
- `s₁` counts confirmed attendance strikes in the current contract academic year.
- `s₂` counts confirmed conduct/professionalism strikes in that same year.

For PEET 70, one attendance strike, and two conduct strikes, CAGE is **48**.
The formula is applied exactly: PEET 100 with no strikes gives 90. Strike counts
and results are not capped; additional strikes can produce negative results.
Revoked, dismissed, pending, prior-year, and other officers’ strikes do not count.
Unexcused attendance creates a confirmed attendance strike through
`supabase/officer-strike-notifications.sql`; CAGE uses that strike record once.

The officer Overview shows personal PEET and CAGE cards first, followed by workspace updates
and the task list. Both cards use the signed-in officer’s PEET, including for
Presidents and reviewers. The separate team summary retains its team average.
The CAGE card shows the score out of the maximum **90** and its percentage
grade (`score ÷ 90 × 100`), rounded to one decimal place. For example, 72/90
is 80.0%. CAGE displays **N/A** until the officer has a PEET evaluation. A calculated zero
is displayed as zero.

CAGE is calculated on the server whenever the workspace loads or refreshes from
the same PEET evaluations and strike records shown in the officer portal.
Changes to either input are reflected on refresh. No additional CAGE migration,
manual score entry, saved result, scheduled job, or AI calculation is required.
The optional legacy `officer_cage_scores` table is preserved but no longer read
by the Overview, so old saved results cannot override the current formula.

The PEET conversion update does not change the CAGE formula or its maximum of 90.
A 3.0 average with no strikes now yields PEET 85, CAGE 84/90, and a 93.3% CAGE
grade. See [contract wording](peet-cage-contract.md).
