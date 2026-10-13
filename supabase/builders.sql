-- GEA Builders: run after schema.sql for an existing installation.
-- Uses existing approved student_profiles and the server-checked admins allowlist.
begin;
create table if not exists public.builder_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  parent_id uuid unique references public.builder_submissions(id),
  title text not null check (length(btrim(title)) between 1 and 100),
  location text not null check (location in ('home', 'school', 'community')),
  problem text not null check (length(btrim(problem)) between 1 and 2000),
  build text not null check (length(btrim(build)) between 1 and 2000),
  skills text not null check (length(btrim(skills)) between 1 and 1000),
  team text not null check (length(btrim(team)) between 1 and 200),
  evidence_url text not null check (length(evidence_url) <= 2000 and evidence_url ~ '^https://drive[.]google[.]com/[^[:space:]]+$'),
  wall_opt_out boolean not null default false,
  wall_hidden boolean not null default true,
  wall_name text not null default '' check (length(wall_name) <= 80),
  wall_title text not null default '' check (length(wall_title) <= 100),
  wall_problem text not null default '' check (length(wall_problem) <= 2000),
  wall_build text not null default '' check (length(wall_build) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'needs_changes', 'approved')),
  solves_problem boolean not null default false,
  helps_others boolean not null default false,
  gea_skills boolean not null default false,
  clear_evidence boolean not null default false,
  points integer generated always as (case when status = 'approved' then
    (case when solves_problem then 10 else 0 end) + (case when helps_others then 5 else 0 end)
    + (case when gea_skills then 5 else 0 end) + (case when clear_evidence then 5 else 0 end)
    else 0 end) stored,
  officer_note text not null default '' check (length(officer_note) <= 2000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  check (status <> 'needs_changes' or length(btrim(officer_note)) > 0)
);
create index if not exists builder_submissions_student_idx on public.builder_submissions(student_id);
create index if not exists builder_submissions_status_idx on public.builder_submissions(status, created_at);
create table if not exists public.builder_recognitions (
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  threshold integer not null check (threshold in (10, 30, 60, 100)),
  certificate boolean not null default false,
  shoutout boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (student_id, threshold)
);
alter table public.builder_submissions enable row level security;
alter table public.builder_recognitions enable row level security;
drop policy if exists builders_read on public.builder_submissions;
create policy builders_read on public.builder_submissions for select to authenticated using (
  public.is_admin() or exists (select 1 from public.student_profiles p where p.id = student_id and p.auth_user_id = auth.uid())
);
drop policy if exists builder_recognitions_read on public.builder_recognitions;
create policy builder_recognitions_read on public.builder_recognitions for select to authenticated using (
  public.is_admin() or exists (select 1 from public.student_profiles p where p.id = student_id and p.auth_user_id = auth.uid())
);
-- Writes only through the following checked functions; browsers cannot forge points or ownership.
revoke all on public.builder_submissions, public.builder_recognitions from anon, authenticated;
grant select on public.builder_submissions, public.builder_recognitions to authenticated;

create or replace function public.submit_builder_project(
  p_title text, p_location text, p_problem text, p_build text, p_skills text, p_team text,
  p_evidence_url text, p_wall_opt_out boolean, p_parent_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_id uuid; v_parent public.builder_submissions;
begin
  select id into v_student from public.student_profiles where auth_user_id = auth.uid();
  if v_student is null then raise exception 'Sign in with an approved GEA student account to submit a build.'; end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 100
    or p_problem is null or length(btrim(p_problem)) not between 1 and 2000
    or p_build is null or length(btrim(p_build)) not between 1 and 2000
    or p_skills is null or length(btrim(p_skills)) not between 1 and 1000
    or p_team is null or length(btrim(p_team)) not between 1 and 200
    or p_location is null or p_location not in ('home','school','community')
    or p_evidence_url is null or length(p_evidence_url) > 2000
    or btrim(p_evidence_url) !~ '^https://drive[.]google[.]com/[^[:space:]]+$'
    or p_wall_opt_out is null then raise exception 'Complete every field and use a valid HTTPS Google Drive video link.'; end if;
  if p_parent_id is not null then
    select * into v_parent from public.builder_submissions where id = p_parent_id for update;
    if not found or v_parent.student_id <> v_student or v_parent.status <> 'needs_changes'
      or exists (select 1 from public.builder_submissions where parent_id = p_parent_id)
      then raise exception 'This project is not available for resubmission. Refresh your progress.'; end if;
  end if;
  insert into public.builder_submissions(student_id, parent_id, title, location, problem, build, skills, team, evidence_url, wall_opt_out)
    values(v_student, p_parent_id, btrim(p_title), p_location, btrim(p_problem), btrim(p_build), btrim(p_skills), btrim(p_team), btrim(p_evidence_url), p_wall_opt_out)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.review_builder_project(
  p_id uuid, p_status text, p_note text, p_solves_problem boolean, p_helps_others boolean,
  p_gea_skills boolean, p_clear_evidence boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Approved officer access is required.'; end if;
  if p_status is null or p_status not in ('approved','needs_changes') or p_note is null or length(p_note) > 2000
    or (p_status = 'needs_changes' and length(btrim(p_note)) = 0)
    then raise exception 'Choose a review decision and include feedback when requesting changes.'; end if;
  update public.builder_submissions set status = p_status, officer_note = btrim(p_note),
    solves_problem = coalesce(p_solves_problem, false), helps_others = coalesce(p_helps_others, false),
    gea_skills = coalesce(p_gea_skills, false), clear_evidence = coalesce(p_clear_evidence, false),
    reviewed_at = now(), reviewed_by = auth.uid()
    where id = p_id and status = 'pending';
  if not found then raise exception 'This project has already been reviewed or is unavailable. Refresh the queue.'; end if;
end $$;

create or replace function public.set_builder_privacy(p_id uuid, p_opt_out boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_opt_out is null then raise exception 'Choose a sharing preference.'; end if;
  update public.builder_submissions s set wall_opt_out = p_opt_out,
    wall_hidden = case when p_opt_out then true else wall_hidden end
    where s.id = p_id and exists (select 1 from public.student_profiles p where p.id = s.student_id and p.auth_user_id = auth.uid());
  if not found then raise exception 'This project is unavailable for your account.'; end if;
end $$;

create or replace function public.edit_builder_story(
  p_id uuid, p_name text, p_title text, p_problem text, p_build text, p_hidden boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Approved officer access is required.'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80
    or p_title is null or length(btrim(p_title)) not between 1 and 100
    or p_problem is null or length(btrim(p_problem)) not between 1 and 2000
    or p_build is null or length(btrim(p_build)) not between 1 and 2000 or p_hidden is null
    then raise exception 'Complete the public story before saving.'; end if;
  update public.builder_submissions set wall_name = btrim(p_name), wall_title = btrim(p_title),
    wall_problem = btrim(p_problem), wall_build = btrim(p_build), wall_hidden = p_hidden
    where id = p_id and status = 'approved' and (p_hidden or not wall_opt_out);
  if not found then raise exception 'Only approved projects whose students allow sharing can be published.'; end if;
end $$;

-- Explicit projection: no student IDs, emails, video links, private notes, or totals.
create or replace function public.get_builder_wall()
returns table(id uuid, first_name text, title text, location text, problem text, build text)
language sql stable security definer set search_path = public as $$
  select s.id, s.wall_name, s.wall_title, s.location, s.wall_problem, s.wall_build
  from public.builder_submissions s where s.status = 'approved' and not s.wall_opt_out and not s.wall_hidden
    and length(btrim(s.wall_name)) > 0 and length(btrim(s.wall_title)) > 0
    and length(btrim(s.wall_problem)) > 0 and length(btrim(s.wall_build)) > 0
  order by s.reviewed_at desc, s.id;
$$;

create or replace function public.set_builder_recognition(p_student_id uuid, p_threshold integer, p_certificate boolean, p_shoutout boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_total integer;
begin
  if not public.is_admin() then raise exception 'Approved officer access is required.'; end if;
  -- Serialize recognition changes for this student.
  perform 1 from public.student_profiles where id = p_student_id for update;
  if not found then raise exception 'Student not found.'; end if;
  select coalesce(sum(points), 0) into v_total from public.builder_submissions where student_id = p_student_id;
  if p_threshold is null or p_threshold not in (10,30,60,100) or v_total < p_threshold
    or p_certificate is null or p_shoutout is null then raise exception 'This milestone has not been earned.'; end if;
  insert into public.builder_recognitions(student_id, threshold, certificate, shoutout, updated_by)
    values(p_student_id, p_threshold, p_certificate, p_shoutout, auth.uid())
    on conflict(student_id, threshold) do update set certificate = excluded.certificate,
      shoutout = excluded.shoutout, updated_at = now(), updated_by = auth.uid();
end $$;

revoke all on function public.submit_builder_project(text,text,text,text,text,text,text,boolean,uuid) from public, anon;
revoke all on function public.review_builder_project(uuid,text,text,boolean,boolean,boolean,boolean) from public, anon;
revoke all on function public.set_builder_privacy(uuid,boolean) from public, anon;
revoke all on function public.edit_builder_story(uuid,text,text,text,text,boolean) from public, anon;
revoke all on function public.set_builder_recognition(uuid,integer,boolean,boolean) from public, anon;
revoke all on function public.get_builder_wall() from public;
grant execute on function public.submit_builder_project(text,text,text,text,text,text,text,boolean,uuid) to authenticated;
grant execute on function public.review_builder_project(uuid,text,text,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.set_builder_privacy(uuid,boolean) to authenticated;
grant execute on function public.edit_builder_story(uuid,text,text,text,text,boolean) to authenticated;
grant execute on function public.set_builder_recognition(uuid,integer,boolean,boolean) to authenticated;
grant execute on function public.get_builder_wall() to anon, authenticated;
commit;
