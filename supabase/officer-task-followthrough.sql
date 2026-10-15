-- Run after teacher-super-admin.sql. Keep task history and require followthrough.
begin;
alter table public.tasks add column if not exists cancelled_at timestamptz;
alter table public.tasks add column if not exists cancelled_by uuid references public.officer_profiles(id);
alter table public.tasks add column if not exists cancellation_reason text;
alter table public.tasks add column if not exists assignment_batch_id uuid;
create table if not exists public.officer_task_cancellation_requests (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id),
 requested_by uuid not null references public.officer_profiles(id),
 reason text not null check(length(btrim(reason)) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 review_notes text not null default '' check(length(review_notes)<=2000),
 reviewed_by uuid references public.officer_profiles(id),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz
);
create unique index if not exists officer_task_cancellation_pending on public.officer_task_cancellation_requests(task_id) where status='pending';
alter table public.officer_task_cancellation_requests enable row level security;
drop policy if exists cancellation_requests_read on public.officer_task_cancellation_requests;
create policy cancellation_requests_read on public.officer_task_cancellation_requests for select to authenticated
 using(public.is_peet_admin() or (requested_by=auth.uid() and public.has_officer_access()));
revoke all on public.officer_task_cancellation_requests from public,anon,authenticated;
grant select on public.officer_task_cancellation_requests to authenticated;
grant all on public.officer_task_cancellation_requests to service_role;

create or replace function public.is_task_officer(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.officer_profiles p where p.id=p_id and p.access_enabled and p.reviewer_kind is distinct from 'advisor')
 and not exists(select 1 from public.teacher_profiles where auth_user_id=p_id);
$$;
create or replace function public.officer_directory()
returns table(id uuid,name text,role text,"position" text,reviewer_kind text,peet_onboarding_seen_at timestamptz,access_enabled boolean,is_teacher boolean,email text)
language sql stable security definer set search_path='' as $$
 select p.id,p.name,p.role,p.position,p.reviewer_kind,p.peet_onboarding_seen_at,p.access_enabled,
   exists(select 1 from public.teacher_profiles t where t.auth_user_id=p.id),u.email::text
 from public.officer_profiles p join auth.users u on u.id=p.id
 where p.access_enabled and (public.is_peet_admin() or (p.id=auth.uid() and public.has_officer_access()));
$$;

-- Enforce assignee eligibility for every caller, including older clients and RPCs.
create or replace function public.guard_task_followthrough()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='DELETE' then raise exception 'Task deletion is disabled. Request cancellation so the task history is preserved.'; end if;
 if tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to then
   if not public.is_task_officer(new.assigned_to) then raise exception 'Assign tasks to active officers. Teachers and advisors cannot be assigned officer tasks.'; end if;
 end if;
 if tg_op='UPDATE' and old.cancelled_at is not null then raise exception 'Cancelled tasks are preserved and cannot be changed.'; end if;
 return new;
end $$;
drop trigger if exists task_followthrough_guard on public.tasks;
create trigger task_followthrough_guard before insert or update or delete on public.tasks for each row execute function public.guard_task_followthrough();
create or replace function public.delete_officer_task(p_task_id uuid)
returns void language plpgsql security definer set search_path='' as $$ begin
 raise exception 'Task deletion is disabled. Submit a cancellation request for independent review.';
end $$;

create or replace function public.assign_officer_tasks(p_assignees uuid[],p_title text,p_description text default '',p_due_date date default null)
returns uuid[] language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_ids uuid[]:='{}'; v_batch uuid:=gen_random_uuid(); v_person uuid; begin
 if not public.has_officer_access() then raise exception 'Officer access is required.'; end if;
 if p_assignees is null or cardinality(p_assignees) not between 1 and 100
   or exists(select 1 from unnest(p_assignees) i where i is null or not public.is_task_officer(i)) then raise exception 'Choose between 1 and 100 active officers. Teachers cannot receive these tasks.'; end if;
 if not public.is_peet_admin() and (cardinality(p_assignees)<>1 or p_assignees[1]<>auth.uid()) then raise exception 'Officers can only create their own tasks.'; end if;
 for v_person in select distinct i from unnest(p_assignees) i loop
   v_id:=public.save_officer_task(p_title,p_description,p_due_date,v_person);
   update public.tasks set assignment_batch_id=v_batch where id=v_id;
   v_ids:=array_append(v_ids,v_id);
 end loop;
 return v_ids;
end $$;

create or replace function public.request_officer_task_cancellation(p_task_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$ declare v_task public.tasks; begin
 if not public.has_officer_access() then raise exception 'Active officer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or v_task.assigned_to<>auth.uid() then raise exception 'You can only request cancellation of your own tasks.'; end if;
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
 if v_request.requested_by=auth.uid() or v_task.assigned_to=auth.uid() then raise exception 'Someone else must review cancellation of your task.'; end if;
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
 if v_task.assigned_to=auth.uid() then raise exception 'Submit a cancellation request. Someone else must review your own task.'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then raise exception 'Document why this task is being cancelled in 10–2,000 characters.'; end if;
 update public.tasks set cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=btrim(p_reason) where id=p_task_id;
 update public.officer_task_cancellation_requests set status='approved',review_notes=btrim(p_reason),reviewed_by=auth.uid(),reviewed_at=now() where task_id=p_task_id and status='pending';
end $$;

create or replace function public.guard_cancelled_evaluation()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 perform 1 from public.tasks where id=new.task_id and cancelled_at is null for update;
 if not found then raise exception 'Cancelled tasks cannot be evaluated.'; end if;
 return new;
end $$;
drop trigger if exists cancelled_evaluation_guard on public.peet_evaluations;
create trigger cancelled_evaluation_guard before insert or update on public.peet_evaluations for each row execute function public.guard_cancelled_evaluation();

-- Preserve audit records for cancellation requests as well as task changes.
create or replace function public.audit_task_followthrough()
returns trigger language plpgsql security definer set search_path='' as $$ declare v_old jsonb; v_new jsonb; v_owner uuid; begin
 if tg_op<>'INSERT' then v_old:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then v_new:=to_jsonb(new); end if;
 v_owner:=coalesce(v_new->>'assigned_to',v_old->>'assigned_to',v_new->>'requested_by',v_old->>'requested_by')::uuid;
 insert into public.officer_tracking_audit(officer_id,table_name,record_id,actor_id,action,before_record,after_record)
 values(v_owner,tg_table_name,coalesce(v_new->>'id',v_old->>'id')::uuid,auth.uid(),tg_op,v_old,v_new);
 if tg_op='DELETE' then return old; end if; return new;
end $$;
drop trigger if exists task_followthrough_audit on public.tasks;
create trigger task_followthrough_audit after insert or update on public.tasks for each row execute function public.audit_task_followthrough();
drop trigger if exists task_followthrough_audit on public.officer_task_cancellation_requests;
create trigger task_followthrough_audit after insert or update on public.officer_task_cancellation_requests for each row execute function public.audit_task_followthrough();

revoke all on function public.is_task_officer(uuid),public.officer_directory(),public.assign_officer_tasks(uuid[],text,text,date),
 public.request_officer_task_cancellation(uuid,text),public.review_officer_task_cancellation(uuid,text,text),public.cancel_officer_task(uuid,text),
 public.guard_task_followthrough(),public.guard_cancelled_evaluation(),public.audit_task_followthrough() from public,anon,authenticated;
grant execute on function public.officer_directory(),public.assign_officer_tasks(uuid[],text,text,date),
 public.request_officer_task_cancellation(uuid,text),public.review_officer_task_cancellation(uuid,text,text),public.cancel_officer_task(uuid,text) to authenticated;
create or replace function public.decide_officer_strike(p_strike_id uuid,p_status text,p_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare v_strike public.officer_strikes; v_count integer; v_context jsonb; begin
  if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
  select * into v_strike from public.officer_strikes where id=p_strike_id for update;
  if not found then raise exception 'Concern not available.'; end if;
  -- Serialize confirmations for the same officer, including different concerns.
  perform 1 from public.officer_profiles where id=v_strike.officer_id for update;
  if p_status is null or p_status not in ('confirmed','dismissed','revoked') or p_notes is null or length(btrim(p_notes)) not between 10 and 10000
    or (v_strike.status='notified' and p_status='revoked') or (v_strike.status='confirmed' and p_status<>'revoked') or v_strike.status in ('dismissed','revoked') then raise exception 'Choose a valid decision and document your review of the circumstances.'; end if;
  if p_status='confirmed' and v_strike.responded_at is null and now()<v_strike.response_due_at then raise exception 'Give the officer an opportunity to respond before confirming.'; end if;
  if v_strike.attendance_id is not null then
    perform 1 from public.officer_attendance a join public.officer_events e on e.id=a.event_id where a.id=v_strike.attendance_id for update of a,e;
  end if;
  if p_status='confirmed' and v_strike.attendance_id is not null and not exists(select 1 from public.officer_attendance a join public.officer_events e on e.id=a.event_id
    where a.id=v_strike.attendance_id and a.status='unexcused' and e.mandatory and not e.cancelled) then raise exception 'The linked absence is no longer an unexcused mandatory absence.'; end if;
  update public.officer_strikes set status=p_status,decision_notes=p_notes,decided_by=auth.uid(),decided_at=now() where id=p_strike_id;
  select count(*) into v_count from public.officer_strikes where officer_id=v_strike.officer_id and academic_year=v_strike.academic_year and category=v_strike.category and status='confirmed';
  if p_status='confirmed' and v_count>=3 then
    select jsonb_build_object('confirmed_strikes',(select jsonb_agg(s) from public.officer_strikes s where s.officer_id=v_strike.officer_id and s.academic_year=v_strike.academic_year and s.category=v_strike.category and s.status='confirmed'),
      'peet_score',(select avg((e.efficiency+e.effectiveness+e.time)/3)/4*100 from public.peet_evaluations e join public.tasks t on t.id=e.task_id where t.assigned_to=v_strike.officer_id and t.status='completed' and t.cancelled_at is null)) into v_context;
    insert into public.officer_removal_reviews(officer_id,academic_year,category,context_snapshot)
      values(v_strike.officer_id,v_strike.academic_year,v_strike.category,v_context) on conflict(officer_id,academic_year,category)
      do update set status='pending',context_snapshot=excluded.context_snapshot,advisor_notes='',decided_by=null,decided_at=null;
  end if;
end $$;


commit;
