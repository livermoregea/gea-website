-- DEPLOYMENT MIGRATION: paste this entire file into the Supabase SQL editor.
-- Apply after officer-shared-tasks.sql and officer-task-submissions.sql.
-- AI clarification and scoring use the existing 1–4 PEET evaluation records.
begin;
create or replace function public.gea_peet_access()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('student',public.has_officer_access() and public.is_task_officer(auth.uid()),
 'reviewer',public.has_officer_access() and public.is_peet_admin());
$$;
create or replace function public.gea_peet_can_review(p_task_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.has_officer_access() and public.is_peet_admin()
 and not public.is_officer_task_participant(p_task_id)
 and (public.is_super_admin() or not exists(
  select 1 from public.officer_profiles p where p.reviewer_kind='president' and
   (exists(select 1 from public.tasks t where t.id=p_task_id and t.assigned_to=p.id)
    or exists(select 1 from public.officer_task_members m where m.task_id=p_task_id and m.officer_id=p.id)))
  or public.is_peet_advisor());
$$;
create or replace function public.gea_peet_source_task(p_task_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_task public.tasks; begin
 if not public.has_officer_access() or not (public.is_officer_task_participant(p_task_id) or public.is_peet_admin()) then raise exception 'Task access required.'; end if;
 select * into v_task from public.tasks where id=p_task_id;
 if not found then raise exception 'Task unavailable.'; end if;
 return jsonb_build_object('id',v_task.id,'title',v_task.title,'description',v_task.description,
 'due_date',v_task.due_date,'original_due_date',v_task.original_due_date,'status',v_task.status,
 'assigned_to',v_task.assigned_to,'final_product_url',v_task.final_product_url,
 'submission_description',v_task.submission_description,'submitted_at',v_task.submitted_at,'cancelled_at',v_task.cancelled_at);
end $$;
create table if not exists public.gea_peet_tasks (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null unique references public.tasks(id),
 student_id uuid not null references auth.users(id), student_name text not null,
 title text not null, description text not null check(length(btrim(description)) between 1 and 5000),
 category text not null check(category in ('Logistics','Outreach','Web Dev','Media','Event Support')),
 source_context jsonb not null,
 status text not null default 'clarification' check(status in ('clarification','pending','approved')),
 assessment jsonb not null,
 answers jsonb not null default '[]'::jsonb,
 reviewer_notes text not null default '' check(length(reviewer_notes)<=3000),
 reviewer_assessment jsonb, reviewer_answers jsonb not null default '[]'::jsonb,
 review_history jsonb not null default '[]'::jsonb,
 questions_by uuid references auth.users(id),
 recommendation jsonb, approved_scores jsonb,
 assessed_model text not null, reviewer_questions_model text, reviewed_model text,
 reviewed_by uuid references auth.users(id), approved_by uuid references auth.users(id),
 override_reason text not null default '' check(length(override_reason)<=2000),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), approved_at timestamptz,
 check(jsonb_typeof(assessment->'studentQuestions')='array' and jsonb_array_length(assessment->'studentQuestions') between 1 and 3),
 check(jsonb_typeof(answers)='array' and jsonb_typeof(reviewer_answers)='array'),
 check((status='approved')=(approved_scores is not null and approved_at is not null))
);
-- Additive when an earlier version of this feature is already installed.
alter table public.gea_peet_tasks add column if not exists submission_url text
 check(submission_url is null or (length(submission_url)<=2048 and submission_url ~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$'));
create or replace function public.gea_peet_my_open_tasks()
returns table(id uuid,title text) language sql stable security definer set search_path='' as $$
 select t.id,t.title from public.tasks t where public.has_officer_access()
 and public.is_officer_task_participant(t.id) and t.status in ('in_progress','submitted') and t.cancelled_at is null
 and not exists(select 1 from public.gea_peet_tasks a where a.task_id=t.id)
 order by t.created_at desc,t.id;
$$;
create or replace function public.gea_peet_my_reviews()
returns setof public.gea_peet_tasks language sql stable security definer set search_path='' as $$
 select a.* from public.gea_peet_tasks a where public.has_officer_access() and public.is_officer_task_participant(a.task_id);
$$;
create index if not exists gea_peet_tasks_student_idx on public.gea_peet_tasks(student_id,created_at desc);
create index if not exists gea_peet_tasks_status_idx on public.gea_peet_tasks(status,created_at desc);
create table if not exists public.gea_peet_ai_requests (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index if not exists gea_peet_ai_requests_user_idx on public.gea_peet_ai_requests(user_id,created_at);
alter table public.gea_peet_tasks enable row level security;
alter table public.gea_peet_ai_requests enable row level security;
drop policy if exists gea_peet_tasks_read on public.gea_peet_tasks;
create policy gea_peet_tasks_read on public.gea_peet_tasks for select to authenticated using(
 public.has_officer_access() and (public.is_officer_task_participant(task_id) or (public.is_peet_admin() and (status<>'clarification' or exists(select 1 from public.tasks t where t.id=gea_peet_tasks.task_id and t.status='submitted'))))
);
revoke all on public.gea_peet_tasks,public.gea_peet_ai_requests from public,anon,authenticated;
grant select on public.gea_peet_tasks to authenticated;
grant all on public.gea_peet_tasks,public.gea_peet_ai_requests to service_role;
grant usage,select on sequence public.gea_peet_ai_requests_id_seq to service_role;
create or replace function public.reserve_gea_peet_ai_request(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$ begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gea-peet-ai-'||p_user_id::text,0));
 delete from public.gea_peet_ai_requests where user_id=p_user_id and created_at<now()-interval '10 minutes';
 if (select count(*) from public.gea_peet_ai_requests where user_id=p_user_id)>=12 then return false; end if;
 insert into public.gea_peet_ai_requests(user_id) values(p_user_id); return true;
end $$;
-- Model-produced assessments are saved by the server after cookie authorization.
-- The service-only function checks participation and the original task snapshot.
create or replace function public.save_gea_peet_assessment(
 p_task_id uuid,p_student_id uuid,p_description text,p_category text,p_source_context jsonb,p_assessment jsonb,p_model text,p_submission_url text
) returns public.gea_peet_tasks language plpgsql security definer set search_path='' as $$
declare v_source public.tasks; v_result public.gea_peet_tasks; v_name text; begin
 select * into v_source from public.tasks where id=p_task_id for update;
 if not found or v_source.cancelled_at is not null or v_source.status not in ('in_progress','submitted') then raise exception 'Task is closed or unavailable.'; end if;
 if not public.is_task_officer(p_student_id) or not (v_source.assigned_to=p_student_id or exists(select 1 from public.officer_task_members where task_id=p_task_id and officer_id=p_student_id)) then raise exception 'Only a task participant may submit.'; end if;
 -- Compare relevant source fields to avoid saving against concurrently edited goals.
 if v_source.title is distinct from p_source_context->>'title' or v_source.description is distinct from p_source_context->>'description'
 or to_jsonb(v_source.due_date) is distinct from nullif(p_source_context->'due_date','null'::jsonb)
 or v_source.status is distinct from p_source_context->>'status'
 or v_source.submission_description is distinct from p_source_context->>'submission_description' then raise exception 'Task changed. Refresh.'; end if;
 select name into v_name from public.officer_profiles where id=p_student_id;
 insert into public.gea_peet_tasks(task_id,student_id,student_name,title,description,category,source_context,assessment,assessed_model,submission_url)
 values(p_task_id,p_student_id,v_name,v_source.title,p_description,p_category,p_source_context,p_assessment,p_model,nullif(btrim(p_submission_url),''))
 on conflict(task_id) do nothing returning * into v_result;
 if v_result.id is null then
  select * into v_result from public.gea_peet_tasks where task_id=p_task_id;
  if v_result.student_id<>p_student_id then raise exception 'A teammate already started clarification.'; end if;
 end if;
 return v_result;
end $$;
-- Keep callers of the earlier seven-argument server RPC compatible.
create or replace function public.save_gea_peet_assessment(
 p_task_id uuid,p_student_id uuid,p_description text,p_category text,p_source_context jsonb,p_assessment jsonb,p_model text
) returns public.gea_peet_tasks language sql security definer set search_path='' as $$
 select public.save_gea_peet_assessment(p_task_id,p_student_id,p_description,p_category,p_source_context,p_assessment,p_model,null::text);
$$;
create or replace function public.finalize_gea_peet_task(p_task_id uuid,p_version integer,p_answers jsonb)
returns public.gea_peet_tasks language plpgsql security definer set search_path='' as $$
declare v_task public.gea_peet_tasks; v_source public.tasks; v_source_id uuid; begin
 select task_id into v_source_id from public.gea_peet_tasks where id=p_task_id;
 select * into v_source from public.tasks where id=v_source_id for update;
 select * into v_task from public.gea_peet_tasks where id=p_task_id for update;
 if not found or not public.has_officer_access() or v_task.student_id<>auth.uid() or not public.is_officer_task_participant(v_source_id) then raise exception 'Task unavailable.'; end if;
 if v_task.status<>'clarification' or v_task.version is distinct from p_version or v_source.cancelled_at is not null or v_source.status not in ('in_progress','submitted') then raise exception 'Task changed. Refresh.'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'array' then raise exception 'Answer each saved question.'; end if;
 if jsonb_array_length(p_answers)<>jsonb_array_length(v_task.assessment->'studentQuestions') or exists(
  select 1 from jsonb_array_elements(p_answers) a where jsonb_typeof(a)<>'string' or length(btrim(a#>>'{}')) not between 1 and 2000)
 then raise exception 'Answer each saved question.'; end if;
 -- Existing submission RPC preserves participant permissions, timestamps and evidence.
 if v_source.status='in_progress' then perform public.submit_officer_task(v_source_id,coalesce(v_task.submission_url,v_source.final_product_url),v_task.description); end if;
 update public.gea_peet_tasks set answers=p_answers,status='pending',source_context=public.gea_peet_source_task(v_source_id),version=version+1
 where id=p_task_id returning * into v_task;
 return v_task;
end $$;
-- Persist model-produced reviewer stages only if the original task and AI version
-- still match. Called solely by the trusted server after cookie authorization.
create or replace function public.save_gea_peet_review(
 p_task_id uuid,p_version integer,p_actor uuid,p_source_context jsonb,p_stage text,p_result jsonb,p_notes text,p_answers jsonb,p_model text
) returns public.gea_peet_tasks language plpgsql security definer set search_path='' as $$
declare v_task public.gea_peet_tasks; v_source public.tasks; v_source_id uuid; begin
 select task_id into v_source_id from public.gea_peet_tasks where id=p_task_id;
 select * into v_source from public.tasks where id=v_source_id for update;
 select * into v_task from public.gea_peet_tasks where id=p_task_id for update;
 if not found or v_task.status<>'pending' or v_task.version is distinct from p_version or v_source.cancelled_at is not null or v_source.status<>'submitted' then raise exception 'Task changed. Refresh.'; end if;
 -- Source task fields and participants cannot change unnoticed during generation.
 if v_source.title is distinct from p_source_context->>'title' or v_source.description is distinct from p_source_context->>'description'
 or to_jsonb(v_source.due_date) is distinct from nullif(p_source_context->'due_date','null'::jsonb)
 or v_source.submission_description is distinct from p_source_context->>'submission_description'
 or v_source.final_product_url is distinct from p_source_context->>'final_product_url' then raise exception 'Task changed. Refresh.'; end if;
 if not exists(select 1 from public.officer_profiles where id=p_actor and access_enabled)
 or not (exists(select 1 from public.officer_profiles where id=p_actor and access_enabled and role='admin')
 or exists(select 1 from public.super_admins where auth_user_id=p_actor))
 or v_source.assigned_to=p_actor or exists(select 1 from public.officer_task_members where task_id=v_source_id and officer_id=p_actor) then raise exception 'Reviewer access changed.'; end if;
 if p_stage='questions' then
  update public.gea_peet_tasks set review_history=review_history || case when reviewer_assessment is null then '[]'::jsonb else
   jsonb_build_array(jsonb_build_object('assessment',reviewer_assessment,'answers',reviewer_answers,'notes',reviewer_notes,
   'questions_by',questions_by,'recommendation',recommendation,'reviewed_by',reviewed_by,'source_context',source_context,'saved_at',now())) end,
   reviewer_assessment=p_result,reviewer_notes=p_notes,reviewer_answers='[]',recommendation=null,
   questions_by=p_actor,reviewed_by=null,reviewed_model=null,reviewer_questions_model=p_model,source_context=p_source_context,version=version+1 where id=p_task_id returning * into v_task;
 elsif p_stage='score' then
  if p_source_context is distinct from v_task.source_context then raise exception 'Goals changed. Generate new reviewer questions.'; end if;
  if v_task.questions_by is distinct from p_actor or v_task.reviewer_assessment is null then raise exception 'Answer your own reviewer questions first.'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'array' then raise exception 'Answer each reviewer question.'; end if;
  if jsonb_array_length(p_answers)<>jsonb_array_length(v_task.reviewer_assessment->'reviewerQuestions') then raise exception 'Answer each reviewer question.'; end if;
  update public.gea_peet_tasks set reviewer_answers=p_answers,recommendation=p_result,reviewed_by=p_actor,reviewed_model=p_model,
   source_context=p_source_context,version=version+1 where id=p_task_id returning * into v_task;
 else raise exception 'Invalid review stage.'; end if;
 return v_task;
end $$;
create or replace function public.approve_gea_peet_task(
 p_task_id uuid,p_version integer,p_scores jsonb,p_override_reason text default ''
) returns public.gea_peet_tasks language plpgsql security definer set search_path='' as $$
declare v_task public.gea_peet_tasks; v_source public.tasks; v_source_id uuid; v_eff numeric; v_effect numeric; v_time numeric; v_changed boolean; begin
 select task_id into v_source_id from public.gea_peet_tasks where id=p_task_id;
 select * into v_source from public.tasks where id=v_source_id for update;
 select * into v_task from public.gea_peet_tasks where id=p_task_id for update;
 if not found or not public.gea_peet_can_review(v_source_id) then raise exception 'An independent authorized reviewer is required.'; end if;
 if v_task.status='approved' then return v_task; end if;
 if v_task.status<>'pending' or v_task.version is distinct from p_version or v_task.recommendation is null
 or v_task.reviewed_by is distinct from auth.uid() or v_task.questions_by is distinct from auth.uid()
 or v_source.status<>'submitted' or v_source.cancelled_at is not null then raise exception 'Complete the reviewer questions and AI scoring before approval.'; end if;
 if public.gea_peet_source_task(v_source_id) is distinct from v_task.source_context then raise exception 'Task changed. Generate fresh reviewer questions.'; end if;
 if p_scores is null or jsonb_typeof(p_scores)<>'object' or (p_scores-'efficiency'-'effectiveness'-'time')<>'{}'::jsonb
 or jsonb_typeof(p_scores->'efficiency') is distinct from 'number' or jsonb_typeof(p_scores->'effectiveness') is distinct from 'number' or jsonb_typeof(p_scores->'time') is distinct from 'number'
 then raise exception 'Enter all three PEET scores.'; end if;
 v_eff:=(p_scores->>'efficiency')::numeric; v_effect:=(p_scores->>'effectiveness')::numeric; v_time:=(p_scores->>'time')::numeric;
 if v_eff not between 1 and 4 or v_effect not between 1 and 4 or v_time not between 1 and 4 or round(v_eff,1)<>v_eff or round(v_effect,1)<>v_effect or round(v_time,1)<>v_time then raise exception 'Scores must be 1.0–4.0 in increments of 0.1.'; end if;
 v_changed:=p_scores is distinct from (v_task.recommendation-'justification');
 if p_override_reason is null or length(p_override_reason)>2000 or (v_changed and length(btrim(p_override_reason))=0) then raise exception 'Explain changed scores.'; end if;
 -- Use the SAME evaluation function and table as manual PEET scoring.
 perform public.evaluate_officer_task(v_source_id,v_eff,v_effect,v_time,
  (v_task.recommendation->>'justification')||case when v_changed then E'\nReviewer adjustment: '||btrim(p_override_reason) else '' end);
 update public.gea_peet_tasks set status='approved',approved_scores=p_scores,approved_by=auth.uid(),approved_at=now(),
 override_reason=case when v_changed then btrim(p_override_reason) else '' end,version=version+1 where id=p_task_id returning * into v_task;
 return v_task;
end $$;
revoke all on function public.gea_peet_access(),public.gea_peet_my_open_tasks(),public.gea_peet_my_reviews(),public.gea_peet_can_review(uuid),public.gea_peet_source_task(uuid),
 public.finalize_gea_peet_task(uuid,integer,jsonb),public.approve_gea_peet_task(uuid,integer,jsonb,text),
 public.reserve_gea_peet_ai_request(uuid),public.save_gea_peet_assessment(uuid,uuid,text,text,jsonb,jsonb,text),
 public.save_gea_peet_assessment(uuid,uuid,text,text,jsonb,jsonb,text,text),
 public.save_gea_peet_review(uuid,integer,uuid,jsonb,text,jsonb,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.gea_peet_access(),public.gea_peet_my_open_tasks(),public.gea_peet_my_reviews(),public.gea_peet_can_review(uuid),public.gea_peet_source_task(uuid),
 public.finalize_gea_peet_task(uuid,integer,jsonb),public.approve_gea_peet_task(uuid,integer,jsonb,text) to authenticated;
grant execute on function public.reserve_gea_peet_ai_request(uuid),public.save_gea_peet_assessment(uuid,uuid,text,text,jsonb,jsonb,text),
 public.save_gea_peet_assessment(uuid,uuid,text,text,jsonb,jsonb,text,text),
 public.save_gea_peet_review(uuid,integer,uuid,jsonb,text,jsonb,text,jsonb,text) to service_role;
commit;
