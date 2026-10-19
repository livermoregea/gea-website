-- CAGE storage only: no weights, score scale, or calculation are assumed.
-- Run in the Supabase SQL editor after the existing officer/account migrations.
begin;

create table if not exists public.officer_cage_scores (
  officer_id uuid not null references public.officer_profiles(id) on delete cascade,
  academic_year text not null check (academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
  score numeric,
  formula_version text check (formula_version is null or length(btrim(formula_version)) between 1 and 100),
  input_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(input_snapshot) = 'object'),
  calculated_at timestamptz,
  primary key (officer_id, academic_year),
  check (score is null or score not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  check (
    (score is null and formula_version is null and calculated_at is null)
    or (score is not null and formula_version is not null and calculated_at is not null)
  )
);

comment on table public.officer_cage_scores is
  'CAGE: Competency Analysis of the Green Engineering Academy. Formula pending; no automatic calculation yet.';
comment on column public.officer_cage_scores.input_snapshot is
  'Inputs actually used by the eventual versioned formula: PEET, attendance, and strikes. Do not populate speculative scores.';

alter table public.officer_cage_scores enable row level security;
drop policy if exists officer_cage_scores_read on public.officer_cage_scores;
create policy officer_cage_scores_read on public.officer_cage_scores
  for select to authenticated
  using (public.is_peet_admin() or (officer_id = auth.uid() and public.has_officer_access()));

-- Scores are derived server-side. Officers and reviewers cannot write arbitrary
-- results from a browser; add the validated calculator once the formula exists.
revoke all on public.officer_cage_scores from public, anon, authenticated;
grant select on public.officer_cage_scores to authenticated;
grant all on public.officer_cage_scores to service_role;
commit;
