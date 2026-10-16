-- Run after officer-task-scored-ending fixtures, only in a disposable database.
\ir ../supabase/officer-shared-tasks.sql
\ir ../supabase/officer-shared-tasks.sql
begin;
insert into auth.users(id) values
 ('66666666-6666-6666-6666-666666666666'),
 ('77777777-7777-7777-7777-777777777777'),
 ('88888888-8888-8888-8888-888888888888');
insert into public.officer_profiles(id,name,role,reviewer_kind) values
 ('66666666-6666-6666-6666-666666666666','Teammate President','admin','president'),
 ('77777777-7777-7777-7777-777777777777','Unrelated Officer','officer',null),
 ('88888888-8888-8888-8888-888888888888','Independent President','admin','president');
do $$
declare
 creator uuid:='22222222-2222-2222-2222-222222222222';
 teammate uuid:='11111111-1111-1111-1111-111111111111';
 independent uuid:='88888888-8888-8888-8888-888888888888';
 advisor uuid:='33333333-3333-3333-3333-333333333333';
 president uuid:='66666666-6666-6666-6666-666666666666';
 outsider uuid:='77777777-7777-7777-7777-777777777777';
 today date:=(statement_timestamp() at time zone 'America/Los_Angeles')::date;
 shared uuid; pending uuid; request_id uuid; before_count integer; undated uuid; no_score uuid; with_score uuid; cancel_team uuid;
begin
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',creator::text,true);
 perform public.test_assert((select count(*)=1 from public.officer_directory()),'Full officer directory stays private');
 perform public.test_assert(exists(select 1 from public.officer_task_teammates() where id=president),'Minimal picker exposes eligible officers');
 perform public.test_assert(not exists(select 1 from public.officer_task_teammates() where id=advisor),'Teachers/advisors excluded from picker');
 shared:=public.save_officer_shared_task('Shared project','Original',today+10,array[creator,teammate,teammate]);
 perform public.test_assert((select count(*)=1 from public.tasks where id=shared),'Only one shared task exists');
 perform public.test_assert((select count(*)=1 from public.officer_task_members where task_id=shared),'Repeated selections are deduplicated');
 perform public.save_officer_shared_task('Shared project','Added President',today+10,array[creator,teammate,president],shared);
 perform public.test_assert((select count(*)=2 from public.officer_task_members where task_id=shared),'Creator can add people to existing self task');
 perform public.save_officer_shared_task('Shared project','Removed teammate',today+10,array[creator,president],shared);
 perform public.test_assert((select count(*)=1 from public.officer_task_members where task_id=shared),'Creator can remove additional people before submission');
 -- A removed ordinary teammate loses access; admin teammates retain reviewer access.
 perform public.save_officer_shared_task('Shared project','Add temporary ordinary teammate',today+10,array[creator,outsider,president],shared);
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform public.test_assert(exists(select 1 from public.tasks where id=shared),'Ordinary teammate can read while added');
 perform set_config('request.jwt.claim.sub',creator::text,true);
 perform public.save_officer_shared_task('Shared project','Remove temporary teammate',today+10,array[creator,president],shared);
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform public.test_assert(not exists(select 1 from public.tasks where id=shared),'Removed ordinary teammate loses access');
 perform set_config('request.jwt.claim.sub',creator::text,true);
 perform public.save_officer_shared_task('Shared project','Team restored',today+10,array[creator,teammate,president],shared);
 perform public.test_denied(format('select public.save_officer_shared_task(''Shared project'','''',%L,array[%L]::uuid[],%L)',today+10,teammate,shared));
 perform public.test_denied(format('select public.save_officer_shared_task(''Invalid person'','''',%L,array[%L,%L]::uuid[])',today+10,creator,advisor));
 perform public.test_denied(format('select public.save_officer_shared_task(''Past date'','''',%L,array[%L]::uuid[])',today-1,creator));
 perform public.test_denied(format('select public.save_officer_shared_task(''Renamed'','''',%L,array[%L]::uuid[],%L)',today+10,creator,shared));
 undated:=public.save_officer_shared_task('No date','',null,array[creator,teammate]);
 perform public.save_officer_shared_task('No date','Can add people without adding a deadline',null,array[creator,teammate,president],undated);
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform public.test_assert(not exists(select 1 from public.tasks where id=shared),'Unrelated officer cannot read shared task');
 perform public.test_assert(not exists(select 1 from public.officer_task_members where task_id=shared),'Unrelated officer cannot read people');
 perform public.test_denied(format('select public.submit_officer_task(%L,null,''Unauthorized evidence'')',shared));
 perform public.test_denied(format('select public.save_officer_shared_task(''Shared project'',''Hijack'',%L,array[%L]::uuid[],%L)',today+10,outsider,shared));
 perform set_config('request.jwt.claim.sub',president::text,true);
 perform public.test_assert(exists(select 1 from public.tasks where id=shared),'Added officer sees same task');
 perform public.test_denied(format('select public.end_officer_task(%L,''A participant cannot close shared work'')',shared));
 perform public.test_denied(format('select public.cancel_officer_task(%L,''A participant cannot cancel shared work'')',shared));
 perform public.request_officer_task_cancellation(shared,'Team needs to revisit the project scope.');
 select id into request_id from public.officer_task_cancellation_requests where task_id=shared;
 perform public.test_denied(format('select public.review_officer_task_cancellation(%L,''approved'',''Participant cannot approve team cancellation'')',request_id));
 perform public.test_denied(format('select public.save_officer_shared_task(''Shared project'',''Cannot change team'',%L,array[%L]::uuid[],%L)',today+10,president,shared));
 perform public.submit_officer_task(shared,null,'One shared submission from a teammate.');
 perform public.test_denied(format('select public.submit_officer_task(%L,null,''Duplicate team submission'')',shared));
 perform set_config('request.jwt.claim.sub',creator::text,true);
 perform public.test_assert((select submission_description='One shared submission from a teammate.' and status='submitted' from public.tasks where id=shared),'Creator sees shared submission and status');
 perform public.test_denied(format('select public.save_officer_shared_task(''Shared project'',''Cannot change members after submission'',%L,array[%L]::uuid[],%L)',today+10,creator,shared));
 perform set_config('request.jwt.claim.sub',teammate::text,true);
 perform public.test_denied(format('select public.evaluate_officer_task(%L,3,3,3,''Participant cannot evaluate own team'')',shared));
 perform set_config('request.jwt.claim.sub',independent::text,true);
 perform public.test_denied(format('select public.evaluate_officer_task(%L,3,3,3,''A teammate President requires advisor evaluation'')',shared));
 perform public.test_denied(format('select public.save_officer_task(''Shared project'','''',%L,%L,%L)',today+10,outsider,shared));
 perform set_config('request.jwt.claim.sub',advisor::text,true);
 perform public.evaluate_officer_task(shared,3,3,3,'One evaluation shared across the team.');
 perform public.test_assert((select count(*)=1 from public.peet_evaluations where task_id=shared),'Exactly one shared evaluation');
 perform set_config('request.jwt.claim.sub',creator::text,true);
 perform public.test_assert((select efficiency=3 from public.peet_evaluations where task_id=shared),'Creator sees evaluation');
 perform set_config('request.jwt.claim.sub',president::text,true);
 perform public.test_assert((select efficiency=3 from public.peet_evaluations where task_id=shared),'Added officer sees same evaluation');
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform public.test_assert(not exists(select 1 from public.peet_evaluations where task_id=shared),'Evaluation remains private from unrelated officers');
 perform set_config('request.jwt.claim.sub',creator::text,true);
 no_score:=public.save_officer_shared_task('End unscored','',today,array[creator,president]);
 with_score:=public.save_officer_shared_task('End scored','',today,array[creator,president]);
 cancel_team:=public.save_officer_shared_task('Cancel shared','',today,array[creator,president]);
 perform set_config('request.jwt.claim.sub',president::text,true);
 perform public.request_officer_task_cancellation(cancel_team,'Team request for cancellation review.');
 perform set_config('request.jwt.claim.sub',independent::text,true);
 perform public.test_denied(format('select public.end_officer_task_with_evaluation(%L,''Advisor must score a President teammate'',3,3,3)',with_score));
 perform public.test_assert((select status='in_progress' from public.tasks where id=with_score),'Unauthorized scored completion rolls back for whole team');
 perform set_config('request.jwt.claim.sub',advisor::text,true);
 perform public.end_officer_task(no_score,'Team work closed without a performance score.');
 perform public.end_officer_task_with_evaluation(with_score,'Advisor confirms team work and scores.',3,3,3);
 perform public.cancel_officer_task(cancel_team,'Shared project cancelled for the whole team.');
 perform public.test_assert(not exists(select 1 from public.peet_evaluations where task_id=no_score),'Shared unscored ending has no evaluation');
 perform public.test_assert((select count(*)=1 from public.peet_evaluations where task_id=with_score),'Shared scored ending has one evaluation');
 perform set_config('request.jwt.claim.sub',creator::text,true);
 perform public.test_assert((select cancelled_at is not null from public.tasks where id=cancel_team),'Shared cancellation closes for creator');
 perform public.test_denied(format('select public.save_officer_shared_task(''Cancel shared'',''Cannot edit team after cancellation'',%L,array[%L]::uuid[],%L)',today,creator,cancel_team));
 execute 'reset role';
 update public.officer_profiles set access_enabled=false where id=outsider;
 execute 'set local role authenticated';
 perform public.test_denied(format('select public.save_officer_shared_task(''Disabled person'','''',%L,array[%L,%L]::uuid[])',today,creator,outsider));
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform public.test_assert(not exists(select 1 from public.officer_task_teammates()),'Disabled officer cannot browse picker');
 execute 'reset role';
 -- Simulate accidental future grants. The membership trigger still blocks tampering.
 grant insert,update,delete on public.officer_task_members to authenticated;
 create policy shared_members_test on public.officer_task_members for all to authenticated using(true) with check(true);
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',president::text,true);
 perform public.test_denied(format('insert into public.officer_task_members(task_id,officer_id) values(%L,%L)',undated,outsider));
 perform public.test_denied(format('delete from public.officer_task_members where task_id=%L',undated));
 perform set_config('request.jwt.claim.sub',creator::text,true);
 perform public.test_denied(format('delete from public.officer_task_members where task_id=%L',shared));
 execute 'reset role';
 perform public.test_assert(exists(select 1 from public.officer_tracking_audit where table_name='officer_task_members' and action='INSERT' and actor_id=creator),'Participant additions audited');
 perform public.test_assert(exists(select 1 from public.officer_tracking_audit where table_name='officer_task_members' and action='DELETE' and actor_id=creator),'Participant removals audited');
end $$;
rollback;
