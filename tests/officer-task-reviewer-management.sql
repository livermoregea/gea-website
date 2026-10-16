-- Run last in the disposable officer fixture database.
\ir ../supabase/officer-task-reviewer-management.sql
\ir ../supabase/officer-task-reviewer-management.sql
begin;
-- Exercise trigger enforcement even if a future policy accidentally allows direct edits.
grant update on public.tasks to authenticated;
create policy reviewer_read_test on public.tasks for select to authenticated using(true);
create policy reviewer_edit_test on public.tasks for update to authenticated using(true) with check(true);
do $$
declare
 reviewer uuid:='11111111-1111-1111-1111-111111111111';
 officer uuid:='22222222-2222-2222-2222-222222222222';
 advisor uuid:='33333333-3333-3333-3333-333333333333';
 today date:=(statement_timestamp() at time zone 'America/Los_Angeles')::date;
 initiative_id uuid; submitted uuid; cancel_id uuid; own_id uuid; request_id uuid;
begin
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',officer::text,true);
 initiative_id:=public.save_officer_task('Officer initiative','Original',today+10);
 submitted:=public.save_officer_task('Submitted initiative','Original',today+10);
 perform public.submit_officer_task(submitted,null,'Completed work description');
 cancel_id:=public.save_officer_task('Cancel initiative','Original',today+10);
 perform public.request_officer_task_cancellation(cancel_id,'This task is no longer needed.');
 perform public.request_officer_task_cancellation(initiative_id,'Please reconsider this assignment.');
 perform public.test_denied(format('select public.end_officer_task(%L,''Officer cannot close own task'')',initiative_id));
 perform public.test_denied(format('update public.tasks set ended_by=%L,end_notes=''Forged completion'',status=''completed'',completed_at=now() where id=%L',officer,initiative_id));
 perform public.test_denied(format('select public.save_officer_task(''Renamed'',''Officer rewrite'',%L,null,%L)',today+10,initiative_id));
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 -- A reviewer can change another officer's self-created deadline beyond +/-3 days.
 perform public.save_officer_task('Reviewer renamed','Reviewer description',today+20,officer,initiative_id);
 perform public.test_assert((select title='Reviewer renamed' and original_due_date=today+10 and due_date=today+20 and created_by=officer from public.tasks where id=initiative_id),'Reviewer edits preserve original creator/deadline');
 perform public.save_officer_task('Submitted edited','Updated assignment after submission',today+20,officer,submitted);
 perform public.test_denied(format('select public.save_officer_task(''Past deadline'','''',%L,%L,%L)',today-1,officer,initiative_id));
 perform public.test_denied(format('select public.end_officer_task(%L,''short'')',initiative_id));
 perform public.end_officer_task(initiative_id,'Reviewer ended this task after priorities changed.');
 perform public.test_assert((select status='completed' and completed_at is not null and ended_by=reviewer and submitted_at is null and submission_description='' from public.tasks where id=initiative_id),'Reviewer ends without fabricated submission');
 perform public.test_assert(not exists(select 1 from public.peet_evaluations where task_id=initiative_id),'Ending adds no PEET score');
 perform public.test_assert((select status='rejected' from public.officer_task_cancellation_requests where task_id=initiative_id),'Ending resolves pending cancellation');
 perform public.test_denied(format('select public.end_officer_task(%L,''Cannot end a completed task twice'')',initiative_id));
 perform public.test_denied(format('select public.save_officer_task(''Closed edit'','''',%L,%L,%L)',today+20,officer,initiative_id));
 perform public.test_denied(format('update public.tasks set end_notes=''Rewritten closure reason'' where id=%L',initiative_id));
 perform public.cancel_officer_task(cancel_id,'Reviewer cancelled directly despite a pending request.');
 perform public.test_assert((select cancelled_at is not null from public.tasks where id=cancel_id),'Reviewer cancels with pending request');
 perform public.test_assert((select status='approved' from public.officer_task_cancellation_requests where task_id=cancel_id),'Direct cancellation resolves request');
 perform public.test_denied(format('select public.end_officer_task(%L,''Cannot end a cancelled task'')',cancel_id));
 own_id:=public.save_officer_task('Reviewer own task','Original',today+10);
 perform public.test_denied(format('select public.end_officer_task(%L,''Cannot close own task directly'')',own_id));
 perform public.test_denied(format('select public.cancel_officer_task(%L,''Cannot cancel own task directly'')',own_id));
 perform set_config('request.jwt.claim.sub',officer::text,true);
 perform public.test_denied(format('select public.save_officer_task(''Unauthorized'','''',%L,null,%L)',today+10,own_id));
 perform public.test_denied(format('update public.tasks set description=''Unauthorized direct rewrite'' where id=%L',own_id));
 perform public.test_denied(format('select public.end_officer_task(%L,''Cannot close another persons task'')',own_id));
 perform public.test_denied(format('select public.cancel_officer_task(%L,''Cannot cancel another persons task'')',own_id));
 perform set_config('request.jwt.claim.sub',advisor::text,true);
 perform public.save_officer_task('Advisor edit','Advisor can manage President tasks',today+20,reviewer,own_id);
 perform public.end_officer_task(own_id,'Advisor ended the President task with a documented reason.');
 -- Disabled reviewers cannot use the new RPC.
 execute 'reset role';
 update public.officer_profiles set access_enabled=false where id=advisor;
 execute 'set local role authenticated';
 perform public.test_denied(format('select public.end_officer_task(%L,''Disabled reviewer cannot end tasks'')',submitted));
 execute 'reset role';
 update public.officer_profiles set access_enabled=true where id=advisor;
 execute 'set local role authenticated';
 -- Submitted evidence remains intact when ending a task.
 perform public.end_officer_task(submitted,'Advisor closed this submitted task without a score.');
 perform public.test_assert((select submission_description='Completed work description' and submitted_at is not null from public.tasks where id=submitted),'Ending preserves existing evidence');
 execute 'reset role';
 perform public.test_assert(exists(select 1 from public.officer_tracking_audit where table_name='tasks' and record_id=initiative_id and action='UPDATE' and actor_id=reviewer),'Reviewer changes remain audited');
end $$;
rollback;
