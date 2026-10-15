-- Run last, after task-editing fixtures, in the disposable local database.
\ir ../supabase/officer-task-submissions.sql
\ir ../supabase/officer-task-submissions.sql
begin;
do $$
declare owner uuid:='11111111-1111-1111-1111-111111111111'; officer uuid:='22222222-2222-2222-2222-222222222222'; written uuid; linked uuid; both_task uuid; blank uuid; cancelled uuid; begin
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',officer::text,true);
 written:=public.save_officer_task('Run leadership meeting','Organize the meeting');
 linked:=public.save_officer_task('Prepare slides');
 both_task:=public.save_officer_task('Present engineering project');
 blank:=public.save_officer_task('Incomplete evidence');
 cancelled:=public.save_officer_task('Cancelled assignment');
 perform public.test_denied(format('select public.submit_officer_task(%L,null,'''')',blank));
 perform public.test_denied(format('select public.submit_officer_task(%L,'''',E'' \n\t '')',blank));
 perform public.test_denied(format('select public.submit_officer_task(%L,null,repeat(''x'',10001))',blank));
 perform public.test_denied(format('select public.submit_officer_task(%L,''javascript:alert(1)'',''Work done'')',blank));
 perform public.test_denied(format('select public.submit_officer_task(%L,''https://user:pass@example.com'',''Work done'')',blank));
 perform public.test_assert((select status='in_progress' and submitted_at is null from public.tasks where id=blank),'Rejected submissions leave task unchanged');
 perform public.submit_officer_task(written,null,E'Led the meeting.\nRecorded decisions and assigned follow-up work.');
 perform public.test_assert((select status='submitted' and final_product_url is null and submitted_at is not null and submission_description like 'Led the meeting.%' and description='Organize the meeting' from public.tasks where id=written),'Description-only submission preserves task instructions and records evidence');
 perform public.submit_officer_task(linked,'https://example.com/slides');
 perform public.test_assert((select status='submitted' and final_product_url='https://example.com/slides' and submission_description='' from public.tasks where id=linked),'Older link-only calls still work');
 perform public.submit_officer_task(both_task,'https://example.com/project','Presented the prototype and answered questions.');
 perform public.test_assert((select final_product_url is not null and submission_description<>'' from public.tasks where id=both_task),'Submissions can contain description and link together');
 perform public.test_denied(format('select public.submit_officer_task(%L,null,''Replacement evidence'')',written));
 perform set_config('request.jwt.claim.sub',owner::text,true);
 perform public.evaluate_officer_task(written,3,3,3,'Meeting expectations');
 perform public.test_assert((select status='completed' and final_product_url is null and submission_description<>'' from public.tasks where id=written),'Written submissions can be evaluated and completed');
 perform public.cancel_officer_task(cancelled,'This work is no longer required.');
 perform set_config('request.jwt.claim.sub',officer::text,true);
 perform public.test_denied(format('select public.submit_officer_task(%L,null,''Cancelled evidence'')',cancelled));
 execute 'reset role';
 perform public.test_assert(exists(select 1 from public.officer_tracking_audit where table_name='tasks' and record_id=written and after_record->>'submission_description' like 'Led the meeting.%'),'Written evidence is retained in the audit log');
end $$;
rollback;
