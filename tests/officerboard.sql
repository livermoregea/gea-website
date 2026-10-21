-- Run only in a disposable, empty local PostgreSQL database.
-- psql -v ON_ERROR_STOP=1 -f tests/officerboard.sql
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- Emulate Supabase's default grants, which the migration must revoke.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
\ir ../supabase/officerboard.sql
\ir ../supabase/officerboard.sql

insert into auth.users values
 ('11111111-1111-1111-1111-111111111111'),
 ('22222222-2222-2222-2222-222222222222'),
 ('33333333-3333-3333-3333-333333333333'),
 ('44444444-4444-4444-4444-444444444444');
insert into public.officer_profiles(id,name,role) values
 ('11111111-1111-1111-1111-111111111111','Advisor','admin'),
 ('22222222-2222-2222-2222-222222222222','Officer A','officer'),
 ('33333333-3333-3333-3333-333333333333','Officer B','officer');

create function public.test_assert(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', message; end if; end $$;
create function public.test_denied(command text) returns void language plpgsql as $$
begin
  begin execute command; raise exception 'FAIL: unauthorized operation succeeded: %', command;
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
end $$;

begin;
do $$
declare task_a uuid; task_b uuid; assigned uuid; eval_id uuid; completion timestamptz;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
  task_a := public.save_officer_task('Prepare meeting','Agenda and slides','2026-11-01');
  perform public.test_assert((select count(*) = 1 from public.officer_profiles), 'Officer sees only own profile');
  perform public.test_assert((select assigned_to = auth.uid() and created_by = auth.uid() and status = 'in_progress' from public.tasks where id = task_a), 'Creation derives identity and starts in progress');
  perform public.test_denied('update public.officer_profiles set role = ''admin''');
  perform public.test_denied('insert into public.officer_profiles(id,name,role) values (auth.uid(),''Me'',''admin'')');
  perform public.test_denied('select public.save_officer_task(''Forged'','''',null,''33333333-3333-3333-3333-333333333333'')');
  perform public.test_denied('select public.save_officer_task(''   '')');
  perform public.test_denied(format('update public.tasks set status = ''completed'' where id = %L', task_a));
  perform public.test_denied(format('select public.evaluate_officer_task(%L,4,4,4)',task_a));
  perform public.test_denied(format('select public.submit_officer_task(%L,''javascript:alert(1)'')',task_a));
  perform public.test_denied(format('select public.submit_officer_task(%L,''https://user:pass@example.com/work'')',task_a));
  perform public.test_denied(format('select public.submit_officer_task(%L,null)',task_a));
  perform public.save_officer_task('Meeting agenda','Updated details','2026-11-02',null,task_a);
  perform public.test_assert((select title = 'Meeting agenda' from public.tasks where id = task_a), 'Officer can edit in progress');

  perform set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
  perform public.test_assert((select count(*) = 0 from public.tasks), 'Officer B cannot read A tasks');
  perform public.test_denied(format('select public.save_officer_task(''Hijack'','''',null,null,%L)',task_a));
  perform public.test_denied(format('select public.submit_officer_task(%L,''https://example.com'')',task_a));
  perform public.test_denied(format('select public.delete_officer_task(%L)',task_a));
  task_b := public.save_officer_task('Temporary task');
  perform public.delete_officer_task(task_b);
  perform public.test_assert((select count(*) = 0 from public.tasks), 'Officer can delete own in-progress task');

  perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
  perform public.submit_officer_task(task_a,'https://example.com/agenda');
  perform public.test_assert((select status = 'submitted' and submitted_at is not null from public.tasks where id = task_a), 'Submission records time and status');
  perform public.test_denied(format('select public.submit_officer_task(%L,''https://example.com/new'')',task_a));
  perform public.test_denied(format('select public.save_officer_task(''Rewrite'','''',null,null,%L)',task_a));
  perform public.test_denied(format('select public.delete_officer_task(%L)',task_a));
  perform public.test_denied(format('insert into public.peet_evaluations(task_id,evaluated_by,efficiency,effectiveness,time) values (%L,auth.uid(),4,4,4)',task_a));

  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
  perform public.test_assert((select count(*) = 3 from public.officer_profiles), 'Reviewer can read roster');
  perform public.test_assert((select count(*) = 1 from public.tasks), 'Reviewer can read submitted tasks');
  assigned := public.save_officer_task('Assigned project','Deliver model',null,'33333333-3333-3333-3333-333333333333');
  perform public.test_assert((select created_by = auth.uid() and assigned_to <> auth.uid() from public.tasks where id = assigned), 'Reviewer assigns tasks with own creator identity');
  perform public.test_denied(format('select public.evaluate_officer_task(%L,3,3,3)',assigned));
  perform public.test_denied(format('select public.evaluate_officer_task(%L,0.9,3,3)',task_a));
  perform public.test_denied(format('select public.evaluate_officer_task(%L,3,4.1,3)',task_a));
  perform public.test_denied(format('select public.evaluate_officer_task(%L,3,3,null)',task_a));
  perform public.test_assert((select count(*) = 0 from public.peet_evaluations), 'Invalid evaluation writes nothing');
  perform public.test_assert((select status = 'submitted' from public.tasks where id = task_a), 'Invalid evaluation does not complete task');
  perform public.evaluate_officer_task(task_a,3,3,3,'Meets expectations.');
  select id into eval_id from public.peet_evaluations where task_id = task_a;
  select completed_at into completion from public.tasks where id = task_a;
  perform public.test_assert((select status = 'completed' and completed_at is not null from public.tasks where id = task_a), 'Evaluation completes task atomically');
  perform public.test_assert((select case when (efficiency+effectiveness+time)/3 <= 3 then 85+20*((efficiency+effectiveness+time)/3-3) else 85+15*((efficiency+effectiveness+time)/3-3) end = 85 from public.peet_evaluations where task_id = task_a), 'Standard score equals 85');
  perform public.evaluate_officer_task(task_a,4,3.5,3.3,'Updated evaluation.');
  perform public.test_assert((select count(*) = 1 from public.peet_evaluations), 'Adjustment keeps one evaluation per task');
  perform public.test_assert((select id = eval_id and evaluated_by = auth.uid() and feedback_notes = 'Updated evaluation.' from public.peet_evaluations where task_id = task_a), 'Adjustment replaces scores and reviewer feedback');
  perform public.test_assert((select completed_at = completion from public.tasks where id = task_a), 'Adjustment preserves completion date');

  perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
  perform public.test_assert((select count(*) = 1 from public.peet_evaluations), 'Officer can read own evaluation');
  perform public.test_denied('update public.peet_evaluations set efficiency = 4');
  perform set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
  perform public.test_assert((select count(*) = 0 from public.peet_evaluations), 'Officer cannot read other evaluations');

  perform set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
  perform public.test_assert((select count(*) = 0 from public.tasks), 'Unapproved account reads no tasks');
  perform public.test_assert((select count(*) = 0 from public.officer_profiles), 'Unapproved account reads no roster');
  perform public.test_denied('select public.save_officer_task(''Unapproved'')');
  perform public.test_denied(format('select public.evaluate_officer_task(%L,4,4,4)',task_a));
  perform public.test_denied('insert into public.officer_profiles(id,name) values(auth.uid(),''Me'')');

  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub','',true);
  perform public.test_denied('select * from public.tasks');
  perform public.test_denied('select * from public.peet_evaluations');
  perform public.test_denied('select public.save_officer_task(''Anonymous'')');
  perform public.test_denied(format('select public.evaluate_officer_task(%L,4,4,4)',task_a));
  execute 'reset role';
  update public.officer_profiles set role = 'officer' where id = '11111111-1111-1111-1111-111111111111';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
  perform public.test_assert(not public.is_peet_admin(), 'Reviewer removal takes effect immediately');
  perform public.test_assert((select count(*) = 0 from public.tasks), 'Former reviewer cannot read others’ tasks');
  perform public.test_denied(format('select public.evaluate_officer_task(%L,4,4,4)',task_a));
  execute 'reset role';
  update public.officer_profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
  execute 'set local role authenticated';
  perform public.delete_officer_task(task_a);
  perform public.test_assert((select count(*) = 0 from public.peet_evaluations), 'Reviewer delete cascades evaluation');
  perform public.delete_officer_task(assigned);
end $$;
rollback;
