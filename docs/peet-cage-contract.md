# PEET and CAGE contract wording

## PEET evaluation and percentage

Each evaluated task receives an Efficiency rating, an Effectiveness rating, and
a Time rating on a 1.0–4.0 scale in increments of 0.1. A rating of 3.0 means
“Meets Expectations”; 4.0 means “Exceeds Expectations.”

For each task, calculate its raw average:

`Task average = (Efficiency + Effectiveness + Time) ÷ 3`

Let `r` be the arithmetic mean of the officer’s eligible task averages across
all academic years. Each evaluated task carries equal weight. On collaborative
tasks evaluated individually, use the officer’s own ratings. Include approved
individual evaluations even if other team members have not yet been evaluated.
Exclude cancelled tasks, unreviewed work, and tasks completed without an evaluation.

Convert the unrounded overall average to a PEET percentage `P`:

```text
P = 85 + 20(r − 3), when 1 ≤ r ≤ 3
P = 85 + 15(r − 3), when 3 < r ≤ 4
```

Calculate the overall raw average before applying the conversion. Do not average
already converted task percentages. An officer with no eligible evaluation has
no PEET percentage and is shown as N/A. Display percentages to one decimal place;
use unrounded values in subsequent calculations.

| Overall average r | PEET percentage P |
|---|---:|
| 1.0 | 45.0% |
| 2.0 | 65.0% |
| 2.5 | 75.0% |
| 3.0 | 85.0% |
| 3.2 | 88.0% |
| 3.5 | 92.5% |
| 4.0 | 100.0% |

## CAGE score and percentage grade

Let `P` be the officer’s PEET percentage calculated above, `s₁` the number of
confirmed attendance strikes in the applicable academic year, and `s₂` the number
of confirmed conduct/professionalism strikes in that academic year.

```text
CAGE score C = 50 + 0.4P − 10s₁ − 10s₂
CAGE percentage grade = (C ÷ 90) × 100
```

The maximum CAGE score is 90, attained with PEET 100 and zero strikes in both
categories. Each unexcused attendance record automatically issues one attendance
strike. Attendance and conduct strikes remain separate categories. Pending,
dismissed, revoked, prior-year, and other officers’ strikes do not count.

Use the unrounded PEET percentage in the CAGE calculation. Display the CAGE score
out of 90 and its percentage grade to one decimal place. Strike deductions and
the resulting score are not capped; a sufficiently large number of strikes can
produce a negative score. CAGE is N/A until a PEET percentage is available.

For example, an overall raw average of 3.0 gives PEET 85. With no strikes, CAGE
is 84/90, or 93.3%. With one attendance strike and no conduct strikes, CAGE is
74/90, or 82.2%.

The CAGE formula remains unchanged; it uses the updated PEET percentage.
