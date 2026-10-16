-- Run after reviewer-management fixtures, only in the disposable database.
\ir ../supabase/officer-task-scored-ending.sql
\ir ../supabase/officer-task-scored-ending.sql
begin;
insert into auth.users(id) values('66666666-6666-6666-6666-666666666666');
insert into public.officer_profiles(id,name,role,reviewer_kind) values
 ('66666666-6666-6666-6666-666666666666','Second President','admin','president');
do $$
declare
 officer uuid:='22222222-2222-2222-2222-222222222222';
 reviewer uuid:='11111111-1111-1111-1111-111111111111';
 advisor uuid:='33333333-3333-3333-3333-333333333333';
 president uuid:='66666666-6666-6666-6666-666666666666';
 scored uuid; unscored uuid; president_task uuid;
 today date:=(statement_timestamp() at time zone 'America/Los_Angeles')::date;
begin
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',officer::text,true);
 scored:=public.save_officer_task('Scored completion','',today);
 unscored:=public.save_officer_task('Unscored completion','',today);
 perform public.request_officer_task_cancellation(scored,'Please cancel this task if priorities changed.');
 perform public.test_denied(format('select public.end_officer_task_with_evaluation(%L,''Officer cannot end their own task'',3,3,3)',scored));
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 perform public.test_denied(format('select public.end_officer_task_with_evaluation(%L,''Invalid scores must roll back completion'',0,3,3)',scored));
 perform public.test_denied(format('select public.end_officer_task_with_evaluation(%L,''Missing scores must roll back completion'',3,null,3)',scored));
 perform public.test_assert((select status='in_progress' and ended_by is null from public.tasks where id=scored),'Invalid scores leave task active');
 perform public.test_assert((select status='pending' from public.officer_task_cancellation_requests where task_id=scored),'Invalid scores preserve pending request');
 perform public.end_officer_task_with_evaluation(scored,'Work confirmed and completed by reviewer.',2.5,3,3.5);
 perform public.test_assert((select status='completed' and ended_by=reviewer and submitted_at is null from public.tasks where id=scored),'Scored ending completes without fabricating evidence');
 perform public.test_assert((select efficiency=2.5 and effectiveness=3 and time=3.5 and evaluated_by=reviewer and feedback_notes='Work confirmed and completed by reviewer.' from public.peet_evaluations where task_id=scored),'All scores and feedback saved');
 perform public.test_assert((select status='rejected' from public.officer_task_cancellation_requests where task_id=scored),'Successful completion resolves cancellation request');
 perform public.end_officer_task(unscored,'Task closed without adding performance scores.');
 perform public.test_assert(not exists(select 1 from public.peet_evaluations where task_id=unscored),'Unscored option remains available');
 -- A reviewer without advisor/super-admin privileges cannot score a President.
 president_task:=public.save_officer_task('President work','',today);
 perform set_config('request.jwt.claim.sub',president::text,true);
 perform public.test_denied(format('select public.end_officer_task_with_evaluation(%L,''President requires advisor evaluation'',3,3,3)',president_task));
 perform public.test_assert((select status='in_progress' and ended_by is null from public.tasks where id=president_task),'Forbidden scoring rolls back completion');
 perform set_config('request.jwt.claim.sub',advisor::text,true);
 perform public.end_officer_task_with_evaluation(president_task,'Advisor confirmed the completed President work.',3,3,3);
 perform public.test_assert(exists(select 1 from public.peet_evaluations where task_id=president_task),'Advisor can complete and score President work');
 execute 'reset role';
end $$;
rollback;
