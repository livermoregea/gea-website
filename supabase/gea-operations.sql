-- Apply after officer-shared-tasks.sql. Additive; preserves existing officer permissions.
begin;
create or replace function public.can_manage_meetings()
returns boolean language sql stable security definer set search_path='' as $$
 select public.has_officer_access() and (public.is_peet_admin() or exists(
 select 1 from public.officer_profiles where id=auth.uid() and lower(btrim(position))='secretary' and access_enabled));
$$;
create or replace function public.has_gea_workspace()
returns boolean language sql stable security definer set search_path='' as $$
 select public.has_officer_access() or public.is_super_admin() or exists(select 1 from public.admins where auth_user_id=auth.uid())
 or exists(select 1 from public.teacher_profiles where auth_user_id=auth.uid());
$$;
create table if not exists public.gea_meeting_notes (
 id uuid primary key default gen_random_uuid(), event_id uuid not null unique references public.officer_events(id),
 minutes text not null default '' check(length(minutes)<=20000), decisions text not null default '' check(length(decisions)<=10000),
 version integer not null default 1, updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.gea_agenda_items (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.officer_events(id),
 author_id uuid not null references auth.users(id), title text not null check(length(btrim(title)) between 1 and 200),
 details text not null default '' check(length(details)<=5000), task_id uuid references public.tasks(id), created_at timestamptz not null default now()
);
create table if not exists public.gea_event_plans (
 id uuid primary key default gen_random_uuid(), event_id uuid not null unique references public.officer_events(id),
 organizer_id uuid references public.officer_profiles(id), staffing text not null default '' check(length(staffing)<=5000),
 supplies text not null default '' check(length(supplies)<=5000), recap text not null default '' check(length(recap)<=10000),
 version integer not null default 1, updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.gea_event_checklist (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.officer_events(id),
 title text not null check(length(btrim(title)) between 1 and 200), done boolean not null default false,
 created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.gea_task_blockers (
 id uuid primary key default gen_random_uuid(), task_id uuid not null unique references public.tasks(id),
 officer_id uuid not null references public.officer_profiles(id), helper_id uuid references public.officer_profiles(id),
 reason text not null check(length(btrim(reason)) between 1 and 5000), resolved_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.gea_notification_reads (
 user_id uuid not null references auth.users(id) on delete cascade, notification_key text not null check(length(notification_key) between 1 and 300),
 read_at timestamptz not null default now(), primary key(user_id,notification_key)
);
create table if not exists public.gea_digest_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade, enabled boolean not null default false
);
create table if not exists public.gea_weekly_digests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 week_of date not null, items jsonb not null, created_at timestamptz not null default now(), unique(user_id,week_of)
);
-- Shared operational records contain no personal accountability details.
do $$ declare t text; begin
 foreach t in array array['gea_meeting_notes','gea_agenda_items','gea_event_plans','gea_event_checklist'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists gea_workspace_read on public.%I',t);
  execute format('create policy gea_workspace_read on public.%I for select to authenticated using(public.has_officer_access())',t);
 end loop;
 foreach t in array array['gea_notification_reads','gea_digest_preferences','gea_weekly_digests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists gea_self_read on public.%I',t);
  execute format('create policy gea_self_read on public.%I for select to authenticated using(user_id=auth.uid() and public.has_gea_workspace())',t);
 end loop;
 foreach t in array array['gea_meeting_notes','gea_agenda_items','gea_event_plans','gea_event_checklist','gea_task_blockers','gea_notification_reads','gea_digest_preferences','gea_weekly_digests'] loop
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
alter table public.gea_task_blockers enable row level security;
create or replace function public.is_open_gea_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.has_officer_access() and exists(select 1 from public.tasks where id=p_task_id and status='in_progress' and cancelled_at is null);
$$;
drop policy if exists blocker_read on public.gea_task_blockers;
create policy blocker_read on public.gea_task_blockers for select to authenticated using(public.can_read_officer_task(task_id) or (public.is_open_gea_task(task_id) and helper_id=auth.uid()));
-- Safe secretary roll call: names and statuses only, no absence explanations or reviewer notes.
create or replace function public.meeting_roll_call(p_event_id uuid)
returns table(officer_id uuid,name text,"position" text,status text) language plpgsql stable security definer set search_path='' as $$ begin
 if not public.can_manage_meetings() then raise exception 'Secretary or reviewer access is required.'; end if;
 if not exists(select 1 from public.officer_events where id=p_event_id and kind='meeting') then raise exception 'Meeting unavailable.'; end if;
 return query select p.id,p.name,p.position,coalesce(a.status,'unmarked') from public.officer_profiles p
 left join public.officer_attendance a on a.officer_id=p.id and a.event_id=p_event_id
 where public.is_task_officer(p.id) order by p.name,p.id;
end $$;
create or replace function public.save_meeting_attendance(p_event_id uuid,p_rows jsonb)
returns void language plpgsql security definer set search_path='' as $$ declare r jsonb; s text; who uuid; ev public.officer_events; begin
 if not public.can_manage_meetings() then raise exception 'Secretary or reviewer access is required.'; end if;
 select * into ev from public.officer_events where id=p_event_id for update;
 if not found or ev.kind<>'meeting' or ev.cancelled then raise exception 'Select an active meeting.'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>200 then raise exception 'Invalid attendance list.'; end if;
 for r in select * from jsonb_array_elements(p_rows) loop
  who:=(r->>'officer_id')::uuid; s:=r->>'status';
  if not public.is_task_officer(who) or s is null or s not in ('unmarked','present','late','excused','unexcused') then raise exception 'Invalid officer or attendance status.'; end if;
  if s in ('present','late','unexcused') and ev.starts_at>now() then raise exception 'Record actual attendance after the meeting begins.'; end if;
  if s<>'unexcused' and exists(select 1 from public.officer_strikes st join public.officer_attendance a on a.id=st.attendance_id
   where a.officer_id=who and a.event_id=p_event_id and st.status='confirmed') then raise exception 'A reviewer must revoke the linked strike before correcting this absence.'; end if;
  if exists(select 1 from public.officer_attendance a where a.officer_id=who and a.event_id=p_event_id and a.status is distinct from r->>'original_status')
   or (not exists(select 1 from public.officer_attendance a where a.officer_id=who and a.event_id=p_event_id) and r->>'original_status' is distinct from 'unmarked') then
   raise exception 'Attendance changed in another session. Reload the meeting before saving.';
  end if;
  insert into public.officer_attendance(event_id,officer_id,status,recorded_by) values(p_event_id,who,s,auth.uid())
  on conflict(event_id,officer_id) do update set status=excluded.status,recorded_by=auth.uid(),updated_at=now();
 end loop;
end $$;
create or replace function public.save_meeting_notes(p_event_id uuid,p_minutes text,p_decisions text,p_version integer)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.can_manage_meetings() then raise exception 'Secretary or reviewer access is required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind='meeting' and not cancelled for update;
 if not found then raise exception 'Select an active meeting.'; end if;
 if coalesce((select version from public.gea_meeting_notes where event_id=p_event_id),0)<>p_version or p_version is null then raise exception 'Notes changed in another session. Reload before saving.'; end if;
 insert into public.gea_meeting_notes(event_id,minutes,decisions,updated_by) values(p_event_id,p_minutes,p_decisions,auth.uid())
 on conflict(event_id) do update set minutes=excluded.minutes,decisions=excluded.decisions,updated_by=auth.uid(),updated_at=now(),version=public.gea_meeting_notes.version+1;
end $$;
create or replace function public.add_meeting_agenda(p_event_id uuid,p_title text,p_details text)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_officer_access() then raise exception 'Officer access required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind='meeting' and not cancelled for update;
 if not found then raise exception 'Select an active meeting.'; end if;
 insert into public.gea_agenda_items(event_id,author_id,title,details) values(p_event_id,auth.uid(),btrim(p_title),p_details);
end $$;
create or replace function public.assign_agenda_action(p_agenda_id uuid,p_assignee uuid,p_due_date date)
returns uuid language plpgsql security definer set search_path='' as $$ declare a public.gea_agenda_items; v_id uuid; begin
 if not public.can_manage_meetings() then raise exception 'Secretary or reviewer access required.'; end if;
 select * into a from public.gea_agenda_items where id=p_agenda_id for update;
 if not found or a.task_id is not null then raise exception 'This item is unavailable or already assigned.'; end if;
 if not public.is_task_officer(p_assignee) or (p_due_date is not null and p_due_date<(now() at time zone 'America/Los_Angeles')::date) then raise exception 'Choose an active officer and a future deadline.'; end if;
 if exists(select 1 from public.officer_events where id=a.event_id and cancelled) then raise exception 'Meeting cancelled.'; end if;
 -- Secretary may create an action item, but gains no task review/evaluation rights.
 insert into public.tasks(title,description,assigned_to,created_by,due_date,original_due_date)
 values(a.title,a.details,p_assignee,auth.uid(),p_due_date,p_due_date) returning id into v_id;
 update public.gea_agenda_items set task_id=v_id where id=a.id;
 return v_id;
end $$;
create or replace function public.save_event_plan(p_event_id uuid,p_organizer uuid,p_staffing text,p_supplies text,p_recap text,p_version integer)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_officer_access() then raise exception 'Officer access required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind<>'meeting' and not cancelled for update;
 if not found then raise exception 'Select an active service event.'; end if;
 if not public.is_peet_admin() and not exists(select 1 from public.gea_event_plans where event_id=p_event_id and organizer_id=auth.uid()) then raise exception 'Only the organizer or a reviewer can edit this plan.'; end if;
 if p_organizer is not null and not public.is_task_officer(p_organizer) then raise exception 'Choose an active officer as organizer.'; end if;
 if coalesce((select version from public.gea_event_plans where event_id=p_event_id),0)<>p_version or p_version is null then raise exception 'Plan changed in another session. Reload before saving.'; end if;
 if not public.is_peet_admin() and p_organizer is distinct from auth.uid() then raise exception 'A reviewer must reassign the organizer.'; end if;
 insert into public.gea_event_plans(event_id,organizer_id,staffing,supplies,recap,updated_by) values(p_event_id,p_organizer,p_staffing,p_supplies,p_recap,auth.uid())
 on conflict(event_id) do update set organizer_id=excluded.organizer_id,staffing=excluded.staffing,supplies=excluded.supplies,recap=excluded.recap,version=public.gea_event_plans.version+1,updated_by=auth.uid(),updated_at=now();
end $$;
create or replace function public.save_event_checklist(p_event_id uuid,p_title text,p_done boolean default false,p_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_officer_access() or not (public.is_peet_admin() or exists(select 1 from public.gea_event_plans where event_id=p_event_id and organizer_id=auth.uid())) then raise exception 'Organizer or reviewer access required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind<>'meeting' and not cancelled for update;
 if not found then raise exception 'Select an active service event.'; end if;
 if p_id is null then insert into public.gea_event_checklist(event_id,title,done,created_by,updated_by) values(p_event_id,btrim(p_title),p_done,auth.uid(),auth.uid());
 else update public.gea_event_checklist set title=btrim(p_title),done=p_done,updated_by=auth.uid(),updated_at=now() where id=p_id and event_id=p_event_id;
 if not found then raise exception 'Checklist item unavailable.'; end if; end if;
end $$;
create or replace function public.save_task_blocker(p_task_id uuid,p_reason text,p_helper uuid default null,p_resolved boolean default false)
returns void language plpgsql security definer set search_path='' as $$ declare t public.tasks; begin
 if not public.has_officer_access() then raise exception 'Officer access required.'; end if;
 select * into t from public.tasks where id=p_task_id for update;
 if not found or not public.is_officer_task_participant(p_task_id) or t.status<>'in_progress' or t.cancelled_at is not null then raise exception 'Only participants can flag their active task.'; end if;
 if p_helper is not null and not exists(select 1 from public.officer_profiles where id=p_helper and access_enabled) then raise exception 'Helper unavailable.'; end if;
 insert into public.gea_task_blockers(task_id,officer_id,reason,helper_id,resolved_at) values(p_task_id,auth.uid(),btrim(p_reason),p_helper,case when p_resolved then now() end)
 on conflict(task_id) do update set reason=excluded.reason,helper_id=excluded.helper_id,officer_id=auth.uid(),resolved_at=excluded.resolved_at,updated_at=now();
end $$;
create or replace function public.mark_gea_notifications(p_keys text[])
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_gea_workspace() then raise exception 'Workspace access required.'; end if;
 if p_keys is null or cardinality(p_keys)>10000 then raise exception 'Invalid notification list.'; end if;
 insert into public.gea_notification_reads(user_id,notification_key) select auth.uid(),k from unnest(p_keys) k on conflict do nothing;
end $$;
create or replace function public.set_gea_digest(p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_gea_workspace() then raise exception 'Workspace access required.'; end if;
 insert into public.gea_digest_preferences(user_id,enabled) values(auth.uid(),p_enabled) on conflict(user_id) do update set enabled=excluded.enabled;
end $$;
-- Atomic weekly snapshots are generated by the server from permission-filtered attention items.
create or replace function public.save_gea_digest(p_items jsonb)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_gea_workspace() then raise exception 'Workspace access required.'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or pg_column_size(p_items)>500000 then raise exception 'Invalid digest.'; end if;
 if exists(select 1 from public.gea_digest_preferences where user_id=auth.uid() and enabled) then
 insert into public.gea_weekly_digests(user_id,week_of,items) values(auth.uid(),date_trunc('week',now() at time zone 'America/Los_Angeles')::date,p_items) on conflict do nothing;
 end if;
end $$;
-- Keep operational edits auditable without opening the audit log to secretaries.
do $$ declare t text; begin
 foreach t in array array['gea_meeting_notes','gea_agenda_items','gea_event_plans','gea_event_checklist','gea_task_blockers'] loop
 execute format('drop trigger if exists operations_audit on public.%I',t);
 execute format('create trigger operations_audit after insert or update or delete on public.%I for each row execute function public.audit_officer_tracking()',t);
 end loop;
end $$;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array[
 'can_manage_meetings','is_open_gea_task','has_gea_workspace','meeting_roll_call','save_meeting_attendance','save_meeting_notes','add_meeting_agenda','assign_agenda_action','save_event_plan','save_event_checklist','save_task_blocker','mark_gea_notifications','set_gea_digest','save_gea_digest']) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;

-- Digests are delivered in the portal; no external messages are sent.
alter table public.gea_weekly_digests add column if not exists scope text not null default 'officer';
drop policy if exists gea_self_read on public.gea_weekly_digests;
create policy gea_self_read on public.gea_weekly_digests for select to authenticated using(user_id=auth.uid() and public.has_gea_workspace()
 and (scope='officer' and public.has_officer_access() or scope='reviewer' and public.has_officer_access() and public.is_peet_admin()
 or scope='staff' and (public.is_super_admin() or exists(select 1 from public.admins where auth_user_id=auth.uid()) or exists(select 1 from public.teacher_profiles where auth_user_id=auth.uid()))));
create or replace function public.save_gea_digest(p_items jsonb)
returns void language plpgsql security definer set search_path='' as $$ declare v_scope text; begin
 if not public.has_gea_workspace() then raise exception 'Workspace access required.'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or pg_column_size(p_items)>500000 then raise exception 'Invalid digest.'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) i where jsonb_typeof(i)<>'object' or coalesce(i->>'href','') !~ '^/(operations|officerboard|admin-portal-x7k9)([/?#]|$)' or length(coalesce(i->>'title',''))>1000) then raise exception 'Invalid digest item.'; end if;
 v_scope:=case when public.has_officer_access() and public.is_peet_admin() then 'reviewer' when public.has_officer_access() then 'officer' else 'staff' end;
 if exists(select 1 from public.gea_digest_preferences where user_id=auth.uid() and enabled) then
 insert into public.gea_weekly_digests(user_id,week_of,items,scope) values(auth.uid(),date_trunc('week',now() at time zone 'America/Los_Angeles')::date,p_items,v_scope) on conflict do nothing;
 end if;
end $$;
-- A scheduler may call this service-only function weekly, even when nobody visits.
create or replace function public.refresh_gea_weekly_digests()
returns integer language plpgsql security definer set search_path='' as $$
declare person record; v_items jsonb; v_reviewer boolean; v_staff boolean; v_member boolean; v_scope text; v_count integer:=0; v_added integer; v_week date:=date_trunc('week',now() at time zone 'America/Los_Angeles')::date; begin
 for person in select user_id from public.gea_digest_preferences where enabled loop
  v_member:=exists(select 1 from public.officer_profiles where id=person.user_id and access_enabled);
  v_staff:=exists(select 1 from public.admins where auth_user_id=person.user_id) or exists(select 1 from public.teacher_profiles where auth_user_id=person.user_id) or exists(select 1 from public.super_admins where auth_user_id=person.user_id and explicit_grant);
  v_reviewer:=exists(select 1 from public.officer_profiles where id=person.user_id and access_enabled and role='admin') or exists(select 1 from public.super_admins where auth_user_id=person.user_id and explicit_grant) or exists(select 1 from public.teacher_profiles where auth_user_id=person.user_id);
  if not v_member and not v_staff then continue; end if;
  v_scope:=case when v_member and v_reviewer then 'reviewer' when v_member then 'officer' else 'staff' end;
  select coalesce(jsonb_agg(item),'[]'::jsonb) into v_items from (
   select jsonb_build_object('key','task:'||t.id,'title',t.title,'detail',case when t.status='submitted' then 'Submission awaiting review' else 'Upcoming or overdue task' end,'href',case when v_staff then '/admin-portal-x7k9/officers' else '/officerboard' end,'category','Tasks') item
   from public.tasks t where v_member and t.cancelled_at is null and t.status<>'completed'
    and (v_reviewer or t.assigned_to=person.user_id or exists(select 1 from public.officer_task_members m where m.task_id=t.id and m.officer_id=person.user_id))
    and (v_reviewer and t.status='submitted' or t.status='in_progress' and t.due_date<=(now() at time zone 'America/Los_Angeles')::date+7)
   union all select jsonb_build_object('key','event:'||e.id,'title',e.title,'detail','Upcoming '||e.kind,'href','/operations?view='||case when e.kind='meeting' then 'meetings' else 'events' end||'&event='||e.id,'category','Calendar')
   from public.officer_events e where v_member and not e.cancelled and e.ends_at>=now() and e.starts_at<now()+interval '7 days'
   union all select jsonb_build_object('key','service:'||l.id,'title',e.title,'detail','Service hours awaiting verification','href','/admin-portal-x7k9/officers','category','Review')
   from public.officer_volunteer_logs l join public.officer_events e on e.id=l.event_id where v_member and v_reviewer and l.status='pending' and not e.cancelled
   union all select jsonb_build_object('key','application:'||a.id,'title','Leadership application','detail','Application awaiting review','href','/admin-portal-x7k9/applications','category','Administration')
   from public.applications a where v_staff and a.status='pending'
   union all select jsonb_build_object('key','profile:'||r.id,'title','Profile change · '||r.requested_by_name,'detail','Profile change awaiting review','href','/admin-portal-x7k9/profile-changes','category','Administration')
   from public.profile_change_requests r where v_staff and r.status='pending'
   union all select jsonb_build_object('key','builder:'||b.id,'title',b.title,'detail','Builder submission awaiting review','href','/admin-portal-x7k9/builders','category','Administration')
   from public.builder_submissions b where v_staff and b.status='pending'
   union all select jsonb_build_object('key','forum-question:'||q.id,'title','Forum question','detail','Forum question awaiting review','href','/admin-portal-x7k9/forum','category','Administration')
   from public.qa_questions q where v_staff and q.status='pending'
   union all select jsonb_build_object('key','forum-answer:'||a.id,'title','Forum answer','detail','Forum answer awaiting review','href','/admin-portal-x7k9/forum','category','Administration')
   from public.qa_answers a where v_staff and a.status='pending'
   union all select jsonb_build_object('key','help:'||b.task_id,'title',case when v_reviewer or t.assigned_to=person.user_id or exists(select 1 from public.officer_task_members m where m.task_id=t.id and m.officer_id=person.user_id) then t.title else 'Help requested on a task' end,'detail',b.reason,'href','/operations?view=blockers','category','Help')
   from public.gea_task_blockers b join public.tasks t on t.id=b.task_id where v_member and b.resolved_at is null and t.status='in_progress' and t.cancelled_at is null
    and (v_reviewer or t.assigned_to=person.user_id or b.helper_id=person.user_id or exists(select 1 from public.officer_task_members m where m.task_id=t.id and m.officer_id=person.user_id))
   union all select jsonb_build_object('key','cancellation:'||c.id,'title',t.title,'detail','Cancellation request awaiting review','href',case when v_staff then '/admin-portal-x7k9/officers?task=' else '/officerboard?task=' end||t.id,'category','Review')
   from public.officer_task_cancellation_requests c join public.tasks t on t.id=c.task_id where v_member and v_reviewer and c.status='pending'
   union all select jsonb_build_object('key','concern:'||s.id,'title','Accountability notice','detail','Review the notice and explain your circumstances','href',case when v_staff then '/admin-portal-x7k9/officers?topic=accountability' else '/officerboard?topic=accountability' end,'category','Response')
   from public.officer_strikes s where v_member and s.officer_id=person.user_id and s.status='notified'

  ) entries;
  insert into public.gea_weekly_digests(user_id,week_of,items,scope) values(person.user_id,v_week,v_items,v_scope) on conflict do nothing;
  get diagnostics v_added=row_count;v_count:=v_count+v_added;
 end loop;
 return v_count;
end $$;
revoke all on function public.refresh_gea_weekly_digests() from public,anon,authenticated;
grant execute on function public.refresh_gea_weekly_digests() to service_role;
commit;
