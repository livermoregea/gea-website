-- Shared deliverables with individual reflection and PEET evaluations.
-- Run after gea-peet-ai.sql and the existing officer shared-task migrations.
begin;
alter table public.tasks add column if not exists individual_peet boolean not null default false;
alter table public.peet_evaluations add column if not exists officer_id uuid references public.officer_profiles(id);
alter table public.peet_evaluations drop constraint if exists peet_evaluations_task_id_key;
create unique index if not exists peet_evaluations_legacy_task_idx on public.peet_evaluations(task_id) where officer_id is null;
create unique index if not exists peet_evaluations_person_idx on public.peet_evaluations(task_id,officer_id);
alter table public.gea_peet_tasks drop constraint if exists gea_peet_tasks_task_id_key;
create unique index if not exists gea_peet_tasks_person_idx on public.gea_peet_tasks(task_id,student_id);
alter table public.gea_peet_tasks add column if not exists reflected_at timestamptz;
alter table public.gea_peet_tasks add column if not exists deliverable_description text not null default '' check(length(deliverable_description)<=5000);
-- Preserve already awarded group scores. Only unscored, open collaborations upgrade.
update public.tasks t set individual_peet=true where t.status<>'completed' and t.cancelled_at is null
 and exists(select 1 from public.officer_task_members m where m.task_id=t.id)
 and not exists(select 1 from public.peet_evaluations e where e.task_id=t.id and e.officer_id is null);
create or replace function public.mark_individual_shared_task()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 update public.tasks set individual_peet=true where id=new.task_id and status='in_progress'; return new;
end $$;
drop trigger if exists task_members_individual_peet on public.officer_task_members;
create trigger task_members_individual_peet after insert on public.officer_task_members for each row execute function public.mark_individual_shared_task();
-- One contribution record belongs to its author, not all task participants.
drop policy if exists gea_peet_tasks_read on public.gea_peet_tasks;
create policy gea_peet_tasks_read on public.gea_peet_tasks for select to authenticated using(
 public.has_officer_access() and (student_id=auth.uid() or public.gea_peet_can_review(task_id))
);
drop policy if exists officer_evaluations_read on public.peet_evaluations;
create policy officer_evaluations_read on public.peet_evaluations for select to authenticated using(
 (officer_id is null and public.can_read_officer_task(task_id)) or
 (public.has_officer_access() and (officer_id=auth.uid() or public.gea_peet_can_review(task_id)))
);


create or replace function public.gea_peet_source_task(p_task_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_task public.tasks; begin
 if not public.has_officer_access() or not (public.is_officer_task_participant(p_task_id) or public.is_peet_admin()) then raise exception 'Task access required.'; end if;
 select * into v_task from public.tasks where id=p_task_id;
 if not found then raise exception 'Task unavailable.'; end if;
 return jsonb_build_object('id',v_task.id,'title',v_task.title,'description',v_task.description,
 'due_date',v_task.due_date,'original_due_date',v_task.original_due_date,'status',v_task.status,
 'assigned_to',v_task.assigned_to,'final_product_url',v_task.final_product_url,
 'submission_description',v_task.submission_description,'submitted_at',v_task.submitted_at,'cancelled_at',v_task.cancelled_at,'individual_peet',v_task.individual_peet,'participant_ids',
 (select jsonb_agg(i order by i) from (select v_task.assigned_to i union select officer_id from public.officer_task_members where task_id=v_task.id) people));
end $$;

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
 if not v_source.individual_peet and exists(select 1 from public.gea_peet_tasks where task_id=p_task_id and student_id<>p_student_id) then raise exception 'A submitter already started clarification.'; end if;
 select name into v_name from public.officer_profiles where id=p_student_id;
 insert into public.gea_peet_tasks(task_id,student_id,student_name,title,description,category,source_context,assessment,assessed_model,submission_url)
 values(p_task_id,p_student_id,v_name,v_source.title,p_description,p_category,p_source_context,p_assessment,p_model,nullif(btrim(p_submission_url),''))
 on conflict(task_id,student_id) do nothing returning * into v_result;
 if v_result.id is null then
  select * into v_result from public.gea_peet_tasks where task_id=p_task_id and student_id=p_student_id;

 end if;
 return v_result;
end $$;


create or replace function public.save_gea_peet_contribution_assessment(
 p_task_id uuid,p_student_id uuid,p_description text,p_category text,p_source_context jsonb,p_assessment jsonb,p_model text,p_submission_url text,p_deliverable_description text
) returns public.gea_peet_tasks language plpgsql security definer set search_path='' as $$
declare v_result public.gea_peet_tasks; begin
 if p_deliverable_description is null or length(p_deliverable_description)>5000 then raise exception 'Describe the shared deliverable within 5000 characters.'; end if;
 v_result:=public.save_gea_peet_assessment(p_task_id,p_student_id,p_description,p_category,p_source_context,p_assessment,p_model,p_submission_url);
 if v_result.deliverable_description='' then
  update public.gea_peet_tasks set deliverable_description=p_deliverable_description where id=v_result.id and status='clarification' returning * into v_result;
 end if;
 return v_result;
end $$;


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
 if v_source.title is distinct from v_task.source_context->>'title' or v_source.description is distinct from v_task.source_context->>'description'
 or to_jsonb(v_source.due_date) is distinct from nullif(v_task.source_context->'due_date','null'::jsonb) then raise exception 'Task goals changed. Restart clarification.'; end if;
 -- Existing submission RPC preserves participant permissions, timestamps and evidence.
 if v_source.status='in_progress' then perform public.submit_officer_task(v_source_id,coalesce(v_task.submission_url,v_source.final_product_url),case when v_source.individual_peet and v_task.deliverable_description<>'' then v_task.deliverable_description else v_task.description end); end if;
 update public.gea_peet_tasks set answers=p_answers,status='pending',reflected_at=now(),source_context=public.gea_peet_source_task(v_source_id),version=version+1
 where id=p_task_id returning * into v_task;
 return v_task;
end $$;

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
  if v_task.individual_peet then raise exception 'Evaluate each participant contribution separately.'; end if;
  insert into public.peet_evaluations(task_id, evaluated_by, efficiency, effectiveness, time, feedback_notes)
    values(p_task_id, auth.uid(), p_efficiency, p_effectiveness, p_time, p_feedback)
    on conflict(task_id) where officer_id is null do update set evaluated_by = excluded.evaluated_by,
      efficiency = excluded.efficiency, effectiveness = excluded.effectiveness,
      time = excluded.time, feedback_notes = excluded.feedback_notes, evaluated_at = now();
  update public.tasks set status = 'completed', completed_at = coalesce(completed_at, now()) where id = p_task_id;
end;
$$;


create or replace function public.evaluate_officer_contribution(
 p_task_id uuid,p_officer_id uuid,p_version integer,p_efficiency numeric,p_effectiveness numeric,p_time numeric,p_feedback text default ''
) returns void language plpgsql security definer set search_path='' as $$
declare v_source public.tasks; v_contribution public.gea_peet_tasks; begin
 select * into v_source from public.tasks where id=p_task_id for update;
 if not found or not v_source.individual_peet or not public.gea_peet_can_review(p_task_id) or v_source.cancelled_at is not null
 or v_source.status not in ('submitted','completed') then raise exception 'Independent contribution review required.'; end if;
 if p_officer_id<>v_source.assigned_to and not exists(select 1 from public.officer_task_members where task_id=p_task_id and officer_id=p_officer_id) then raise exception 'This officer is not on the task.'; end if;
 select * into v_contribution from public.gea_peet_tasks where task_id=p_task_id and student_id=p_officer_id for update;
 if not found or v_contribution.status not in ('pending','approved') or v_contribution.version is distinct from p_version then raise exception 'The officer must submit their own reflection before evaluation.'; end if;
 if p_efficiency is null or p_efficiency not between 1 and 4 or round(p_efficiency,1)<>p_efficiency
 or p_effectiveness is null or p_effectiveness not between 1 and 4 or round(p_effectiveness,1)<>p_effectiveness
 or p_time is null or p_time not between 1 and 4 or round(p_time,1)<>p_time
 or p_feedback is null or length(p_feedback)>10000 then raise exception 'Enter valid PEET scores and feedback.'; end if;
 insert into public.peet_evaluations(task_id,officer_id,evaluated_by,efficiency,effectiveness,time,feedback_notes)
 values(p_task_id,p_officer_id,auth.uid(),p_efficiency,p_effectiveness,p_time,p_feedback)
 on conflict(task_id,officer_id) do update set evaluated_by=excluded.evaluated_by,efficiency=excluded.efficiency,
 effectiveness=excluded.effectiveness,time=excluded.time,feedback_notes=excluded.feedback_notes,evaluated_at=now();
 update public.gea_peet_tasks set status='approved',approved_scores=jsonb_build_object('efficiency',p_efficiency,'effectiveness',p_effectiveness,'time',p_time),
 approved_by=auth.uid(),approved_at=now(),version=version+1 where id=v_contribution.id;
 if not exists(select 1 from (select v_source.assigned_to officer_id union select officer_id from public.officer_task_members where task_id=p_task_id) people
 where not exists(select 1 from public.peet_evaluations e where e.task_id=p_task_id and e.officer_id=people.officer_id)) then
  update public.tasks set status='completed',completed_at=coalesce(completed_at,now()) where id=p_task_id;
 end if;
end $$;
-- Prevent old/manual group writes from silently awarding every collaborator.
create or replace function public.guard_individual_peet_evaluation()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.officer_id is null and exists(select 1 from public.tasks where id=new.task_id and individual_peet) then
  raise exception 'This collaboration requires individual contribution evaluations.';
 end if;
 if tg_op='UPDATE' and (new.officer_id is distinct from old.officer_id or new.task_id is distinct from old.task_id) then raise exception 'Evaluation identity cannot change.'; end if;
 return new;
end $$;
drop trigger if exists individual_peet_evaluation_guard on public.peet_evaluations;
create trigger individual_peet_evaluation_guard before insert or update on public.peet_evaluations for each row execute function public.guard_individual_peet_evaluation();


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
 if v_source.individual_peet then
 perform public.evaluate_officer_contribution(v_source_id,v_task.student_id,v_task.version,v_eff,v_effect,v_time,
  (v_task.recommendation->>'justification')||case when v_changed then E'\nReviewer adjustment: '||btrim(p_override_reason) else '' end);
 else
 perform public.evaluate_officer_task(v_source_id,v_eff,v_effect,v_time,(v_task.recommendation->>'justification')||case when v_changed then E'\nReviewer adjustment: '||btrim(p_override_reason) else '' end);
 end if;
 update public.gea_peet_tasks set status='approved',approved_scores=p_scores,approved_by=auth.uid(),approved_at=now(),
 override_reason=case when v_changed then btrim(p_override_reason) else '' end,version=version+1 where id=p_task_id returning * into v_task;
 return v_task;
end $$;


create or replace function public.gea_peet_my_open_tasks()
returns table(id uuid,title text) language sql stable security definer set search_path='' as $$
 select t.id,t.title from public.tasks t where public.has_officer_access() and public.is_officer_task_participant(t.id)
 and t.cancelled_at is null and t.status in ('in_progress','submitted')
 and not exists(select 1 from public.gea_peet_tasks a where a.task_id=t.id and a.student_id=auth.uid());
$$;
create or replace function public.gea_peet_my_reviews()
returns setof public.gea_peet_tasks language sql stable security definer set search_path='' as $$
 select a.* from public.gea_peet_tasks a where public.has_officer_access() and a.student_id=auth.uid();
$$;
revoke all on function public.mark_individual_shared_task(),public.guard_individual_peet_evaluation(),
 public.evaluate_officer_contribution(uuid,uuid,integer,numeric,numeric,numeric,text),
 public.save_gea_peet_contribution_assessment(uuid,uuid,text,text,jsonb,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.evaluate_officer_contribution(uuid,uuid,integer,numeric,numeric,numeric,text) to authenticated;
grant execute on function public.save_gea_peet_contribution_assessment(uuid,uuid,text,text,jsonb,jsonb,text,text,text) to service_role;
create or replace function public.guard_officer_task_members()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; v_task_id uuid; begin
 if tg_op='UPDATE' then raise exception 'Remove and add a participant instead of changing membership identity.'; end if;
 if tg_op='DELETE' then v_task_id:=old.task_id; else v_task_id:=new.task_id; end if;
 select * into v_task from public.tasks where id=v_task_id for update;
 if not public.has_officer_access() or not found or v_task.created_by<>auth.uid() or (v_task.assigned_to<>auth.uid() and not public.is_peet_admin())
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

create or replace function public.assign_officer_collaboration(p_title text,p_description text,p_due_date date,p_people uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_people uuid[]; begin
 if not public.has_officer_access() or not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 select array_agg(i order by i) into v_people from (select distinct i from unnest(p_people) i) people;
 if v_people is null or cardinality(v_people) not between 2 and 100 or exists(select 1 from unnest(v_people) i where i is null or not public.is_task_officer(i)) then raise exception 'Choose two or more active officers for this collaboration.'; end if;
 v_id:=public.save_officer_task(p_title,p_description,p_due_date,v_people[1],null);
 insert into public.officer_task_members(task_id,officer_id) select v_id,i from unnest(v_people) i where i<>v_people[1];
 update public.tasks set individual_peet=true where id=v_id;
 return v_id;
end $$;
revoke all on function public.assign_officer_collaboration(text,text,date,uuid[]) from public,anon,authenticated;
grant execute on function public.assign_officer_collaboration(text,text,date,uuid[]) to authenticated;

-- Keep removal-review snapshots scoped to the officer whose work was scored.
do $upgrade$ begin
 if to_regprocedure('public.decide_officer_strike(uuid,text,text)') is not null then
 execute $definition$create or replace function public.decide_officer_strike(p_strike_id uuid,p_status text,p_notes text)
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
      'peet_score',(select avg((e.efficiency+e.effectiveness+e.time)/3)/4*100 from public.peet_evaluations e join public.tasks t on t.id=e.task_id where (e.officer_id=v_strike.officer_id or (e.officer_id is null and (t.assigned_to=v_strike.officer_id or exists(select 1 from public.officer_task_members m where m.task_id=t.id and m.officer_id=v_strike.officer_id)))) and (e.officer_id is not null or t.status='completed') and t.cancelled_at is null)) into v_context;
    insert into public.officer_removal_reviews(officer_id,academic_year,category,context_snapshot)
      values(v_strike.officer_id,v_strike.academic_year,v_strike.category,v_context) on conflict(officer_id,academic_year,category)
      do update set status='pending',context_snapshot=excluded.context_snapshot,advisor_notes='',decided_by=null,decided_at=null;
  end if;
end $$;$definition$;
 end if;
end $upgrade$;

commit;
