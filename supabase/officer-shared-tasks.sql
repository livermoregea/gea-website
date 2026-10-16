-- Run after officer-task-scored-ending.sql. One task, submission and evaluation per team.
begin;
create table if not exists public.officer_task_members (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id),
 officer_id uuid not null references public.officer_profiles(id),
 added_at timestamptz not null default now(),
 unique(task_id,officer_id)
);
create index if not exists officer_task_members_officer on public.officer_task_members(officer_id,task_id);
alter table public.officer_task_members enable row level security;
revoke all on public.officer_task_members from public,anon,authenticated;
grant select on public.officer_task_members to authenticated;
grant all on public.officer_task_members to service_role;

create or replace function public.is_officer_task_participant(p_task_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tasks t where t.id=p_task_id and
  (t.assigned_to=auth.uid() or exists(select 1 from public.officer_task_members m where m.task_id=t.id and m.officer_id=auth.uid())));
$$;
create or replace function public.can_read_officer_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.has_officer_access() and (public.is_peet_admin() or public.is_officer_task_participant(p_task_id));
$$;
drop policy if exists officer_tasks_read on public.tasks;
create policy officer_tasks_read on public.tasks for select to authenticated using(public.can_read_officer_task(id));
drop policy if exists officer_evaluations_read on public.peet_evaluations;
create policy officer_evaluations_read on public.peet_evaluations for select to authenticated using(public.can_read_officer_task(task_id));
drop policy if exists task_members_read on public.officer_task_members;
create policy task_members_read on public.officer_task_members for select to authenticated using(public.can_read_officer_task(task_id));
drop policy if exists cancellation_requests_read on public.officer_task_cancellation_requests;
create policy cancellation_requests_read on public.officer_task_cancellation_requests for select to authenticated using(public.can_read_officer_task(task_id));

-- A minimal picker directory; other officers' email addresses and records stay private.
create or replace function public.officer_task_teammates()
returns table(id uuid,name text,"position" text) language sql stable security definer set search_path='' as $$
 select p.id,p.name,p.position from public.officer_profiles p
 where public.has_officer_access() and public.is_task_officer(p.id);
$$;

create or replace function public.guard_officer_task_members()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; v_task_id uuid; begin
 if tg_op='UPDATE' then raise exception 'Remove and add a participant instead of changing membership identity.'; end if;
 if tg_op='DELETE' then v_task_id:=old.task_id; else v_task_id:=new.task_id; end if;
 select * into v_task from public.tasks where id=v_task_id for update;
 if not public.has_officer_access() or not found or v_task.created_by<>auth.uid() or v_task.assigned_to<>auth.uid()
  or v_task.status<>'in_progress' or v_task.cancelled_at is not null then
  raise exception 'Only the creator can change people on their own in-progress task.';
 end if;
 if tg_op='INSERT' then
  if new.officer_id=v_task.assigned_to or not public.is_task_officer(new.officer_id) then
   raise exception 'Choose another active officer. Teachers and advisors cannot join officer tasks.';
  end if;
  return new;
 end if;
 return old;
end $$;
drop trigger if exists task_members_guard on public.officer_task_members;
create trigger task_members_guard before insert or update or delete on public.officer_task_members for each row execute function public.guard_officer_task_members();
create or replace function public.audit_officer_task_members()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_old jsonb; v_new jsonb; begin
 if tg_op<>'INSERT' then v_old:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then v_new:=to_jsonb(new); end if;
 insert into public.officer_tracking_audit(officer_id,table_name,record_id,actor_id,action,before_record,after_record)
 values(coalesce(v_new->>'officer_id',v_old->>'officer_id')::uuid,tg_table_name,coalesce(v_new->>'id',v_old->>'id')::uuid,auth.uid(),tg_op,v_old,v_new);
 if tg_op='DELETE' then return old; end if; return new;
end $$;
drop trigger if exists task_members_audit on public.officer_task_members;
create trigger task_members_audit after insert or update or delete on public.officer_task_members for each row execute function public.audit_officer_task_members();

create or replace function public.save_officer_shared_task(
 p_title text,p_description text,p_due_date date,p_people uuid[],p_task_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; v_id uuid; begin
 if not public.has_officer_access() or not public.is_task_officer(auth.uid()) then raise exception 'Active officer access is required.'; end if;
 if p_people is null or cardinality(p_people) not between 1 and 100 or not (auth.uid()=any(p_people))
  or exists(select 1 from unnest(p_people) i where i is null or not public.is_task_officer(i)) then
  raise exception 'Keep yourself on the task and choose up to 99 other active officers.';
 end if;
 if p_task_id is not null then
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found or v_task.created_by<>auth.uid() or v_task.assigned_to<>auth.uid() or v_task.status<>'in_progress' or v_task.cancelled_at is not null then
   raise exception 'Only the creator can change people on their own in-progress task.';
  end if;
 end if;
 v_id:=public.save_officer_task(p_title,p_description,p_due_date,auth.uid(),p_task_id);
 delete from public.officer_task_members where task_id=v_id and not(officer_id=any(p_people));
 insert into public.officer_task_members(task_id,officer_id)
 select v_id,i from (select distinct i from unnest(p_people) i where i<>auth.uid()) people
 on conflict(task_id,officer_id) do nothing;
 return v_id;
end $$;

create or replace function public.guard_officer_task_editing()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); begin
 if tg_op='INSERT' then new.original_due_date:=new.due_date; return new; end if;
 if new.assigned_to is distinct from old.assigned_to and exists(select 1 from public.officer_task_members where task_id=old.id) then
  raise exception 'Shared tasks keep their creator as the primary officer.';
 end if;
 if new.original_due_date is distinct from old.original_due_date or new.created_by is distinct from old.created_by then
  raise exception 'The original deadline and task creator cannot be changed.';
 end if;
 if new.title is distinct from old.title or new.description is distinct from old.description
  or new.due_date is distinct from old.due_date or new.assigned_to is distinct from old.assigned_to then
  if v_actor is null or not public.has_officer_access() or (old.created_by<>v_actor and not (public.is_peet_admin() and not public.is_officer_task_participant(old.id))) then
   raise exception 'Only the assigner or a reviewer can edit this task.';
  end if;
  if old.status='completed' or (old.created_by=old.assigned_to and old.status<>'in_progress' and not (public.is_peet_admin() and not public.is_officer_task_participant(old.id))) then
   raise exception 'This task can no longer be edited.';
  end if;
  if old.created_by=old.assigned_to and not (public.is_peet_admin() and not public.is_officer_task_participant(old.id)) then
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
  if not found or (v_task.created_by<>v_actor and not (public.is_peet_admin() and not public.is_officer_task_participant(v_task.id))) then raise exception 'Only the assigner or a reviewer can edit this task.'; end if;
  if v_task.cancelled_at is not null or v_task.status='completed' or (v_task.created_by=v_task.assigned_to and v_task.status<>'in_progress' and not (public.is_peet_admin() and not public.is_officer_task_participant(v_task.id))) then
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

create or replace function public.submit_officer_task(p_task_id uuid,p_url text,p_description text)
returns void language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; v_url text:=nullif(btrim(p_url),'');
 v_description text:=btrim(coalesce(p_description,''),E' \t\n\r'); begin
 if not public.has_officer_access() then raise exception 'Officer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or (not public.is_officer_task_participant(v_task.id) and not public.is_peet_admin()) then
  raise exception 'Task not available.';
 end if;
 if v_task.cancelled_at is not null or v_task.status<>'in_progress' then
  raise exception 'This task can no longer be submitted.';
 end if;
 if length(v_description)>10000 then raise exception 'Keep the work description within 10,000 characters.'; end if;
 if v_url is not null and (length(v_url)>2048 or v_url !~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$') then
  raise exception 'Enter a valid HTTP or HTTPS link, or leave the link blank.';
 end if;
 if v_url is null and v_description='' then raise exception 'Describe the completed work or add a link.'; end if;
 update public.tasks set final_product_url=v_url,submission_description=v_description,
  status='submitted',submitted_at=now() where id=p_task_id;
end $$;

create or replace function public.request_officer_task_cancellation(p_task_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$ declare v_task public.tasks; begin
 if not public.has_officer_access() then raise exception 'Active officer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or not public.is_officer_task_participant(v_task.id) then raise exception 'You can only request cancellation of your own tasks.'; end if;
 if v_task.cancelled_at is not null or v_task.status='completed' then raise exception 'This task is already closed.'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then raise exception 'Explain why cancellation is needed in 10–2,000 characters.'; end if;
 if exists(select 1 from public.officer_task_cancellation_requests where task_id=p_task_id and status='pending') then raise exception 'A cancellation request is already awaiting review.'; end if;
 insert into public.officer_task_cancellation_requests(task_id,requested_by,reason) values(p_task_id,auth.uid(),btrim(p_reason));
end $$;

create or replace function public.review_officer_task_cancellation(p_request_id uuid,p_status text,p_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare v_request public.officer_task_cancellation_requests; v_task public.tasks; v_task_id uuid; begin
 if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 select task_id into v_task_id from public.officer_task_cancellation_requests where id=p_request_id;
 select * into v_task from public.tasks where id=v_task_id for update;
 if not found then raise exception 'Task not available.'; end if;
 select * into v_request from public.officer_task_cancellation_requests where id=p_request_id for update;
 if not found or v_request.status<>'pending' then raise exception 'This request has already been reviewed.'; end if;
 if v_request.requested_by=auth.uid() or public.is_officer_task_participant(v_task.id) then raise exception 'Someone else must review cancellation of your task.'; end if;
 if p_status is null or p_status not in ('approved','rejected') or p_notes is null or length(btrim(p_notes)) not between 10 and 2000 then raise exception 'Choose a decision and document the reasoning.'; end if;
 if p_status='approved' and (v_task.cancelled_at is not null or v_task.status='completed') then raise exception 'The task is already closed; reject this outdated request instead.'; end if;
 if p_status='approved' then
   update public.tasks set cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=p_notes where id=v_task.id;
 end if;
 update public.officer_task_cancellation_requests set status=p_status,review_notes=p_notes,reviewed_by=auth.uid(),reviewed_at=now() where id=p_request_id;
end $$;

create or replace function public.cancel_officer_task(p_task_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$ declare v_task public.tasks; begin
 if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or v_task.cancelled_at is not null then raise exception 'Task not available.'; end if;
 if public.is_officer_task_participant(v_task.id) then raise exception 'Submit a cancellation request. Someone else must review your own task.'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then raise exception 'Document why this task is being cancelled in 10–2,000 characters.'; end if;
 update public.tasks set cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=btrim(p_reason) where id=p_task_id;
 update public.officer_task_cancellation_requests set status='approved',review_notes=btrim(p_reason),reviewed_by=auth.uid(),reviewed_at=now() where task_id=p_task_id and status='pending';
end $$;

create or replace function public.guard_officer_task_end()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='INSERT' then
  if new.ended_by is not null or new.end_notes is not null then raise exception 'New tasks cannot already be ended.'; end if;
 elsif new.ended_by is distinct from old.ended_by or new.end_notes is distinct from old.end_notes then
  if old.ended_by is not null or old.status='completed' or old.cancelled_at is not null then
   raise exception 'This task is already closed.';
  end if;
  if not public.has_officer_access() or not public.is_peet_admin() or auth.uid() is null or public.is_officer_task_participant(old.id)
   or new.assigned_to is distinct from old.assigned_to or new.ended_by is distinct from auth.uid() or new.status<>'completed' then
   raise exception 'A different reviewer must end this task.';
  end if;
 end if;
 return new;
end $$;

create or replace function public.end_officer_task(p_task_id uuid,p_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; begin
 if not public.has_officer_access() or not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or v_task.cancelled_at is not null or v_task.status='completed' then raise exception 'This task is already closed or unavailable.'; end if;
 if public.is_officer_task_participant(v_task.id) then raise exception 'A different reviewer must end your task.'; end if;
 if p_notes is null or length(btrim(p_notes)) not between 10 and 2000 then raise exception 'Explain why this task is being ended in 10–2,000 characters.'; end if;
 update public.tasks set status='completed',completed_at=now(),ended_by=auth.uid(),end_notes=btrim(p_notes) where id=p_task_id;
 update public.officer_task_cancellation_requests set status='rejected',review_notes=btrim(p_notes),
  reviewed_by=auth.uid(),reviewed_at=now() where task_id=p_task_id and status='pending';
end $$;

create or replace function public.check_peet_reviewer()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from public.officer_task_members where task_id=new.task_id) and
  exists(select 1 from public.tasks t where t.id=new.task_id and
   (t.assigned_to=new.evaluated_by or exists(select 1 from public.officer_task_members m where m.task_id=t.id and m.officer_id=new.evaluated_by))) then
  raise exception 'A reviewer who is not on this shared task must evaluate it.';
 end if;
 if exists(select 1 from public.super_admins where auth_user_id=new.evaluated_by) then return new; end if;
 if exists(select 1 from public.officer_profiles p where p.reviewer_kind='president' and
  (exists(select 1 from public.tasks t where t.id=new.task_id and t.assigned_to=p.id) or
   exists(select 1 from public.officer_task_members m where m.task_id=new.task_id and m.officer_id=p.id))) and
  not exists(select 1 from public.officer_profiles where id=new.evaluated_by and role='admin' and reviewer_kind='advisor') then
  raise exception 'The President’s PEET performance must be evaluated by the Academy Advisor.';
 end if;
 return new;
end $$;
revoke all on function public.is_officer_task_participant(uuid),public.can_read_officer_task(uuid),public.officer_task_teammates(),
 public.guard_officer_task_members(),public.audit_officer_task_members(),public.save_officer_shared_task(text,text,date,uuid[],uuid),
 public.guard_officer_task_editing(),public.save_officer_task(text,text,date,uuid,uuid),public.submit_officer_task(uuid,text,text),
 public.request_officer_task_cancellation(uuid,text),public.review_officer_task_cancellation(uuid,text,text),public.cancel_officer_task(uuid,text),
 public.guard_officer_task_end(),public.end_officer_task(uuid,text),public.check_peet_reviewer() from public,anon,authenticated;
grant execute on function public.is_officer_task_participant(uuid),public.can_read_officer_task(uuid),public.officer_task_teammates(),
 public.save_officer_shared_task(text,text,date,uuid[],uuid),public.save_officer_task(text,text,date,uuid,uuid),public.submit_officer_task(uuid,text,text),
 public.request_officer_task_cancellation(uuid,text),public.review_officer_task_cancellation(uuid,text,text),public.cancel_officer_task(uuid,text),
 public.end_officer_task(uuid,text) to authenticated;
commit;
