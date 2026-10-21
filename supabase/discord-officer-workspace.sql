-- Run after discord.sql, discord-draft-recovery.sql, officer-shared-tasks.sql,
-- officer-individual-contributions.sql, officer-event-service.sql,
-- gea-operations.sql, meeting-document-links.sql, event-planning-document.sql,
-- and event-participant-assignments.sql. Safe to rerun.
begin;
create table if not exists public.discord_officer_sessions (
 id uuid primary key default gen_random_uuid(), officer_id uuid not null references public.officer_profiles(id) on delete cascade,
 state jsonb not null, version integer not null default 1,
 expires_at timestamptz not null default now()+interval '1 hour'
);
alter table public.discord_officer_sessions enable row level security;
revoke all on public.discord_officer_sessions from public,anon,authenticated;
grant all on public.discord_officer_sessions to service_role;
alter table public.discord_submission_drafts drop constraint if exists discord_submission_drafts_notes_check;
alter table public.discord_submission_drafts add constraint discord_submission_drafts_notes_check check(length(notes) between 1 and 5000);
alter table public.discord_submission_drafts add column if not exists deliverable_description text not null default '' check(length(deliverable_description)<=5000);

create or replace function public.save_discord_contribution(p_discord_id text,p_task_id uuid,p_notes text,p_url text,p_deliverable text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid; t public.tasks; begin
 select id into v_actor from public.officer_profiles where discord_id=p_discord_id and access_enabled;
 if v_actor is null then raise exception 'Connect your active officer account first.'; end if;
 perform set_config('request.jwt.claim.sub',v_actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
 select * into t from public.tasks where id=p_task_id for update;
 if not found or not public.is_officer_task_participant(t.id) or t.cancelled_at is not null or t.status not in ('in_progress','submitted') then raise exception 'Choose your own open task.'; end if;
 p_url:=btrim(coalesce(p_url,'')); p_deliverable:=btrim(coalesce(p_deliverable,''));
 if length(btrim(coalesce(p_notes,''))) not between 1 and 5000 then raise exception 'Describe your personal contribution in 1–5000 characters.'; end if;
 if length(p_url)>2048 or (p_url<>'' and p_url !~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$') then raise exception 'Use an HTTP(S) link or leave it blank.'; end if;
 if length(p_deliverable)>5000 then raise exception 'Keep the team deliverable within 5000 characters.'; end if;
 if t.individual_peet and t.status='in_progress' and p_deliverable='' then raise exception 'Describe the shared team deliverable separately from your own contribution.'; end if;
 insert into public.discord_submission_drafts(task_id,officer_id,notes,project_url,deliverable_description)
 values(t.id,v_actor,p_notes,p_url,p_deliverable) on conflict(task_id,officer_id) do update
 set notes=excluded.notes,project_url=excluded.project_url,deliverable_description=excluded.deliverable_description,updated_at=now();
 if t.status='in_progress' then perform public.submit_officer_task(t.id,p_url,case when t.individual_peet then p_deliverable else p_notes end); end if;
end $$;

-- Every action uses the linked actor and the website's existing permissioned
-- RPCs. No caller-supplied officer identity or arbitrary RPC names are accepted.
create or replace function public.discord_officer_action(p_discord_id text,p_action text,p_args jsonb default '{}',p_key text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; result jsonb; t public.tasks; e public.officer_events; l public.officer_volunteer_logs;
 agenda_record public.gea_agenda_items; plan public.gea_event_plans; signup public.officer_event_signups; checklist public.gea_event_checklist; cancellation public.officer_task_cancellation_requests;
 s public.discord_officer_sessions; people uuid[]; selected uuid[]; page integer:=greatest(0,least(1000,coalesce((p_args->>'page')::integer,0)));
 custom text; rows jsonb; v_id uuid; kind text; begin
 select p.id into actor from public.officer_profiles p where p.discord_id=p_discord_id and p.access_enabled;
 if actor is null then raise exception 'Sign in to GEA One and connect Discord first.'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 if not public.has_officer_access() then raise exception 'Active officer access required.'; end if;
 if p_key is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_key,0));
  select a.result into result from public.discord_actions a where a.id=p_key;
  if found then return result; end if;
 end if;
 case p_action
 when 'events' then
  select coalesce(jsonb_agg(x),'[]') into rows from (select ev.id,ev.title,ev.kind,ev.starts_at from public.officer_events ev
   where not ev.cancelled and (coalesce(p_args->>'kind','all')='all' or ev.kind<>'meeting')
   order by abs(extract(epoch from ev.starts_at-now())),ev.id offset page*25 limit 26) x;
  result:=jsonb_build_object('rows',rows,'page',page);
 when 'event' then
  select * into e from public.officer_events where officer_events.id=(p_args->>'id')::uuid;
  if not found then raise exception 'Event unavailable.'; end if;
  result:=jsonb_build_object('id',e.id,'title',e.title,'kind',e.kind,'starts_at',e.starts_at,'ends_at',e.ends_at,'location',e.location,'cancelled',e.cancelled,
   'signup',(select to_jsonb(x) from public.officer_event_signups x where x.event_id=e.id and x.officer_id=actor),
   'attendance',(select to_jsonb(x) from public.officer_attendance x where x.event_id=e.id and x.officer_id=actor),
   'log',(select to_jsonb(x) from public.officer_volunteer_logs x where x.event_id=e.id and x.officer_id=actor),
   'documents',(select to_jsonb(x) from public.gea_meeting_notes x where x.event_id=e.id),
   'agenda',coalesce((select jsonb_agg(x) from public.gea_agenda_items x where x.event_id=e.id),'[]'),'can_meetings',public.can_manage_meetings(),
   'plan',(select to_jsonb(x) from public.gea_event_plans x where x.event_id=e.id),
   'can_plan',public.is_peet_admin() or exists(select 1 from public.gea_event_plans x where x.event_id=e.id and x.organizer_id=actor));
  if e.kind='meeting' and public.can_manage_meetings() then
   insert into public.discord_form_drafts(discord_id,custom_id,fields,interaction_id) values(p_discord_id,'officer:form:documents:'||e.id||':'||coalesce(result->'documents'->>'version','0'),
    jsonb_build_object('agenda_url',coalesce(result->'documents'->>'agenda_doc_url',''),'notes_url',coalesce(result->'documents'->>'notes_doc_url','')),0) on conflict do nothing;
  elsif e.kind<>'meeting' and (result->>'can_plan')::boolean then
   insert into public.discord_form_drafts(discord_id,custom_id,fields,interaction_id) values(p_discord_id,'officer:form:plan:'||e.id||':'||coalesce(result->'plan'->>'version','0'),
    jsonb_build_object('document_url',coalesce(result->'plan'->>'planning_doc_url','')),0) on conflict do nothing;
  end if;
 when 'signup' then perform public.set_officer_event_signup((p_args->>'id')::uuid,(p_args->>'committed')::boolean);
 when 'absence' then perform public.notify_officer_absence((p_args->>'id')::uuid,p_args->>'notice');
 when 'prepare_hours' then
  select * into e from public.officer_events where officer_events.id=(p_args->>'id')::uuid and officer_events.kind<>'meeting' and not cancelled;
  if not found then raise exception 'Choose an active service event.'; end if;
  select * into l from public.officer_volunteer_logs where officer_volunteer_logs.event_id=e.id and officer_id=actor;
  custom:='officer:form:hours:'||e.id;
  insert into public.discord_form_drafts(discord_id,custom_id,fields,interaction_id)
   values(p_discord_id,custom,jsonb_build_object('check_in',coalesce(l.check_in,e.starts_at),'check_out',coalesce(l.check_out,e.ends_at),'notes',coalesce(l.notes,'')),0)
   on conflict(discord_id,custom_id) do nothing;
  result:=jsonb_build_object('custom_id',custom,'title',e.title);
 when 'log_hours' then
  if p_args->>'check_in' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' or p_args->>'check_out' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Keep the timezone on each time, for example 2026-10-21T17:00:00-07:00.'; end if;
  perform public.submit_officer_volunteer((p_args->>'id')::uuid,(p_args->>'check_in')::timestamptz,(p_args->>'check_out')::timestamptz,coalesce(p_args->>'notes',''),actor);
 when 'hours' then
  select jsonb_build_object('verified_minutes',coalesce(sum(x.minutes) filter(where x.status='approved'),0),
   'pending_minutes',coalesce(sum(x.minutes) filter(where x.status='pending'),0),
   'verified_events',count(*) filter(where x.status='approved')) into result
   from public.officer_volunteer_logs x join public.officer_events ev on ev.id=x.event_id where x.officer_id=actor and ev.academic_year=p_args->>'year';
 when 'records' then
  kind:=p_args->>'kind';
  if kind='attendance' then select coalesce(jsonb_agg(x),'[]') into rows from (select a.id,ev.title,a.status,a.absence_notice as notes,a.reviewer_notes as feedback,ev.starts_at as date from public.officer_attendance a join public.officer_events ev on ev.id=a.event_id where a.officer_id=actor order by ev.starts_at desc,a.id offset page*10 limit 11) x;
  elsif kind='service' then select coalesce(jsonb_agg(x),'[]') into rows from (select a.id,ev.title,a.status,a.notes,a.review_notes as feedback,a.check_in as date,a.minutes from public.officer_volunteer_logs a join public.officer_events ev on ev.id=a.event_id where a.officer_id=actor order by a.check_in desc,a.id offset page*10 limit 11) x;
  elsif kind='conduct' then select coalesce(jsonb_agg(x),'[]') into rows from (select a.id,a.category as title,a.status,a.reason as notes,a.decision_notes as feedback,a.incident_date as date from public.officer_strikes a where a.officer_id=actor order by a.incident_date desc,a.id offset page*10 limit 11) x;
  else raise exception 'Choose attendance, service, or conduct records.'; end if;
  result:=jsonb_build_object('rows',rows,'page',page,'notes',case when kind='conduct' then (select coalesce(jsonb_agg(x),'[]') from public.officer_accountability_notes x where x.officer_id=actor) else '[]'::jsonb end,
   'reviews',case when kind='conduct' then (select coalesce(jsonb_agg(x),'[]') from public.officer_removal_reviews x where x.officer_id=actor) else '[]'::jsonb end);
 when 'record' then
  kind:=p_args->>'kind';
  if kind='attendance' then select to_jsonb(x) into result from public.officer_attendance x where x.id=(p_args->>'id')::uuid and x.officer_id=actor;
  elsif kind='service' then select to_jsonb(x) into result from public.officer_volunteer_logs x where x.id=(p_args->>'id')::uuid and x.officer_id=actor;
  elsif kind='conduct' then select to_jsonb(x) into result from public.officer_strikes x where x.id=(p_args->>'id')::uuid and x.officer_id=actor;
  elsif kind='note' then select to_jsonb(x) into result from public.officer_accountability_notes x where x.academic_year=p_args->>'id' and x.officer_id=actor;
  elsif kind='review' then select to_jsonb(x) into result from public.officer_removal_reviews x where x.id=(p_args->>'id')::uuid and x.officer_id=actor;
  elsif kind='contribution' then select to_jsonb(x) into result from public.gea_peet_tasks x where x.id=(p_args->>'id')::uuid and x.student_id=actor;
  elsif kind='agenda' then select to_jsonb(x)||jsonb_build_object('can_assign',public.can_manage_meetings()) into result from public.gea_agenda_items x where x.id=(p_args->>'id')::uuid;
  elsif kind='task' then result:=public.gea_peet_source_task((p_args->>'id')::uuid);
  elsif kind='meeting' then select to_jsonb(x) into result from public.gea_meeting_notes x where x.event_id=(p_args->>'id')::uuid;
  elsif kind='cancellation' then select to_jsonb(x) into result from public.officer_task_cancellation_requests x where x.id=(p_args->>'id')::uuid and (x.requested_by=actor or public.is_peet_admin());
  elsif kind='help' then select to_jsonb(x) into result from public.gea_task_blockers x where x.id=(p_args->>'id')::uuid and (x.officer_id=actor or x.helper_id=actor or public.is_peet_admin());
  end if;
  if result is null then raise exception 'Record unavailable.'; end if;
 when 'tasks' then
  select coalesce(jsonb_agg(x),'[]') into rows from (select a.id,a.title,a.status,a.individual_peet,a.cancelled_at from public.tasks a where public.is_officer_task_participant(a.id) order by a.created_at desc,a.id offset page*25 limit 26) x;
  result:=jsonb_build_object('rows',rows,'page',page);
 when 'task' then
  result:=public.gea_peet_source_task((p_args->>'id')::uuid);
  select * into t from public.tasks where tasks.id=(p_args->>'id')::uuid;
  result:=result||jsonb_build_object('participant',public.is_officer_task_participant(t.id),'can_edit',t.created_by=actor and t.assigned_to=actor and t.status='in_progress' and t.cancelled_at is null,
   'people',(select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'position',p.position)) from public.officer_profiles p where p.id=any(array[t.assigned_to]||array(select m.officer_id from public.officer_task_members m where m.task_id=t.id))),
   'blocker',(select to_jsonb(x) from public.gea_task_blockers x where x.task_id=t.id),
   'contribution',(select to_jsonb(x) from public.gea_peet_tasks x where x.task_id=t.id and x.student_id=actor));
 when 'helpers' then
  select coalesce(jsonb_agg(x),'[]') into rows from (select p.id,p.name as title,p.position from public.officer_profiles p where p.access_enabled order by p.name,p.id offset page*25 limit 26) x;
  result:=jsonb_build_object('rows',rows,'page',page);
 when 'task_help' then perform public.save_task_blocker((p_args->>'id')::uuid,p_args->>'reason',nullif(p_args->>'helper','')::uuid,(p_args->>'resolved')::boolean);
 when 'task_cancel' then perform public.request_officer_task_cancellation((p_args->>'id')::uuid,p_args->>'reason');
 when 'task_requests' then
  if not public.is_peet_admin() then raise exception 'Reviewer access required.'; end if;
  select coalesce(jsonb_agg(x),'[]') into rows from (select * from (
   select 'cancellation|'||r.id as id,'Cancellation · '||task.title as title,r.created_at as date from public.officer_task_cancellation_requests r join public.tasks task on task.id=r.task_id where r.status='pending'
   union all select 'help|'||r.id,'Help · '||task.title,r.updated_at from public.gea_task_blockers r join public.tasks task on task.id=r.task_id where r.resolved_at is null
  ) requests order by date,id offset page*25 limit 26) x;
  result:=jsonb_build_object('rows',rows,'page',page);
 when 'task_request' then
  if not public.is_peet_admin() then raise exception 'Reviewer access required.'; end if;
  if p_args->>'kind'='cancellation' then select to_jsonb(r)||jsonb_build_object('title',task.title,'version',md5(to_jsonb(r)::text)) into result from public.officer_task_cancellation_requests r join public.tasks task on task.id=r.task_id where r.id=(p_args->>'id')::uuid;
  elsif p_args->>'kind'='help' then select to_jsonb(r)||jsonb_build_object('title',task.title) into result from public.gea_task_blockers r join public.tasks task on task.id=r.task_id where r.id=(p_args->>'id')::uuid; end if;
  if result is null then raise exception 'Task request unavailable.'; end if;
 when 'review_cancellation' then
  if not public.is_peet_admin() then raise exception 'Reviewer access required.'; end if;
  select * into cancellation from public.officer_task_cancellation_requests where officer_task_cancellation_requests.id=(p_args->>'id')::uuid for update;
  if not found or md5(to_jsonb(cancellation)::text) is distinct from p_args->>'version' then raise exception 'Cancellation request changed. Reopen /task-requests.'; end if;
  perform public.review_officer_task_cancellation(cancellation.id,p_args->>'status',p_args->>'notes');
 when 'team_drafts' then
  select coalesce(jsonb_agg(x),'[]') into rows from (select d.id,coalesce(nullif(f.fields->>'title',''),'Unfinished task draft') as title from public.discord_officer_sessions d
   left join public.discord_form_drafts f on f.discord_id=p_discord_id and f.custom_id='officer:form:team:'||d.id
   where d.officer_id=actor order by d.expires_at desc,d.id offset page*25 limit 26) x;
  result:=jsonb_build_object('rows',rows,'page',page);
 when 'team_start','team_open','team_select','team_page','team_save' then
  if p_action='team_start' then
   people:=case when public.is_task_officer(actor) then array[actor] else '{}'::uuid[] end;
   if nullif(p_args->>'agenda','') is not null then
    if not public.can_manage_meetings() then raise exception 'Secretary or reviewer access required.'; end if;
    select * into agenda_record from public.gea_agenda_items where gea_agenda_items.id=(p_args->>'agenda')::uuid and task_id is null;
    if not found then raise exception 'Agenda action is unavailable or already assigned.'; end if;
    people:='{}'::uuid[];
   end if;
   if nullif(p_args->>'task','') is not null then
    select * into t from public.tasks where tasks.id=(p_args->>'task')::uuid;
    if not found or t.created_by<>actor or t.assigned_to<>actor or t.status<>'in_progress' or t.cancelled_at is not null then raise exception 'Only the creator can edit their own open task.'; end if;
    people:=array[t.assigned_to]||array(select m.officer_id from public.officer_task_members m where m.task_id=t.id);
   end if;
   insert into public.discord_officer_sessions(officer_id,state) values(actor,jsonb_build_object('people',people,'page',0,'task',t.id,'agenda',agenda_record.id)) returning * into s;
   insert into public.discord_form_drafts(discord_id,custom_id,fields,interaction_id) values(p_discord_id,'officer:form:team:'||s.id,
    jsonb_build_object('title',coalesce(t.title,agenda_record.title,''),'description',left(coalesce(t.description,agenda_record.details,''),4000),
     'description2',substring(coalesce(t.description,agenda_record.details,'') from 4001 for 4000),'description3',substring(coalesce(t.description,agenda_record.details,'') from 8001 for 2000),'due',coalesce(t.due_date::text,'')),0) on conflict do nothing;
  else
   select * into s from public.discord_officer_sessions where discord_officer_sessions.id=(p_args->>'session')::uuid and officer_id=actor for update;
   if not found then raise exception 'Team draft unavailable. Open /officer to resume an existing draft.'; end if;
   -- Expiration never discards written work. Reauthenticate the owner and
   -- renew the UI lease; canonical save RPCs recheck every participant/role.
   if s.expires_at<now() then update public.discord_officer_sessions set expires_at=now()+interval '1 hour' where discord_officer_sessions.id=s.id returning * into s; end if;
   if p_action in ('team_select','team_page') and s.version is distinct from (p_args->>'version')::integer then raise exception 'Team selection changed. Use the newest team controls.'; end if;
   if p_action='team_select' then
    if jsonb_typeof(p_args->'selected') is distinct from 'array' then raise exception 'Select officers from the roster.'; end if;
    select coalesce(array_agg(value::uuid),'{}') into selected from jsonb_array_elements_text(p_args->'selected');
    if cardinality(selected)>25 or exists(select 1 from unnest(selected) p where not public.is_task_officer(p)) then raise exception 'Choose active officers from this page.'; end if;
    select coalesce(array_agg(value::uuid),'{}') into people from jsonb_array_elements_text(s.state->'people') where value::uuid not in(select p.id from public.officer_profiles p where public.is_task_officer(p.id) order by p.name,p.id offset coalesce((s.state->>'page')::integer,0)*25 limit 25);
    select array_agg(distinct p) into people from unnest(people||selected||case when public.is_peet_admin() or nullif(s.state->>'agenda','') is not null then '{}'::uuid[] else array[actor] end) p;
    if cardinality(people)>100 then raise exception 'Select at most 100 participants.'; end if;
    s.state:=s.state||jsonb_build_object('people',coalesce(people,'{}'::uuid[]));
   elsif p_action='team_page' then s.state:=s.state||jsonb_build_object('page',page);
   elsif p_action='team_save' then
    p_args:=p_args||jsonb_build_object('description',coalesce(p_args->>'description','')||coalesce(p_args->>'description2','')||coalesce(p_args->>'description3',''),'due',btrim(coalesce(p_args->>'due','')));
    select array_agg(value::uuid) into people from jsonb_array_elements_text(s.state->'people');
    if coalesce(cardinality(people),0)=0 then raise exception 'Select at least one officer.'; end if;
    if nullif(s.state->>'agenda','') is not null then
     if cardinality(people)<>1 then raise exception 'Choose one officer for this agenda action.'; end if;
     v_id:=public.assign_agenda_action((s.state->>'agenda')::uuid,people[1],nullif(p_args->>'due','')::date);
    elsif nullif(s.state->>'task','') is not null or not public.is_peet_admin() then
     v_id:=public.save_officer_shared_task(p_args->>'title',coalesce(p_args->>'description',''),nullif(p_args->>'due','')::date,people,nullif(s.state->>'task','')::uuid);
    elsif cardinality(people)=1 then v_id:=public.save_officer_task(p_args->>'title',coalesce(p_args->>'description',''),nullif(p_args->>'due','')::date,people[1]);
    else v_id:=public.assign_officer_collaboration(p_args->>'title',coalesce(p_args->>'description',''),nullif(p_args->>'due','')::date,people); end if;
    delete from public.discord_officer_sessions where discord_officer_sessions.id=s.id;
    result:=jsonb_build_object('id',v_id);
    if p_key is not null then insert into public.discord_actions(id,result) values(p_key,result); end if;
    return result;
   end if;
   if p_action in ('team_select','team_page') then update public.discord_officer_sessions set state=s.state,version=version+1 where discord_officer_sessions.id=s.id returning * into s; end if;
  end if;
  select coalesce(jsonb_agg(x),'[]') into rows from (select p.id,p.name,p.position from public.officer_profiles p where public.is_task_officer(p.id) order by p.name,p.id offset coalesce((s.state->>'page')::integer,0)*25 limit 26) x;
  result:=to_jsonb(s)||jsonb_build_object('rows',rows);
 when 'agenda' then perform public.add_meeting_agenda((p_args->>'id')::uuid,p_args->>'title',coalesce(p_args->>'details',''));
 when 'documents' then perform public.save_meeting_documents((p_args->>'id')::uuid,p_args->>'agenda_url',p_args->>'notes_url',(p_args->>'version')::integer);
 when 'agenda_items' then
  select coalesce(jsonb_agg(x),'[]') into rows from (select a.id,a.title,a.details,a.task_id,public.can_manage_meetings() as can_assign from public.gea_agenda_items a where a.event_id=(p_args->>'id')::uuid order by a.created_at,a.id offset page*25 limit 26) x;
  result:=jsonb_build_object('rows',rows,'page',page);
 when 'plan' then
  select * into plan from public.gea_event_plans where gea_event_plans.event_id=(p_args->>'id')::uuid;
  perform public.save_event_planning_document((p_args->>'id')::uuid,plan.organizer_id,p_args->>'document_url',(p_args->>'version')::integer);
 when 'checklist' then
  select coalesce(jsonb_agg(x),'[]') into rows from (select c.id,c.title,c.done,c.event_id from public.gea_event_checklist c where c.event_id=(p_args->>'id')::uuid order by c.updated_at,c.id offset page*25 limit 26) x;
  result:=jsonb_build_object('rows',rows,'page',page);
 when 'checklist_item' then
  select to_jsonb(x) into result from public.gea_event_checklist x where x.id=(p_args->>'id')::uuid;
  if result is null then raise exception 'Checklist item unavailable.'; end if;
 when 'checklist_add' then perform public.save_event_checklist((p_args->>'id')::uuid,p_args->>'title',false,null);
 when 'checklist_toggle' then
  select * into checklist from public.gea_event_checklist where gea_event_checklist.id=(p_args->>'id')::uuid;
  if not found then raise exception 'Checklist item unavailable.'; end if;
  perform public.save_event_checklist(checklist.event_id,checklist.title,(p_args->>'done')::boolean,checklist.id);
 when 'event_requests' then
  if not public.is_peet_admin() then raise exception 'Reviewer access required.'; end if;
  select coalesce(jsonb_agg(x),'[]') into rows from (select r.id,p.name||' · '||ev.title as title from public.officer_event_signups r join public.officer_profiles p on p.id=r.officer_id join public.officer_events ev on ev.id=r.event_id where r.committed and not r.assigned and not ev.cancelled order by r.created_at,r.id offset page*25 limit 26) x;
  result:=jsonb_build_object('rows',rows,'page',page);
 when 'event_request','assign_request' then
  if not public.is_peet_admin() then raise exception 'Reviewer access required.'; end if;
  select * into signup from public.officer_event_signups where officer_event_signups.id=(p_args->>'id')::uuid for update;
  if not found or not signup.committed then raise exception 'This participation request was withdrawn.'; end if;
  if p_action='assign_request' then perform public.save_officer_event_assignment(signup.event_id,signup.officer_id,true,signup.participation_role,signup.participation_notes,(p_args->>'version')::integer); end if;
  result:=to_jsonb(signup)||jsonb_build_object('officer',(select p.name from public.officer_profiles p where p.id=signup.officer_id),'event',(select ev.title from public.officer_events ev where ev.id=signup.event_id));
 when 'review_logs' then
  if not public.is_peet_admin() then raise exception 'Reviewer access required.'; end if;
  select coalesce(jsonb_agg(x),'[]') into rows from (select a.id,p.name||' · '||ev.title as title,a.minutes from public.officer_volunteer_logs a join public.officer_profiles p on p.id=a.officer_id join public.officer_events ev on ev.id=a.event_id where a.status='pending' order by a.created_at,a.id offset page*25 limit 26) x;
  result:=jsonb_build_object('rows',rows,'page',page);
 when 'review_log','verify_hours','return_hours' then
  if not public.is_peet_admin() then raise exception 'Reviewer access required.'; end if;
  select * into l from public.officer_volunteer_logs where officer_volunteer_logs.id=(p_args->>'id')::uuid for update;
  if not found or l.status<>'pending' then raise exception 'This service log is no longer pending.'; end if;
  if p_action<>'review_log' then
   if md5(to_jsonb(l)::text) is distinct from p_args->>'version' then raise exception 'Service details changed. Reopen /verify-hours before deciding.'; end if;
   perform public.review_officer_volunteer(l.id,case when p_action='verify_hours' then 'approved' else 'rejected' end,coalesce(p_args->>'notes',''));
  end if;
  result:=to_jsonb(l)||jsonb_build_object('version',md5(to_jsonb(l)::text),'officer',(select p.name from public.officer_profiles p where p.id=l.officer_id),'event',(select ev.title from public.officer_events ev where ev.id=l.event_id));
 when 'digest' then perform public.set_gea_digest((p_args->>'enabled')::boolean);
 else raise exception 'Unsupported officer action.';
 end case;
 result:=coalesce(result,'{}'::jsonb);
 if p_key is not null then insert into public.discord_actions(id,result) values(p_key,result); end if;
 return result;
end $$;

-- Service receipts derive minutes exclusively from reviewed canonical logs.
create or replace function public.enqueue_discord_service_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare person public.officer_profiles; title text; begin
 if tg_op='UPDATE' and new.status=old.status and new.minutes=old.minutes then return new; end if;
 select * into person from public.officer_profiles where id=new.officer_id and access_enabled;
 select e.title into title from public.officer_events e where e.id=new.event_id;
 if new.status='approved' or (tg_op='UPDATE' and old.status='approved') then
  insert into public.discord_jobs(id,kind,payload) values(gen_random_uuid()::text,'notification',jsonb_build_object('topic','service_receipt','officer_name',person.name,'officer_position',person.position,'event_title',title,'minutes',new.minutes,'status',new.status));
 end if;
 if new.status='pending' then
  insert into public.discord_jobs(id,kind,payload) values(gen_random_uuid()::text,'notification',jsonb_build_object('topic','service_review','log_id',new.id,'title','Service hours awaiting verification','description',person.name||' · '||title||' · '||new.minutes||' minutes'));
 end if;
 return new;
end $$;
drop trigger if exists discord_service_notification on public.officer_volunteer_logs;
create trigger discord_service_notification after insert or update on public.officer_volunteer_logs for each row execute function public.enqueue_discord_service_notification();

create or replace function public.enqueue_discord_shared_task_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare t public.tasks; p public.officer_profiles; begin
 if tg_table_name='officer_task_members' then
  select * into t from public.tasks where id=new.task_id;
  for p in select * from public.officer_profiles where id=new.officer_id and access_enabled loop
   insert into public.discord_jobs(id,kind,payload) values(gen_random_uuid()::text,'notification',jsonb_build_object('topic','tasks','title','Shared task: '||t.title,'description','You are a participant. Submit your own reflection and receive your own PEET evaluation.','task_id',t.id,'assignee_name',p.name,'assignee_position',p.position));
  end loop;
 elsif new.status is distinct from old.status or new.assigned_to is distinct from old.assigned_to then
  for p in select op.* from public.officer_task_members m join public.officer_profiles op on op.id=m.officer_id where m.task_id=new.id and m.officer_id<>new.assigned_to and op.access_enabled loop
   insert into public.discord_jobs(id,kind,payload) values(gen_random_uuid()::text,'notification',jsonb_build_object('topic','tasks','title','Shared task: '||new.title||' · '||new.status,'description','Your personal reflection and evaluation are separate from your teammates.','task_id',new.id,'assignee_name',p.name,'assignee_position',p.position));
  end loop;
 end if;
 return new;
end $$;
drop trigger if exists discord_shared_member_notification on public.officer_task_members;
create trigger discord_shared_member_notification after insert on public.officer_task_members for each row execute function public.enqueue_discord_shared_task_notification();
drop trigger if exists discord_shared_status_notification on public.tasks;
create trigger discord_shared_status_notification after update on public.tasks for each row execute function public.enqueue_discord_shared_task_notification();
create or replace function public.enqueue_discord_participation_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare p public.officer_profiles; title text; begin
 select * into p from public.officer_profiles where id=new.officer_id and access_enabled;
 select e.title into title from public.officer_events e where e.id=new.event_id;
 if (tg_op='INSERT' and new.committed) or (tg_op='UPDATE' and new.committed is distinct from old.committed) then
  insert into public.discord_jobs(id,kind,payload) values(gen_random_uuid()::text,'notification',jsonb_build_object('topic','event_request','request_id',new.id,
   'title',case when new.committed then 'Event participation requested' else 'Event participation request withdrawn' end,'description',p.name||' · '||title));
 end if;
 if (tg_op='INSERT' and new.assigned) or (tg_op='UPDATE' and new.assigned is distinct from old.assigned) then
  insert into public.discord_jobs(id,kind,payload) values(gen_random_uuid()::text,'notification',jsonb_build_object('topic','event_assignment','officer_name',p.name,'officer_position',p.position,'event_title',title,'event_id',new.event_id,'assigned',new.assigned));
 end if;
 return new;
end $$;
drop trigger if exists discord_participation_notification on public.officer_event_signups;
create trigger discord_participation_notification after insert or update on public.officer_event_signups for each row execute function public.enqueue_discord_participation_notification();
create or replace function public.enqueue_discord_task_request_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare kind text; title text; begin
 kind:=case when tg_table_name='gea_task_blockers' then 'help' else 'cancellation' end;
 select t.title into title from public.tasks t where t.id=new.task_id;
 if kind='help' then
  if new.resolved_at is not null then return new; end if;
 else
  if new.status<>'pending' then return new; end if;
 end if;
 insert into public.discord_jobs(id,kind,payload) values(gen_random_uuid()::text,'notification',jsonb_build_object('topic','workflow_review','request_kind',kind,'request_id',new.id,'title','Task '||kind||' requested','description',title));
 return new;
end $$;
drop trigger if exists discord_task_help_notification on public.gea_task_blockers;
create trigger discord_task_help_notification after insert or update on public.gea_task_blockers for each row execute function public.enqueue_discord_task_request_notification();
drop trigger if exists discord_cancellation_request_notification on public.officer_task_cancellation_requests;
create trigger discord_cancellation_request_notification after insert on public.officer_task_cancellation_requests for each row execute function public.enqueue_discord_task_request_notification();
revoke all on function public.save_discord_contribution(text,uuid,text,text,text),public.discord_officer_action(text,text,jsonb,text),public.enqueue_discord_service_notification(),public.enqueue_discord_shared_task_notification() from public,anon,authenticated;
revoke all on function public.enqueue_discord_participation_notification() from public,anon,authenticated;
revoke all on function public.enqueue_discord_task_request_notification() from public,anon,authenticated;
grant execute on function public.save_discord_contribution(text,uuid,text,text,text),public.discord_officer_action(text,text,jsonb,text) to service_role;
commit;
notify pgrst, 'reload schema';
