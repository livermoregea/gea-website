-- Run after officer-task-followthrough.sql. Enforce task ownership and fixed deadline limits.
begin;
alter table public.tasks add column if not exists original_due_date date;
-- Capture the current deadline once for existing records, including an original NULL.
-- The trigger's presence distinguishes a first installation from a reapplication.
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.tasks'::regclass and tgname='task_editing_guard' and not tgisinternal) then
  update public.tasks set original_due_date=due_date where cancelled_at is null;
 end if;
end $$;

create or replace function public.guard_officer_task_editing()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); begin
 if tg_op='INSERT' then new.original_due_date:=new.due_date; return new; end if;
 if new.original_due_date is distinct from old.original_due_date or new.created_by is distinct from old.created_by then
  raise exception 'The original deadline and task creator cannot be changed.';
 end if;
 if new.title is distinct from old.title or new.description is distinct from old.description
  or new.due_date is distinct from old.due_date or new.assigned_to is distinct from old.assigned_to then
  if v_actor is null or not public.has_officer_access() or old.created_by<>v_actor then
   raise exception 'Only the person who assigned this task can edit it.';
  end if;
  if old.status='completed' or (old.created_by=old.assigned_to and old.status<>'in_progress') then
   raise exception 'This task can no longer be edited.';
  end if;
  if old.created_by=old.assigned_to then
   if new.title is distinct from old.title or new.assigned_to is distinct from old.assigned_to then
    raise exception 'For self-created tasks, only the description and deadline can be edited.';
   end if;
   if new.due_date is distinct from old.due_date and
    (old.original_due_date is null or new.due_date is null or abs(new.due_date-old.original_due_date)>3) then
    raise exception 'The deadline must stay within three days of its original date and cannot be added or removed.';
   end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists task_editing_guard on public.tasks;
create trigger task_editing_guard before insert or update on public.tasks for each row execute function public.guard_officer_task_editing();

create or replace function public.save_officer_task(
 p_title text,p_description text default '',p_due_date date default null,
 p_assigned_to uuid default null,p_task_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_assignee uuid; v_task public.tasks; v_id uuid; begin
 if not public.has_officer_access() then raise exception 'Officer access is required.'; end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 200 or p_description is null or length(p_description)>10000 then
  raise exception 'Enter a title of 1–200 characters and a description of at most 10,000 characters.';
 end if;
 if p_task_id is null then
  v_assignee:=coalesce(p_assigned_to,v_actor);
 else
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found or v_task.created_by<>v_actor then raise exception 'Only the person who assigned this task can edit it.'; end if;
  if v_task.cancelled_at is not null or v_task.status='completed' or (v_task.created_by=v_task.assigned_to and v_task.status<>'in_progress') then
   raise exception 'This task can no longer be edited.';
  end if;
  v_assignee:=coalesce(p_assigned_to,v_task.assigned_to);
 end if;
 if not public.is_task_officer(v_assignee) or (not public.is_peet_admin() and v_assignee<>v_actor) then
  raise exception 'Choose an active officer. Officers can only assign tasks to themselves.';
 end if;
 if p_task_id is null then
  insert into public.tasks(title,description,due_date,assigned_to,created_by)
   values(btrim(p_title),p_description,p_due_date,v_assignee,v_actor) returning id into v_id;
  return v_id;
 end if;
 update public.tasks set title=btrim(p_title),description=p_description,due_date=p_due_date,assigned_to=v_assignee where id=p_task_id;
 return p_task_id;
end $$;
revoke all on function public.guard_officer_task_editing(),public.save_officer_task(text,text,date,uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_officer_task(text,text,date,uuid,uuid) to authenticated;
commit;
