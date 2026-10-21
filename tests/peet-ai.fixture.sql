-- LOCAL TEST FIXTURE ONLY. Do not paste into the Supabase SQL editor.
-- For deployment, run supabase/gea-peet-ai.sql instead.
-- Run this file with psql ONLY in an empty disposable local database.
-- Uses the real officer submission
-- and evaluation functions; the small membership fixture emulates current roles.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
\ir ../supabase/officerboard.sql
\ir ../supabase/officer-peet-percentage.sql
alter table public.officer_profiles add column access_enabled boolean default true, add column reviewer_kind text;
alter table public.tasks add column original_due_date date, add column cancelled_at timestamptz;
create table public.officer_task_members(task_id uuid references public.tasks(id),officer_id uuid references public.officer_profiles(id));
create table public.super_admins(auth_user_id uuid primary key);
create function public.has_officer_access() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.officer_profiles where id=auth.uid() and access_enabled) $$;
create function public.is_task_officer(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.officer_profiles where id=p_id and access_enabled and reviewer_kind is distinct from 'advisor') $$;
create or replace function public.is_peet_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.officer_profiles where id=auth.uid() and access_enabled and role='admin') $$;
create function public.is_peet_advisor() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.officer_profiles where id=auth.uid() and access_enabled and reviewer_kind='advisor') $$;
create function public.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.super_admins where auth_user_id=auth.uid()) $$;
create function public.is_officer_task_participant(p_task_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.tasks where id=p_task_id and assigned_to=auth.uid()) or exists(select 1 from public.officer_task_members where task_id=p_task_id and officer_id=auth.uid()) $$;
\ir ../supabase/officer-task-submissions.sql
\ir ../supabase/gea-peet-ai.sql
\ir ../supabase/gea-peet-ai.sql
create function public.test_assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',message; end if; end $$;
create function public.test_denied(command text) returns void language plpgsql as $$ begin begin execute command; raise exception 'FAIL: unauthorized operation succeeded: %',command; exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end; end $$;
insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444');
insert into public.officer_profiles(id,name,role,reviewer_kind) values
 ('11111111-1111-4111-8111-111111111111','Submitter','officer',null),
 ('22222222-2222-4222-8222-222222222222','Other officer','officer',null),
 ('33333333-3333-4333-8333-333333333333','Advisor','admin','advisor'),
 ('44444444-4444-4444-8444-444444444444','President','admin','president');
insert into public.tasks(id,title,description,assigned_to,created_by,due_date) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Workshop','Deliver a workshop and reusable slides','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','2026-10-17');
begin;
do $$
declare
 student uuid:='11111111-1111-4111-8111-111111111111'; outsider uuid:='22222222-2222-4222-8222-222222222222';
 advisor uuid:='33333333-3333-4333-8333-333333333333'; president uuid:='44444444-4444-4444-8444-444444444444';
 original uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 flow public.gea_peet_tasks; context jsonb; i integer;
 questions jsonb:='{"reviewerQuestions":["What goals and quality expectations were agreed, and how did the deliverables compare?","Was the deadline met, and how efficiently was the work completed?"],"reviewContextSummary":"Clarify all three dimensions."}';
 recommendation jsonb:='{"efficiency":3,"effectiveness":3.5,"time":3,"justification":"Efficient progress, strong quality, met deadline."}';
 answers jsonb:='["Met agreed goals with unusually reusable slides.","Efficient work with appropriate guidance and on-time delivery."]';
begin
 execute 'set local role authenticated'; perform set_config('request.jwt.claim.sub',student::text,true);
 perform public.test_assert((public.gea_peet_access()->>'student')::boolean,'Officer can submit');
 perform public.test_assert(not (public.gea_peet_access()->>'reviewer')::boolean,'Officer cannot review');
 context:=public.gea_peet_source_task(original);
 perform public.test_assert((select count(*)=1 from public.gea_peet_my_open_tasks()),'Own open tasks available');
 perform public.test_denied('update public.gea_peet_tasks set recommendation=''{}''');
 perform public.test_denied(format('select public.reserve_gea_peet_ai_request(%L)',student));
 execute 'set local role service_role';
 flow:=public.save_gea_peet_assessment(original,student,'Delivered workshop and slides','Outreach',context,
  '{"needsMoreInfo":true,"studentQuestions":["What did you deliver and when?"],"initialAssessmentSummary":"Confirm outcome and timing."}','test-model','https://example.com/workshop');
 perform public.test_assert(flow.status='clarification','No score before submitter clarification');
 perform public.test_assert(flow.submission_url='https://example.com/workshop','Supporting link saved with clarification draft');
 execute 'set local role authenticated';
 perform public.test_assert((select count(*)=1 from public.gea_peet_my_reviews()),'Submitter can resume their saved review');
 execute 'reset role';
 insert into public.officer_task_members(task_id,officer_id) values(original,outsider);
 execute 'set local role authenticated'; perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform public.test_assert((select count(*)=1 from public.gea_peet_my_reviews()),'Shared participant sees the same saved review');
 perform public.test_assert(not public.gea_peet_can_review(original),'Shared participant cannot evaluate their own task');
 execute 'reset role'; delete from public.officer_task_members where task_id=original and officer_id=outsider;
 execute 'set local role authenticated'; perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform public.test_assert((select count(*)=0 from public.gea_peet_tasks),'Other officer isolated');
 perform public.test_denied(format('select public.finalize_gea_peet_task(%L,1,''["Forged"]'')',flow.id));
 perform set_config('request.jwt.claim.sub',advisor::text,true);
 perform public.test_assert((select count(*)=0 from public.gea_peet_tasks),'Reviewer cannot see incomplete submitter clarification');
 perform set_config('request.jwt.claim.sub',student::text,true);
 perform public.test_denied(format('select public.finalize_gea_peet_task(%L,1,''[]'')',flow.id));
 flow:=public.finalize_gea_peet_task(flow.id,1,'["Delivered workshop and slides by the deadline."]');
 perform public.test_assert(flow.status='pending' and flow.version=2,'Submitter Q&A finalized');
 perform set_config('request.jwt.claim.sub',advisor::text,true);
 perform public.test_assert((select count(*)=1 from public.gea_peet_tasks),'Reviewer can load finalized task clarification inside evaluation');
 perform set_config('request.jwt.claim.sub',student::text,true);
 perform public.test_assert((select status='submitted' and submission_description='Delivered workshop and slides' and final_product_url='https://example.com/workshop' from public.tasks where id=original),'Original task submitted with actual submission RPC');
 perform public.test_assert(not public.gea_peet_can_review(original),'No self review');
 context:=flow.source_context;
 perform set_config('request.jwt.claim.sub',advisor::text,true);
 perform public.test_denied(format('select public.approve_gea_peet_task(%L,2,''{"efficiency":3,"effectiveness":3,"time":3}''::jsonb)',flow.id));
 execute 'set local role service_role';
 perform public.test_denied(format('select public.save_gea_peet_review(%L,2,%L,%L,''score'',%L,'''',%L,''test'')',flow.id,advisor,context,recommendation,answers));
 flow:=public.save_gea_peet_review(flow.id,2,advisor,context,'questions',questions,'Expected reusable slides.','[]','test-model');
 perform public.test_assert(flow.recommendation is null and flow.questions_by=advisor,'Reviewer questions precede scores');
 perform public.test_denied(format('select public.save_gea_peet_review(%L,3,%L,%L,''score'',%L,'''',''[]'',''test'')',flow.id,advisor,context,recommendation));
 perform public.test_denied(format('select public.save_gea_peet_review(%L,3,%L,%L,''score'',%L,'''',%L,''test'')',flow.id,president,context,recommendation,answers));
 flow:=public.save_gea_peet_review(flow.id,3,advisor,context,'score',recommendation,flow.reviewer_notes,answers,'test-model');
 execute 'set local role authenticated'; perform set_config('request.jwt.claim.sub',advisor::text,true);
 perform public.test_denied(format('select public.approve_gea_peet_task(%L,3,''{"efficiency":3,"effectiveness":3.5,"time":3}'')',flow.id));
 perform public.test_denied(format('select public.approve_gea_peet_task(%L,4,''{"efficiency":3,"effectiveness":5,"time":3}'')',flow.id));
 perform public.test_denied(format('select public.approve_gea_peet_task(%L,4,''{"efficiency":3,"effectiveness":4,"time":3}'')',flow.id));
 -- Changing source goals invalidates the recommendation at the approval boundary.
 execute 'reset role'; update public.tasks set description='Changed goals' where id=original;
 execute 'set local role authenticated';
 perform public.test_denied(format('select public.approve_gea_peet_task(%L,4,''{"efficiency":3,"effectiveness":3.5,"time":3}'')',flow.id));
 execute 'reset role'; update public.tasks set description='Deliver a workshop and reusable slides' where id=original;
 execute 'set local role service_role';
 -- Refreshing questions preserves the earlier Q&A and score in history, and clears the old score.
 flow:=public.save_gea_peet_review(flow.id,4,advisor,context,'questions',questions,'Confirmed observations.','[]','test-model');
 perform public.test_assert(flow.recommendation is null and jsonb_array_length(flow.review_history)=1,'Previous reviewer Q&A retained and stale score cleared');
 flow:=public.save_gea_peet_review(flow.id,5,advisor,context,'score',recommendation,flow.reviewer_notes,answers,'test-model');
 execute 'set local role authenticated';
 flow:=public.approve_gea_peet_task(flow.id,6,'{"efficiency":3,"effectiveness":4,"time":3}','Deliverables exceeded the agreed quality standard.');
 perform public.test_assert(flow.status='approved' and flow.approved_scores->>'effectiveness'='4','Reviewer edits each pillar before approval');
 perform public.test_assert((select efficiency=3 and effectiveness=4 and time=3 and feedback_notes like '%Reviewer adjustment:%' from public.peet_evaluations where task_id=original),'Real PEET evaluation table updated');
 perform public.test_assert((select status='completed' from public.tasks where id=original),'Original task completed atomically');
 perform public.approve_gea_peet_task(flow.id,6,'{"efficiency":1,"effectiveness":1,"time":1}','Retry must not replace the evaluation');
 perform public.test_assert((select count(*)=1 and max(effectiveness)=4 from public.peet_evaluations where task_id=original),'Duplicate approval cannot replace or duplicate the evaluation');
 perform public.test_assert((select round(public.peet_percentage((efficiency+effectiveness+time)/3),1)=90.0 from public.peet_evaluations where task_id=original),'Updated PEET percentage formula');
 -- An older manually submitted task can request clarification in its evaluation dialog.
 execute 'reset role';
 insert into public.tasks(id,title,description,assigned_to,created_by,status,submission_description,submitted_at,final_product_url)
 values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Older submission','Expected workshop slides',student,advisor,'submitted','Delivered original slides',now(),'https://example.com/older');
 context:=public.gea_peet_source_task('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 flow:=public.save_gea_peet_assessment('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',student,'Delivered original slides','Media',context,
  '{"needsMoreInfo":true,"studentQuestions":["How did your slides meet the agreed goals?"],"initialAssessmentSummary":"Confirm goals and outcome."}','test-model');
 execute 'set local role authenticated';
 perform public.test_assert((select status='clarification' from public.gea_peet_tasks where id=flow.id),'Reviewer sees requested clarification on already submitted task');
 perform set_config('request.jwt.claim.sub',student::text,true);
 perform public.test_assert(exists(select 1 from public.gea_peet_tasks where id=flow.id),'Submitter resumes requested clarification from task row');
 flow:=public.finalize_gea_peet_task(flow.id,1,'["Slides covered all agreed topics with reusable examples."]');
 perform public.test_assert(flow.status='pending','Older task proceeds to reviewer Q&A');
 perform set_config('request.jwt.claim.sub',advisor::text,true);
 execute 'reset role'; update public.officer_profiles set access_enabled=false where id=advisor;
 execute 'set local role authenticated';
 perform public.test_assert(not (public.gea_peet_access()->>'reviewer')::boolean,'Disabled reviewer loses access');
 execute 'reset role'; update public.officer_profiles set access_enabled=true where id=advisor;
 execute 'set local role service_role';
 for i in 1..12 loop perform public.test_assert(public.reserve_gea_peet_ai_request(student),'Allowed AI request'); end loop;
 perform public.test_assert(not public.reserve_gea_peet_ai_request(student),'Shared AI rate limit enforced');
end $$;
rollback;
