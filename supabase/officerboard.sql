-- PEET officer portal. Run in the existing Supabase project's SQL editor.
-- Uses existing auth.users; PEET roles are independent of the site admins list.
begin;

create table if not exists public.officer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  role text not null default 'officer' check (role in ('officer', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 10000),
  assigned_to uuid not null references public.officer_profiles(id),
  created_by uuid not null references public.officer_profiles(id),
  due_date date,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'completed')),
  final_product_url text check (final_product_url is null or
    (length(final_product_url) <= 2048 and final_product_url ~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  check (status = 'in_progress' or (final_product_url is not null and submitted_at is not null)),
  check ((status = 'completed') = (completed_at is not null))
);

create table if not exists public.peet_evaluations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  evaluated_by uuid not null references public.officer_profiles(id),
  efficiency numeric not null check (efficiency between 1.0 and 4.0),
  effectiveness numeric not null check (effectiveness between 1.0 and 4.0),
  time numeric not null check (time between 1.0 and 4.0),
  feedback_notes text not null default '' check (length(feedback_notes) <= 10000),
  evaluated_at timestamptz not null default now()
);
create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to, created_at desc);
create index if not exists tasks_status_idx on public.tasks(status);

create or replace function public.is_peet_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.officer_profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.officer_profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.peet_evaluations enable row level security;
drop policy if exists officer_profiles_read on public.officer_profiles;
create policy officer_profiles_read on public.officer_profiles for select to authenticated
  using (id = auth.uid() or public.is_peet_admin());
drop policy if exists officer_tasks_read on public.tasks;
create policy officer_tasks_read on public.tasks for select to authenticated
  using (public.is_peet_admin() or (assigned_to = auth.uid() and exists
    (select 1 from public.officer_profiles where id = auth.uid())));
drop policy if exists officer_evaluations_read on public.peet_evaluations;
create policy officer_evaluations_read on public.peet_evaluations for select to authenticated
  using (public.is_peet_admin() or exists
    (select 1 from public.tasks where tasks.id = task_id and assigned_to = auth.uid()));

-- Writes go through validated RPCs; browsers cannot change roles, identities,
-- timestamps, completion status, or scores directly, even on their own records.
revoke all on public.officer_profiles, public.tasks, public.peet_evaluations from public, anon, authenticated;
grant select on public.officer_profiles, public.tasks, public.peet_evaluations to authenticated;
grant all on public.officer_profiles, public.tasks, public.peet_evaluations to service_role;

create or replace function public.save_officer_task(
  p_title text, p_description text default '', p_due_date date default null,
  p_assigned_to uuid default null, p_task_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_admin boolean := public.is_peet_admin();
  v_assignee uuid := coalesce(p_assigned_to, auth.uid());
  v_task public.tasks;
  v_id uuid;
begin
  if v_actor is null or not exists (select 1 from public.officer_profiles where id = v_actor) then
    raise exception 'Officer access is required.';
  end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 200
    or p_description is null or length(p_description) > 10000 then
    raise exception 'Enter a title of 1–200 characters and a description of at most 10,000 characters.';
  end if;
  if not exists (select 1 from public.officer_profiles where id = v_assignee)
    or (not v_admin and v_assignee <> v_actor) then
    raise exception 'You can only assign tasks to yourself.';
  end if;
  if p_task_id is null then
    insert into public.tasks(title, description, due_date, assigned_to, created_by)
      values(btrim(p_title), p_description, p_due_date, v_assignee, v_actor) returning id into v_id;
    return v_id;
  end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or (not v_admin and v_task.assigned_to <> v_actor) then
    raise exception 'Task not available.';
  end if;
  if v_task.status = 'completed' or (not v_admin and v_task.status <> 'in_progress') then
    raise exception 'This task can no longer be edited.';
  end if;
  update public.tasks set title = btrim(p_title), description = p_description,
    due_date = p_due_date, assigned_to = v_assignee where id = p_task_id;
  return p_task_id;
end;
$$;

create or replace function public.submit_officer_task(p_task_id uuid, p_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks; v_url text := btrim(p_url);
begin
  if auth.uid() is null or not exists (select 1 from public.officer_profiles where id = auth.uid()) then
    raise exception 'Officer access is required.';
  end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or (v_task.assigned_to <> auth.uid() and not public.is_peet_admin()) then
    raise exception 'Task not available.';
  end if;
  if v_task.status <> 'in_progress' then raise exception 'This task has already been submitted.'; end if;
  if v_url is null or length(v_url) > 2048 or v_url !~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$' then
    raise exception 'Enter a valid HTTP or HTTPS link to your final product.';
  end if;
  update public.tasks set final_product_url = v_url, status = 'submitted', submitted_at = now()
    where id = p_task_id;
end;
$$;

create or replace function public.delete_officer_task(p_task_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks;
begin
  if auth.uid() is null or not exists (select 1 from public.officer_profiles where id = auth.uid()) then
    raise exception 'Officer access is required.';
  end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or (not public.is_peet_admin() and
    (v_task.assigned_to <> auth.uid() or v_task.status <> 'in_progress')) then
    raise exception 'Only your in-progress tasks can be deleted.';
  end if;
  delete from public.tasks where id = p_task_id;
end;
$$;

-- One evaluation per task prevents repeated reviews from changing its weight.
-- The task lock and transaction make evaluation + completion atomic.
create or replace function public.evaluate_officer_task(
  p_task_id uuid, p_efficiency numeric, p_effectiveness numeric, p_time numeric,
  p_feedback text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks;
begin
  if auth.uid() is null or not public.is_peet_admin() then raise exception 'PEET reviewer access is required.'; end if;
  if p_efficiency is null or p_efficiency not between 1 and 4
    or p_effectiveness is null or p_effectiveness not between 1 and 4
    or p_time is null or p_time not between 1 and 4 then
    raise exception 'Each PEET score must be between 1.0 and 4.0.';
  end if;
  if p_feedback is null or length(p_feedback) > 10000 then raise exception 'Feedback must be at most 10,000 characters.'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or v_task.status not in ('submitted', 'completed') then
    raise exception 'Only submitted or completed tasks can be evaluated.';
  end if;
  insert into public.peet_evaluations(task_id, evaluated_by, efficiency, effectiveness, time, feedback_notes)
    values(p_task_id, auth.uid(), p_efficiency, p_effectiveness, p_time, p_feedback)
    on conflict(task_id) do update set evaluated_by = excluded.evaluated_by,
      efficiency = excluded.efficiency, effectiveness = excluded.effectiveness,
      time = excluded.time, feedback_notes = excluded.feedback_notes, evaluated_at = now();
  update public.tasks set status = 'completed', completed_at = coalesce(completed_at, now()) where id = p_task_id;
end;
$$;

revoke all on function public.is_peet_admin() from public, anon, authenticated;
revoke all on function public.save_officer_task(text,text,date,uuid,uuid) from public, anon, authenticated;
revoke all on function public.submit_officer_task(uuid,text) from public, anon, authenticated;
revoke all on function public.delete_officer_task(uuid) from public, anon, authenticated;
revoke all on function public.evaluate_officer_task(uuid,numeric,numeric,numeric,text) from public, anon, authenticated;
grant execute on function public.is_peet_admin(), public.save_officer_task(text,text,date,uuid,uuid),
  public.submit_officer_task(uuid,text), public.delete_officer_task(uuid),
  public.evaluate_officer_task(uuid,numeric,numeric,numeric,text) to authenticated;
commit;
