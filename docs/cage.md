# CAGE scores

CAGE stands for **Competency Analysis of the Green Engineering Academy**. It will combine attendance, strikes, and PEET. The academy's formula, weights, and score scale are still pending; this change does not calculate a score or use AI to generate one.

The officer Overview shows personal PEET and CAGE cards first, followed by GEAI and then the task list. PEET uses existing evaluated tasks across all academic years. It is the signed-in officer's score, including for Presidents and reviewers; the separate team summary retains its team average. Missing PEET and CAGE scores display **N/A** until evaluated or calculated results are available. An earned zero remains a zero.

## Existing Supabase projects

Run `supabase/officer-cage.sql` in the Supabase SQL editor after the existing officer/account migrations. The same migration is included at the end of `supabase/schema.sql` for new installs. The Overview still loads if this optional table has not been installed yet.

`officer_cage_scores` stores one result per officer and academic year:

- `score`: nullable numeric result, with no assumed maximum or scale.
- `formula_version`: identifies the formula used.
- `input_snapshot`: the inputs actually used in that calculation.
- `calculated_at`: when the result was calculated.

A pending row has no score, formula version, or calculation timestamp; an absent row also displays as N/A. A completed result requires all three fields. Deleting an officer cascades to their CAGE records.

Row-level security lets active officers read their own records and existing PEET reviewers read team records. Authenticated clients have no write permissions. There is no scoring RPC, manual score editor, trigger, or scheduled calculator until the formula is supplied. Once it is available, implement validated calculation, input snapshots, recalculation on source changes, and the agreed academic-year and missing-data rules together.
