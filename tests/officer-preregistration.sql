-- Run last in the disposable officer fixture database.
\ir ../supabase/event-participant-assignments.sql
\ir ../supabase/officer-preregistration.sql
\ir ../supabase/officer-preregistration.sql
begin;
do $$
declare owner uuid:='11111111-1111-1111-1111-111111111111'; officer uuid;
 task_id uuid; meeting uuid; service_event uuid; strike uuid; ids uuid[];
begin
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',owner::text,true);
 officer:=public.save_preregistered_officer('Future Officer',' Future.Officer@LVJUSD.ORG ','Secretary');
 perform public.test_assert((select email='future.officer@lvjusd.org' from public.officer_directory() where id=officer),'Pending officers appear in the directory');
 perform public.test_denied('select public.save_preregistered_officer(''Duplicate'',''FUTURE.OFFICER@lvjusd.org'')');
 perform public.test_denied('select public.save_preregistered_officer(''Outside'',''other@example.org'')');
 perform public.save_preregistered_officer('Future Officer Edited','future.officer@lvjusd.org','Secretary',officer);
 ids:=public.assign_officer_tasks(array[officer],'Prepare next meeting','Assigned before signup');task_id:=ids[1];
 meeting:=public.save_officer_event('Past meeting','meeting','2026-2027',now()-interval '3 days',now()-interval '3 days'+interval '1 hour');
 service_event:=public.save_officer_event('Past service','volunteer','2026-2027',now()-interval '2 days',now()-interval '2 days'+interval '1 hour');
 perform public.record_officer_attendance(meeting,officer,'unexcused','Recorded before signup');
 perform public.save_officer_event_assignment(service_event,officer,true,'Setup','Assigned before signup',0);
 perform public.submit_officer_volunteer(service_event,now()-interval '2 days',now()-interval '2 days'+interval '1 hour','Service before signup',officer);
 strike:=public.create_officer_strike(officer,'2026-2027','conduct',current_date,'Concern recorded before signup',now()+interval '2 days');
 perform public.save_officer_accountability_notes(officer,'2026-2027','Notes recorded before signup');
 perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
 perform public.test_denied('select public.save_preregistered_officer(''Unauthorized'',''unauthorized@lvjusd.org'')');
 perform public.test_assert(not exists(select 1 from public.officer_directory() where id=officer),'Pending emails are private from ordinary officers');
 execute 'reset role';
 perform set_config('request.jwt.claim.sub','',true);
 perform public.test_assert(not exists(select 1 from auth.users where id=officer),'No Auth account exists before signup');
 perform public.test_denied(format('insert into auth.users(id,email) values(%L,''wrong@lvjusd.org'')',officer));
 perform public.test_denied('insert into auth.users(id,email) values(gen_random_uuid(),''future.officer@lvjusd.org'')');
 insert into auth.users(id,email) values(officer,'future.officer@lvjusd.org');
 perform public.test_assert((select auth_user_id=officer and pending_email is null from public.officer_profiles where id=officer),'Signup claims the reserved identity');
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',officer::text,true);
 perform public.test_assert(public.has_officer_access() and not public.is_peet_admin(),'Signup grants only the assigned officer permission');
 perform public.test_assert((select count(*)=1 from public.tasks where id=task_id),'Officer sees the pre-signup assignment');
 perform public.test_assert((select status='unexcused' from public.officer_attendance where officer_id=officer and event_id=meeting),'Attendance survives signup');
 perform public.test_assert((select assigned and not committed from public.officer_event_signups where officer_id=officer),'Assignment survives without inventing a signup request');
 perform public.test_assert((select minutes=60 from public.officer_volunteer_logs where officer_id=officer),'Service history survives signup');
 perform public.test_assert((select reason='Concern recorded before signup' from public.officer_strikes where id=strike),'Cuts survive signup');
 perform public.test_assert((select notes='Notes recorded before signup' from public.officer_accountability_notes where officer_id=officer),'Notes survive signup');
 perform public.test_assert((select count(*)=1 from public.officer_profiles),'No duplicate officer identity');
 perform public.test_denied(format('select public.save_preregistered_officer(''Hijack'',''new@lvjusd.org'','''',%L)',officer));
end $$;
rollback;
