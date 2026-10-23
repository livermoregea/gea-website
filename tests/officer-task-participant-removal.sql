-- Run in a disposable database after officer-individual-contributions.sql.
\ir ../supabase/officer-task-participant-removal.sql
\ir ../supabase/officer-task-participant-removal.sql
begin;
insert into auth.users(id) values ('99999999-9999-4999-8999-999999999999');
insert into public.officer_profiles(id,name,role) values ('99999999-9999-4999-8999-999999999999','Removal teammate','officer');
do $$
declare
 admin_id uuid:='11111111-1111-1111-1111-111111111111';
 creator uuid:='22222222-2222-2222-2222-222222222222';
 advisor uuid:='33333333-3333-3333-3333-333333333333';
 teammate uuid:='99999999-9999-4999-8999-999999999999';
 v_task_id uuid; assigned_id uuid; submitted_id uuid; closed_id uuid; cancelled_id uuid; scored_id uuid;
 today date:=(statement_timestamp() at time zone 'America/Los_Angeles')::date;
begin
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',creator::text,true);
 v_task_id:=public.save_officer_shared_task('Removal project','Original description',today+5,array[creator,teammate,admin_id]);
 submitted_id:=public.save_officer_shared_task('Submitted project','',today+5,array[creator,teammate]);
 closed_id:=public.save_officer_shared_task('Closed project','',today+5,array[creator,teammate]);
 cancelled_id:=public.save_officer_shared_task('Cancelled project','',today+5,array[creator,teammate]);
 perform public.test_denied(format('select public.remove_officer_task_participant(%L,%L)',v_task_id,teammate));
 perform set_config('request.jwt.claim.sub',teammate::text,true);
 perform public.test_denied(format('select public.remove_officer_task_participant(%L,%L)',v_task_id,creator));
 -- Admin participant can remove themselves; independent admins can remove anyone.
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.remove_officer_task_participant(v_task_id,admin_id);
 perform public.test_assert(not exists(select 1 from public.officer_task_members where task_id=v_task_id and officer_id=admin_id),'Admin can remove themselves');
 perform public.test_denied(format('select public.remove_officer_task_participant(%L,%L)',v_task_id,admin_id));
 perform public.remove_officer_task_participant(v_task_id,creator);
 perform public.test_assert((select assigned_to=teammate and created_by=creator and description='Original description' and due_date=today+5 and original_due_date=today+5 from public.tasks where id=v_task_id),'Primary removal transfers assignment and preserves task fields');
 perform public.test_assert(not exists(select 1 from public.officer_task_members m where m.task_id=v_task_id),'New primary no longer duplicated in members');
 perform public.test_denied(format('select public.remove_officer_task_participant(%L,%L)',v_task_id,teammate));
 perform set_config('request.jwt.claim.sub',creator::text,true);
 perform public.test_assert(not exists(select 1 from public.tasks where id=v_task_id),'Removed creator loses task visibility');
 perform public.test_denied(format('select public.save_officer_task(''Removal project'',''Reclaim'',%L,%L,%L)',today+5,creator,v_task_id));
 perform public.test_denied(format('select public.save_officer_shared_task(''Removal project'',''Rejoin'',%L,array[%L,%L]::uuid[],%L)',today+5,creator,teammate,v_task_id));
 perform public.test_denied(format('select public.submit_officer_task(%L,null,''Removed creator cannot submit'')',v_task_id));
 perform public.submit_officer_task(submitted_id,null,'Shared deliverable remains intact.');
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.remove_officer_task_participant(submitted_id,teammate);
 perform public.test_assert((select status='submitted' and submission_description='Shared deliverable remains intact.' from public.tasks where id=submitted_id),'Admin removes teammate after submission without losing evidence');
 assigned_id:=public.assign_officer_collaboration('Admin assigned team','',today+5,array[creator,teammate]);
 perform public.remove_officer_task_participant(assigned_id,teammate);
 perform public.test_assert((select assigned_to=creator from public.tasks where id=assigned_id),'Admin manages admin-assigned collaborations');
 perform public.end_officer_task(closed_id,'Completed project remains historical.');
 perform public.cancel_officer_task(cancelled_id,'Cancelled project remains historical.');
 perform public.test_denied(format('select public.remove_officer_task_participant(%L,%L)',closed_id,teammate));
 perform public.test_denied(format('select public.remove_officer_task_participant(%L,%L)',cancelled_id,teammate));
 -- Removing an unscored teammate completes a collaboration whose remaining
 -- participant is already scored. Historical reflections and scores survive.
 scored_id:=public.assign_officer_collaboration('Scored team','',today+5,array[creator,teammate]);
 perform public.submit_officer_task(scored_id,null,'Scored shared deliverable.');
 execute 'reset role';
 insert into public.gea_peet_tasks(task_id,student_id,student_name,title,description,category,source_context,assessment,assessed_model)
 values(scored_id,teammate,'Removal teammate','Scored team','Historical reflection','Outreach','{}','{"studentQuestions":["What did you do?"]}','fixture');
 insert into public.peet_evaluations(task_id,officer_id,evaluated_by,efficiency,effectiveness,time)
 values(scored_id,creator,admin_id,3,3,3);
 execute 'set local role authenticated';
 perform public.remove_officer_task_participant(scored_id,teammate);
 perform public.test_assert((select status='completed' and completed_at is not null from public.tasks where id=scored_id),'Removing last unscored teammate completes remaining scored work');
 perform public.test_assert(exists(select 1 from public.gea_peet_tasks where task_id=scored_id and student_id=teammate and description='Historical reflection'),'Removed reflection is preserved');
 perform public.test_assert(exists(select 1 from public.peet_evaluations where task_id=scored_id and officer_id=creator and efficiency=3),'Existing score is preserved');
 execute 'reset role';
 perform public.test_assert(exists(select 1 from public.officer_tracking_audit where table_name='officer_task_members' and action='DELETE' and actor_id=admin_id and before_record->>'task_id'=v_task_id::text),'Admin member removal is audited');
 perform public.test_assert(exists(select 1 from public.officer_tracking_audit where table_name='tasks' and action='UPDATE' and actor_id=admin_id and record_id=v_task_id and before_record->>'assigned_to'=creator::text and after_record->>'assigned_to'=teammate::text),'Primary removal is audited');
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',advisor::text,true);
 -- Teachers/advisors can manage people without being eligible task participants.
 assigned_id:=public.assign_officer_collaboration('Advisor managed team','',today+5,array[creator,teammate]);
 execute 'reset role';
 update public.officer_profiles set access_enabled=false where id=advisor;
 execute 'set local role authenticated';
 perform public.test_denied(format('select public.remove_officer_task_participant(%L,%L)',assigned_id,creator));
 execute 'reset role';
 update public.officer_profiles set access_enabled=true where id=advisor;
 execute 'set local role authenticated';
 perform public.remove_officer_task_participant(assigned_id,creator);
 execute 'reset role';
 execute 'set local role anon';
 perform public.test_denied(format('select public.remove_officer_task_participant(%L,%L)',assigned_id,teammate));
 execute 'reset role';
end $$;
rollback;
