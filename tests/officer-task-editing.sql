-- Run last in the disposable database after officer-task-followthrough fixtures.
\ir ../supabase/officer-task-editing.sql
\ir ../supabase/officer-task-editing.sql
begin;
-- Simulate an accidental future grant/policy to verify the trigger still guards writes.
grant update on public.tasks to authenticated;
create policy task_edit_test on public.tasks for update to authenticated using(true) with check(true);
do $$
declare owner uuid:='11111111-1111-1111-1111-111111111111'; officer uuid:='22222222-2222-2222-2222-222222222222'; teacher uuid:='33333333-3333-3333-3333-333333333333'; assigned uuid; own uuid; undated uuid; begin
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',owner::text,true);
 assigned:=public.save_officer_task('Assigned task','Original','2026-11-10',officer);
 perform public.save_officer_task('Assigned task updated','Updated by assigner','2026-11-20',officer,assigned);
 perform public.test_assert((select due_date='2026-11-20' and original_due_date='2026-11-10' from public.tasks where id=assigned),'Assigner can edit assignment and original deadline is preserved');
 perform set_config('request.jwt.claim.sub',officer::text,true);
 perform public.test_denied(format('select public.save_officer_task(''Assigned task updated'',''Tampered'',''2026-11-20'',null,%L)',assigned));
 perform public.test_denied(format('update public.tasks set description=''Direct tampering'' where id=%L',assigned));
 own:=public.save_officer_task('Self-created','Original','2026-11-10');
 perform public.save_officer_task('Self-created','Plus three days','2026-11-13',null,own);
 perform public.test_assert((select description='Plus three days' and due_date='2026-11-13' from public.tasks where id=own),'Self-created task description and +3 deadline allowed');
 perform public.test_denied(format('select public.save_officer_task(''Self-created'',''Repeated extension'',''2026-11-14'',null,%L)',own));
 perform public.save_officer_task('Self-created','Minus three days','2026-11-07',null,own);
 perform public.test_denied(format('select public.save_officer_task(''Self-created'',''Too early'',''2026-11-06'',null,%L)',own));
 perform public.test_denied(format('select public.save_officer_task(''Renamed'',''Changed'',''2026-11-10'',null,%L)',own));
 perform public.test_denied(format('select public.save_officer_task(''Self-created'',''Remove deadline'',null,null,%L)',own));
 perform public.test_denied(format('update public.tasks set original_due_date=''2026-11-20'' where id=%L',own));
 perform public.test_denied(format('update public.tasks set created_by=%L where id=%L',owner,own));
 perform public.test_denied(format('update public.tasks set due_date=''2026-11-14'' where id=%L',own));
 undated:=public.save_officer_task('No deadline');
 perform public.save_officer_task('No deadline','Description update',null,null,undated);
 perform public.test_denied(format('select public.save_officer_task(''No deadline'',''Add date'',''2026-11-10'',null,%L)',undated));
 perform public.submit_officer_task(own,'https://example.com/own');
 perform public.test_denied(format('select public.save_officer_task(''Self-created'',''Submitted rewrite'',''2026-11-10'',null,%L)',own));
 perform public.submit_officer_task(assigned,'https://example.com/assigned');
 perform public.test_denied(format('select public.save_officer_task(''Assigned task updated'',''Submitted assignee edit'',''2026-11-20'',null,%L)',assigned));
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 perform public.test_denied(format('select public.save_officer_task(''Assigned task updated'',''Unrelated super admin edit'',''2026-11-20'',%L,%L)',officer,assigned));
 perform set_config('request.jwt.claim.sub',owner::text,true);
 perform public.save_officer_task('Assigned task updated','Assigner correction','2026-11-21',officer,assigned);
 perform public.evaluate_officer_task(assigned,3,3,3,'Meets expectations');
 perform public.test_denied(format('select public.save_officer_task(''Assigned task updated'',''Completed rewrite'',''2026-11-21'',%L,%L)',officer,assigned));
 execute 'reset role';
 perform public.test_assert(exists(select 1 from public.officer_tracking_audit where table_name='tasks' and record_id=own and action='UPDATE'),'Edits remain audited');
end $$;
rollback;
