-- Apply after all officer migrations, gea-peet-ai.sql, officer-individual-contributions.sql.
begin;
alter table public.officer_profiles add column if not exists discord_id text unique;
alter table public.officer_profiles drop constraint if exists officer_discord_id_format;
alter table public.officer_profiles add constraint officer_discord_id_format check(discord_id is null or discord_id ~ '^[0-9]{17,20}$');

-- Only a verified Supabase Discord identity can establish this mapping.
create or replace function public.bind_officer_discord()
returns boolean language plpgsql security definer set search_path='' as $$
declare v_discord text; v_profile uuid; begin
 select identity_data->>'sub' into v_discord from auth.identities where user_id=auth.uid() and provider='discord';
 if v_discord is null then raise exception 'Connect Discord to your existing GEA One account first.'; end if;
 select id into v_profile from public.officer_profiles where discord_id=v_discord;
 if v_profile is not null and v_profile<>auth.uid() then raise exception 'Discord is linked to another officer.'; end if;
 -- Canonical officer IDs are Auth IDs throughout GEA One. Never replace a
 -- session or transfer an existing officer record based on an email claim.
 update public.officer_profiles set discord_id=v_discord where id=auth.uid() and access_enabled
 and (discord_id is null or discord_id=v_discord);
 return found;
end $$;
revoke all on function public.bind_officer_discord() from public,anon;
grant execute on function public.bind_officer_discord() to authenticated;

create table if not exists public.discord_jobs (
 id text primary key, kind text not null check(kind in ('interaction','notification')),
 payload jsonb not null, attempts integer not null default 0,
 available_at timestamptz not null default now(), leased_until timestamptz,
 finished_at timestamptz, failed boolean not null default false
);
create table if not exists public.discord_actions (
 id text primary key, result jsonb not null, created_at timestamptz not null default now()
);
create index if not exists discord_jobs_ready on public.discord_jobs(available_at)
 where finished_at is null and not failed;
alter table public.discord_jobs enable row level security;
alter table public.discord_actions enable row level security;
revoke all on public.discord_jobs,public.discord_actions from public,anon,authenticated;
grant all on public.discord_jobs,public.discord_actions to service_role;
create or replace function public.claim_discord_jobs()
returns setof public.discord_jobs language sql security definer set search_path='' as $$
 update public.discord_jobs set leased_until=now()+interval '5 minutes',attempts=attempts+1
 where id in(select id from public.discord_jobs where finished_at is null and not failed and attempts<5
 and available_at<=now() and (leased_until is null or leased_until<now()) order by available_at for update skip locked limit 5)
 returning *;
$$;

-- Fixed allowlist; executes existing RPCs under the linked officer identity.
-- Service-role only: no client may supply another officer's Discord ID.
create or replace function public.discord_action(p_discord_id text,p_action text,p_args jsonb default '{}',p_key text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_result jsonb; v_id uuid; v_task public.gea_peet_tasks; v_status text; begin
 select id into v_actor from public.officer_profiles where discord_id=p_discord_id and access_enabled;
 if v_actor is null then raise exception 'Sign in to GEA One and connect Discord before using this command.'; end if;
 perform set_config('request.jwt.claim.sub',v_actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
 if not public.has_officer_access() then raise exception 'Active officer access required.'; end if;
 if p_key is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_key,0));
  select result into v_result from public.discord_actions where id=p_key;
  if found then return v_result; end if;
 end if;
 case p_action
 when 'me' then select to_jsonb(p) into v_result from public.officer_profiles p where id=v_actor;
 when 'tasks' then select coalesce(jsonb_agg(t),'[]') into v_result from (select id,title from public.tasks where public.is_officer_task_participant(id) and status in ('in_progress','submitted') and cancelled_at is null order by created_at desc limit 25) t;
 when 'events' then select coalesce(jsonb_agg(t),'[]') into v_result from (select id,title from public.officer_events where not cancelled and starts_at>now()-interval '7 days' order by starts_at limit 25) t;
 when 'reviews' then select coalesce(jsonb_agg(t),'[]') into v_result from (select id,title,version from public.gea_peet_tasks where status='pending' and public.gea_peet_can_review(task_id) order by created_at limit 25) t;
 when 'source' then v_result:=public.gea_peet_source_task((p_args->>'id')::uuid);
 when 'assessment' then
  select * into v_task from public.gea_peet_tasks where id=(p_args->>'id')::uuid;
  if not found or not(v_task.student_id=v_actor or public.gea_peet_can_review(v_task.task_id)) then raise exception 'Submission unavailable.'; end if;
  v_result:=to_jsonb(v_task);
 when 'existing' then select to_jsonb(t) into v_result from public.gea_peet_tasks t where task_id=(p_args->>'id')::uuid and student_id=v_actor;
 when 'finalize' then v_result:=to_jsonb(public.finalize_gea_peet_task((p_args->>'id')::uuid,(p_args->>'version')::integer,p_args->'answers'));
 when 'approve' then v_result:=to_jsonb(public.approve_gea_peet_task((p_args->>'id')::uuid,(p_args->>'version')::integer,p_args->'scores',coalesce(p_args->>'reason','')));
 when 'assign' then
  if not public.is_peet_admin() then raise exception 'Reviewer access required.'; end if;
  select id into v_id from public.officer_profiles where discord_id=p_args->>'officer' and access_enabled;
  if v_id is null then raise exception 'The selected officer must connect Discord first.'; end if;
  v_result:=to_jsonb(public.save_officer_task(p_args->>'title',coalesce(p_args->>'description',''),nullif(p_args->>'due','')::date,v_id));
  if nullif(p_args->>'channel','') is not null then
   if p_args->>'channel' !~ '^[0-9]{17,20}$' then raise exception 'Choose a valid Discord channel.'; end if;
   -- The insert trigger has queued this assignment in the same transaction.
   -- An explicitly selected channel overrides only this assignment receipt.
   update public.discord_jobs set payload=payload||jsonb_build_object('channel_id',p_args->>'channel')
    where kind='notification' and payload->>'task_id'=v_result#>>'{}' and finished_at is null;
  end if;
 when 'absence' then
  if not exists(select 1 from public.officer_events where id=(p_args->>'event')::uuid and starts_at>now() and not cancelled) then raise exception 'Choose an upcoming event.'; end if;
  insert into public.officer_attendance(event_id,officer_id,absence_notice,notice_at)
  values((p_args->>'event')::uuid,v_actor,p_args->>'notice',now()) on conflict(event_id,officer_id)
  do update set absence_notice=excluded.absence_notice,notice_at=coalesce(public.officer_attendance.notice_at,now()),updated_at=now();
 when 'attendance' then
  select id into v_id from public.officer_profiles where discord_id=p_args->>'officer' and access_enabled;
  if v_id is null then raise exception 'Officer must connect Discord first.'; end if;
  if public.is_peet_admin() then
   perform public.record_officer_attendance((p_args->>'event')::uuid,v_id,p_args->>'status',coalesce(p_args->>'notes',''));
  elsif public.can_manage_meetings() then
   if nullif(btrim(p_args->>'notes'),'') is not null then raise exception 'Private reviewer notes require reviewer access.'; end if;
   select status into v_status from public.officer_attendance where event_id=(p_args->>'event')::uuid and officer_id=v_id;
   perform public.save_meeting_attendance((p_args->>'event')::uuid,jsonb_build_array(jsonb_build_object(
    'officer_id',v_id,'status',p_args->>'status','original_status',coalesce(v_status,'unmarked'))));
  else raise exception 'Secretary or reviewer access is required.';
  end if;
 when 'revision','reject' then
  select * into v_task from public.gea_peet_tasks where id=(p_args->>'id')::uuid for update;
  if not found or not public.gea_peet_can_review(v_task.task_id) or v_task.status<>'pending' or v_task.version<>(p_args->>'version')::integer then raise exception 'Review changed or access denied.'; end if;
  if length(btrim(coalesce(p_args->>'feedback',''))) not between 10 and 2000 then raise exception 'Provide 10–2000 characters of feedback.'; end if;
  -- Rejection awards no score and retains evidence. Officer can revise.
  update public.gea_peet_tasks set status='clarification',assessment=jsonb_build_object('needsMoreInfo',true,'studentQuestions',jsonb_build_array(p_args->>'feedback'),'initialAssessmentSummary',p_action||' requested by reviewer'),answers='[]',recommendation=null,reviewer_assessment=null,reviewer_answers='[]',questions_by=null,reviewed_by=null,version=version+1 where id=v_task.id returning to_jsonb(gea_peet_tasks.*) into v_result;
 when 'score' then
  select jsonb_build_object('tasks',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('officer_task_members',(select coalesce(jsonb_agg(m),'[]') from public.officer_task_members m where m.task_id=t.id))) from public.tasks t where public.is_officer_task_participant(t.id)),'[]'),
  'evaluations',coalesce((select jsonb_agg(e) from public.peet_evaluations e where public.is_officer_task_participant(e.task_id) and (e.officer_id is null or e.officer_id=v_actor)),'[]'),
  'strikes',coalesce((select jsonb_agg(s) from public.officer_strikes s where officer_id=v_actor),'[]')) into v_result;
 else raise exception 'Unsupported Discord action.';
 end case;
 v_result:=coalesce(v_result,'null'::jsonb);
 if p_key is not null then insert into public.discord_actions(id,result) values(p_key,v_result); end if;
 return v_result;
end $$;

-- Outbox captures website AND Discord changes; no network calls in transactions.
create or replace function public.enqueue_discord_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_topic text; v_title text; v_description text; v_count integer;
 v_extra jsonb:='{}'; v_name text; v_position text; v_event text; begin
 if tg_table_name='tasks' then
  if tg_op='UPDATE' and new.status=old.status and new.assigned_to=old.assigned_to then return new; end if;
  v_topic:='tasks'; v_title:='Task: '||new.title||' · '||new.status;
  v_description:='Due: '||coalesce(new.due_date::text,'Not set');
  select name,position into v_name,v_position from public.officer_profiles where id=new.assigned_to;
  v_extra:=jsonb_build_object('task_id',new.id,'assignee_name',v_name,'assignee_position',v_position);
 elsif tg_table_name='officer_attendance' then
  if tg_op='UPDATE' and new.status=old.status and new.absence_notice=old.absence_notice then return new; end if;
  v_topic:='attendance'; v_title:='Attendance record updated';
  select e.title||E'\n'||p.name||' · '||new.status into v_description
   from public.officer_events e,public.officer_profiles p where e.id=new.event_id and p.id=new.officer_id;
  -- Position-channel receipts and the optional secretary/reviewer overview
  -- have separate jobs. Network delivery never blocks the attendance save.
  if (tg_op='INSERT' and new.status<>'unmarked') or (tg_op='UPDATE' and new.status is distinct from old.status) then
   select name,position into v_name,v_position from public.officer_profiles where id=new.officer_id and access_enabled;
   select title into v_event from public.officer_events where id=new.event_id;
   if nullif(btrim(v_position),'') is not null then
    insert into public.discord_jobs(id,kind,payload) values(gen_random_uuid()::text,'notification',
     jsonb_build_object('topic','attendance_receipt','officer_name',v_name,'officer_position',v_position,'event_title',v_event,
      'event_id',new.event_id,'status',new.status));
   end if;
  end if;
 else
  v_topic:='announcements'; v_title:='PEET evaluation recorded';
  if tg_op='INSERT' then
   select count(*) into v_count from public.peet_evaluations;
   if v_count in (1,10,25,50,100,250,500,1000) then
    insert into public.discord_actions(id,result) values('evaluation-milestone:'||v_count,'{}') on conflict do nothing;
    if found then
     insert into public.discord_jobs(id,kind,payload) values(gen_random_uuid()::text,'notification',jsonb_build_object('topic','announcements','title','GEA One milestone','description',v_count||' task contributions evaluated across the academy.'));
    end if;
   end if;
  end if;
 end if;
 insert into public.discord_jobs(id,kind,payload) values(gen_random_uuid()::text,'notification',jsonb_build_object('topic',v_topic,'title',v_title,'description',v_description)||v_extra);
 return new;
end $$;
drop trigger if exists discord_task_notification on public.tasks;
create trigger discord_task_notification after insert or update on public.tasks for each row execute function public.enqueue_discord_notification();
drop trigger if exists discord_attendance_notification on public.officer_attendance;
create trigger discord_attendance_notification after insert or update on public.officer_attendance for each row execute function public.enqueue_discord_notification();
drop trigger if exists discord_evaluation_notification on public.peet_evaluations;
create trigger discord_evaluation_notification after insert or update on public.peet_evaluations for each row execute function public.enqueue_discord_notification();
revoke all on function public.discord_action(text,text,jsonb,text),public.claim_discord_jobs(),public.enqueue_discord_notification() from public,anon,authenticated;
grant execute on function public.discord_action(text,text,jsonb,text),public.claim_discord_jobs() to service_role;
commit;

-- Personal evidence is committed before requesting AI clarification.
begin;
create table if not exists public.discord_submission_drafts (
 task_id uuid references public.tasks(id) on delete cascade,
 officer_id uuid references public.officer_profiles(id) on delete cascade,
 notes text not null check(length(notes) between 1 and 2000),
 project_url text not null check(length(project_url)<=2048),
 updated_at timestamptz not null default now(), primary key(task_id,officer_id)
);
alter table public.discord_submission_drafts enable row level security;
revoke all on public.discord_submission_drafts from public,anon,authenticated;
grant all on public.discord_submission_drafts to service_role;
create or replace function public.save_discord_submission(p_discord_id text,p_task_id uuid,p_notes text,p_url text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_source public.tasks; begin
 select id into v_actor from public.officer_profiles where discord_id=p_discord_id and access_enabled;
 if v_actor is null then raise exception 'Connect Discord first.'; end if;
 perform set_config('request.jwt.claim.sub',v_actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
 if not public.has_officer_access() or not public.is_officer_task_participant(p_task_id) then raise exception 'Submit your own task only.'; end if;
 select * into v_source from public.tasks where id=p_task_id for update;
 if not found or v_source.cancelled_at is not null or v_source.status not in ('in_progress','submitted') then raise exception 'Task unavailable.'; end if;
 if p_notes is null or length(btrim(p_notes)) not between 1 and 2000 or p_url is null or length(p_url)>2048 or p_url !~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$' then raise exception 'Provide work notes and a valid link.'; end if;
 insert into public.discord_submission_drafts(task_id,officer_id,notes,project_url) values(p_task_id,v_actor,p_notes,p_url)
 on conflict(task_id,officer_id) do update set notes=excluded.notes,project_url=excluded.project_url,updated_at=now();
 if v_source.status='in_progress' then perform public.submit_officer_task(p_task_id,p_url,p_notes); end if;
end $$;
revoke all on function public.save_discord_submission(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.save_discord_submission(text,uuid,text,text) to service_role;
commit;
