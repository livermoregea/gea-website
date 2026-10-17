-- Run after the existing officer-shared-tasks fixtures, in a disposable database only.
-- The minimal admin fixture needs an applications table for scheduled digest coverage.
create table if not exists public.applications(id uuid primary key default gen_random_uuid(),status text not null default 'pending');
create table if not exists public.profile_change_requests(id uuid primary key default gen_random_uuid(), requested_by_name text, status text);
create table if not exists public.builder_submissions(id uuid primary key default gen_random_uuid(), title text, status text);
create table if not exists public.qa_questions(id uuid primary key default gen_random_uuid(), status text);
create table if not exists public.qa_answers(id uuid primary key default gen_random_uuid(), status text);
\ir ../supabase/gea-operations.sql
\ir ../supabase/gea-operations.sql
begin;
insert into auth.users(id,email) values('77777777-7777-7777-7777-777777777777','secretary@example.test'),('88888888-8888-8888-8888-888888888888','ordinary@example.test'),('99999999-9999-9999-9999-999999999999','disabled@example.test');
insert into public.officer_profiles(id,name,role,position,access_enabled) values
 ('77777777-7777-7777-7777-777777777777','Secretary','officer','Secretary',true),
 ('88888888-8888-8888-8888-888888888888','Ordinary officer','officer','Treasurer',true),
 ('99999999-9999-9999-9999-999999999999','Disabled secretary','officer','Secretary',false);
do $$ declare
 advisor uuid:='11111111-1111-1111-1111-111111111111'; secretary uuid:='77777777-7777-7777-7777-777777777777';
 ordinary uuid:='88888888-8888-8888-8888-888888888888'; disabled uuid:='99999999-9999-9999-9999-999999999999';
 meeting uuid; future_meeting uuid; service uuid; task uuid; agenda uuid; action uuid; item uuid; other_task uuid; count_before integer;
begin
 execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',advisor::text,true);
 meeting:=public.save_officer_event('Operations test meeting','meeting','2026-2027',now()-interval '2 hours',now()-interval '1 hour');
 future_meeting:=public.save_officer_event('Future meeting','meeting','2026-2027',now()+interval '1 day',now()+interval '1 day 1 hour');
 service:=public.save_officer_event('Operations service','volunteer','2026-2027',now()+interval '1 day',now()+interval '1 day 1 hour');
 perform public.record_officer_attendance(meeting,ordinary,'late','Private reviewer note');
 task:=public.save_officer_task('Private task','Private description',null,ordinary);
 other_task:=public.save_officer_task('Secretary task','',null,secretary);
 perform set_config('request.jwt.claim.sub',ordinary::text,true);
 perform public.test_denied(format('select * from public.meeting_roll_call(%L)',meeting));
 perform public.test_denied(format('select public.save_meeting_notes(%L,''Secret notes'','''',0)',meeting));
 perform public.add_meeting_agenda(meeting,'Discuss outreach','Prepare posters');
 perform public.save_task_blocker(task,'Need poster supplies',secretary);
 perform public.set_gea_digest(true);
 perform public.save_gea_digest('[{"title":"Private task","href":"/officerboard","detail":"Due soon"}]');
 perform public.test_denied('select public.save_gea_digest(''[{"title":"Bad","href":"javascript:alert(1)"}]'')');
 perform public.test_denied('select public.refresh_gea_weekly_digests()');
 perform set_config('request.jwt.claim.sub',secretary::text,true);
 perform public.test_assert(public.can_manage_meetings(),'Secretary can manage meetings');
 perform public.test_assert(not public.is_peet_admin(),'Secretary remains an ordinary officer');
 perform public.test_assert(exists(select 1 from public.meeting_roll_call(meeting) where officer_id=ordinary and status='late'),'Secretary sees safe roll call');
 perform public.test_assert(not exists(select 1 from public.officer_attendance where officer_id=ordinary),'Secretary cannot read private absence/reviewer notes');
 perform public.test_assert(not exists(select 1 from public.tasks where id=task),'Secretary cannot read other tasks');
 perform public.test_assert(exists(select 1 from public.gea_task_blockers where task_id=task),'Selected helper sees the help request');
 perform public.test_assert(not exists(select 1 from public.gea_weekly_digests),'Other officers digests stay private');
 perform public.save_meeting_notes(meeting,'Discussion notes','Hold outreach event',0);
 perform public.test_denied(format('select public.save_meeting_notes(%L,''Stale edit'','''',0)',meeting));
 perform public.save_meeting_attendance(meeting,jsonb_build_array(jsonb_build_object('officer_id',ordinary,'status','present','original_status','late')));
 perform public.test_assert(exists(select 1 from public.meeting_roll_call(meeting) where officer_id=ordinary and status='present'),'Secretary can record attendance');
 perform public.test_denied(format('select public.save_meeting_attendance(%L,%L::jsonb)',meeting,jsonb_build_array(jsonb_build_object('officer_id',ordinary,'status','late','original_status','late'))));
 perform public.test_denied(format('select public.save_meeting_attendance(%L,%L::jsonb)',future_meeting,jsonb_build_array(jsonb_build_object('officer_id',ordinary,'status','present','original_status','unmarked'))));
 perform public.test_denied(format('select public.save_meeting_attendance(%L,%L::jsonb)',service,jsonb_build_array(jsonb_build_object('officer_id',ordinary,'status','present','original_status','unmarked'))));
 select id into agenda from public.gea_agenda_items where event_id=meeting;
 action:=public.assign_agenda_action(agenda,ordinary,null);
 perform public.test_denied(format('select public.assign_agenda_action(%L,%L,null)',agenda,ordinary));
 perform public.test_denied(format('select public.evaluate_officer_task(%L,4,4,4,''Secretary cannot evaluate'')',task));
 perform public.test_denied(format('select public.save_event_plan(%L,%L,'''','''','''',0)',service,secretary));
 perform public.test_denied(format('select public.save_task_blocker(%L,''Not a participant'',null)',task));
 perform public.test_denied(format('update public.gea_meeting_notes set minutes=''Bypassed RPC'' where event_id=%L',meeting));
 perform public.test_denied(format('insert into public.gea_notification_reads(user_id,notification_key) values(%L,''forged'')',ordinary));
 perform public.mark_gea_notifications(array['event:test']);
 perform public.test_assert((select count(*)=1 from public.gea_notification_reads),'Read status saved for caller');
 perform set_config('request.jwt.claim.sub',advisor::text,true);
 perform public.test_assert((select reviewer_notes='Private reviewer note' from public.officer_attendance where officer_id=ordinary and event_id=meeting),'Secretary saves preserve reviewer notes');
 perform public.test_assert(exists(select 1 from public.tasks where id=action and assigned_to=ordinary and created_by=secretary),'Agenda creates task with correct ownership');
 perform public.test_assert(exists(select 1 from public.officer_tracking_audit where table_name='gea_meeting_notes'),'Meeting changes audited');
 perform public.save_event_plan(service,ordinary,'Two greeters','Posters','',0);
 perform set_config('request.jwt.claim.sub',ordinary::text,true);
 perform public.save_event_plan(service,ordinary,'Three greeters','Posters','Successful event',1);
 perform public.test_denied(format('select public.save_event_plan(%L,%L,'''','''','''',1)',service,ordinary));
 perform public.test_denied(format('select public.save_event_plan(%L,%L,'''','''','''',2)',service,secretary));
 perform public.save_event_checklist(service,'Bring posters');
 select id into item from public.gea_event_checklist where event_id=service;
 perform public.save_event_checklist(service,'Bring posters',true,item);
 perform public.test_assert((select done from public.gea_event_checklist where id=item),'Organizer can check off preparation');
 perform public.save_task_blocker(task,'Supplies obtained',secretary,true);
 perform public.test_assert((select resolved_at is not null from public.gea_task_blockers where task_id=task),'Participant can resolve blocker');
 perform public.test_assert(not exists(select 1 from public.gea_notification_reads),'Read status isolated across accounts');
 perform set_config('request.jwt.claim.sub',disabled::text,true);
 perform public.test_assert(not public.can_manage_meetings(),'Disabled secretary loses meeting access');
 perform public.test_denied(format('select public.save_meeting_notes(%L,''No access'','''',1)',meeting));
 perform public.test_assert(not exists(select 1 from public.gea_meeting_notes),'Disabled officer cannot read shared notes');
 execute 'reset role';
 execute 'set local role service_role';
 perform public.test_assert(public.refresh_gea_weekly_digests()=0,'Scheduled digest is idempotent in the same week');
 execute 'reset role';
 delete from public.gea_weekly_digests where user_id=ordinary;
 execute 'set local role service_role';
 perform public.test_assert(public.refresh_gea_weekly_digests()=1,'Scheduler creates an opted-in weekly digest');
 execute 'reset role';
end $$;
rollback;
