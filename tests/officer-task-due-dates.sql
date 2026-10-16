-- Run in the disposable database after officer-task-submissions fixtures.
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select public.save_officer_task('Historical overdue task','Original',
 (statement_timestamp() at time zone 'America/Los_Angeles')::date-10) as historical_task_id \gset
\ir ../supabase/officer-task-due-dates.sql
\ir ../supabase/officer-task-due-dates.sql
begin;
select public.save_officer_task('Historical overdue task','Updated description',
 (statement_timestamp() at time zone 'America/Los_Angeles')::date-10,null,:'historical_task_id');
do $$
declare
 officer uuid:='22222222-2222-2222-2222-222222222222';
 today date:=(statement_timestamp() at time zone 'America/Los_Angeles')::date;
 task_id uuid;
begin
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',officer::text,true);
 task_id:=public.save_officer_task('Due today','',today);
 perform public.test_assert((select due_date=today from public.tasks where id=task_id),'Today is allowed');
 perform public.save_officer_task('Due today','',today+1,null,task_id);
 perform public.test_denied(format('select public.save_officer_task(''Due today'','''',%L,null,%L)',today-1,task_id));
 perform public.test_denied(format('select public.save_officer_task(''Past task'','''',%L)',today-1));
 perform public.test_denied(format('select public.assign_officer_tasks(array[%L]::uuid[],''Past batch'','''',%L)',officer,today-1));
 perform public.save_officer_task('Future task','',today+10);
 perform public.save_officer_task('Optional deadline');
 execute 'reset role';
 perform public.test_denied(format('update public.tasks set due_date=%L where id=%L',today-1,task_id));
 perform public.test_denied(format('insert into public.tasks(title,due_date,assigned_to,created_by) values(''Past direct'',%L,%L,%L)',today-1,officer,officer));
end $$;
rollback;
