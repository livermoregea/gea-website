-- Run after officer-task-due-dates.sql. Reviewer management of other officers.
begin;
create or replace function public.guard_officer_task_editing()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); begin
 if tg_op='INSERT' then new.original_due_date:=new.due_date; return new; end if;
 if new.original_due_date is distinct from old.original_due_date or new.created_by is distinct from old.created_by then
  raise exception 'The original deadline and task creator cannot be changed.';
 end if;
 if new.title is distinct from old.title or new.description is distinct from old.description
  or new.due_date is distinct from old.due_date or new.assigned_to is distinct from old.assigned_to then
  if v_actor is null or not public.has_officer_access() or (old.created_by<>v_actor and not (public.is_peet_admin() and old.assigned_to<>v_actor)) then
   raise exception 'Only the assigner or a reviewer can edit this task.';
  end if;
  if old.status='completed' or (old.created_by=old.assigned_to and old.status<>'in_progress' and not (public.is_peet_admin() and old.assigned_to<>v_actor)) then
   raise exception 'This task can no longer be edited.';
  end if;
  if old.created_by=old.assigned_to and not (public.is_peet_admin() and old.assigned_to<>v_actor) then
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
  if not found or (v_task.created_by<>v_actor and not (public.is_peet_admin() and v_task.assigned_to<>v_actor)) then raise exception 'Only the assigner or a reviewer can edit this task.'; end if;
  if v_task.cancelled_at is not null or v_task.status='completed' or (v_task.created_by=v_task.assigned_to and v_task.status<>'in_progress' and not (public.is_peet_admin() and v_task.assigned_to<>v_actor)) then
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

alter table public.tasks add column if not exists ended_by uuid references public.officer_profiles(id);
alter table public.tasks add column if not exists end_notes text;
alter table public.tasks drop constraint if exists tasks_submission_evidence_check;
alter table public.tasks add constraint tasks_submission_evidence_check check(
 status='in_progress' or
 (status='completed' and ended_by is not null) or
 (submitted_at is not null and (final_product_url is not null or length(btrim(submission_description,E' \t\n\r'))>0))
);
alter table public.tasks drop constraint if exists tasks_reviewer_end_check;
alter table public.tasks add constraint tasks_reviewer_end_check check(
 (ended_by is null and end_notes is null) or
 (ended_by is not null and status='completed' and end_notes is not null and length(btrim(end_notes)) between 10 and 2000)
);

create or replace function public.guard_officer_task_end()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='INSERT' then
  if new.ended_by is not null or new.end_notes is not null then raise exception 'New tasks cannot already be ended.'; end if;
 elsif new.ended_by is distinct from old.ended_by or new.end_notes is distinct from old.end_notes then
  if old.ended_by is not null or old.status='completed' or old.cancelled_at is not null then
   raise exception 'This task is already closed.';
  end if;
  if not public.has_officer_access() or not public.is_peet_admin() or auth.uid() is null or old.assigned_to=auth.uid()
   or new.assigned_to is distinct from old.assigned_to or new.ended_by is distinct from auth.uid() or new.status<>'completed' then
   raise exception 'A different reviewer must end this task.';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists task_end_guard on public.tasks;
create trigger task_end_guard before insert or update on public.tasks for each row execute function public.guard_officer_task_end();

create or replace function public.end_officer_task(p_task_id uuid,p_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; begin
 if not public.has_officer_access() or not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or v_task.cancelled_at is not null or v_task.status='completed' then raise exception 'This task is already closed or unavailable.'; end if;
 if v_task.assigned_to=auth.uid() then raise exception 'A different reviewer must end your task.'; end if;
 if p_notes is null or length(btrim(p_notes)) not between 10 and 2000 then raise exception 'Explain why this task is being ended in 10–2,000 characters.'; end if;
 update public.tasks set status='completed',completed_at=now(),ended_by=auth.uid(),end_notes=btrim(p_notes) where id=p_task_id;
 update public.officer_task_cancellation_requests set status='rejected',review_notes=btrim(p_notes),
  reviewed_by=auth.uid(),reviewed_at=now() where task_id=p_task_id and status='pending';
end $$;
revoke all on function public.guard_officer_task_end(),public.end_officer_task(uuid,text) from public,anon,authenticated;
grant execute on function public.end_officer_task(uuid,text) to authenticated;
commit;
