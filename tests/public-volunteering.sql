-- Disposable local fixture DB only, after super-admin and officer fixtures.
\ir ../supabase/public-volunteering.sql
\ir ../supabase/public-volunteering.sql
begin;
insert into auth.users(id,email) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','volunteer.a@lvjusd.org'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','volunteer.b@lvjusd.org');
do $$
declare owner uuid:='11111111-1111-1111-1111-111111111111';
 volunteer_a uuid:='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';volunteer_b uuid:='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 event_id uuid; draft_id uuid; closed_id uuid; past_id uuid; officer_public_id uuid; private_event_id uuid; signup_id uuid; old_officer_logs integer; old_officer_attendance integer; old_officer_signups integer;
begin
 select count(*) into old_officer_logs from public.officer_volunteer_logs;
 select count(*) into old_officer_attendance from public.officer_attendance;
 select count(*) into old_officer_signups from public.officer_event_signups;
 execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',owner::text,true);
 private_event_id:=public.save_officer_event('Leadership only','volunteer','2026-2027',now()+interval '2 days',now()+interval '2 days 1 hour');
 event_id:=public.save_public_volunteer_event('Community cleanup','All GEA One members welcome','Park',now()+interval '2 days',now()+interval '2 days 2 hours','published',true,1);
 draft_id:=public.save_public_volunteer_event('Private draft','','',now()+interval '3 days',now()+interval '3 days 1 hour');
 closed_id:=public.save_public_volunteer_event('Closed signup','','',now()+interval '2 days',now()+interval '2 days 1 hour','published',false);
 past_id:=public.save_public_volunteer_event('Past community event','','',now()-interval '2 days',now()-interval '2 days'+interval '1 hour','published');
 officer_public_id:=public.save_public_volunteer_event('Officer joining public service','','',now()+interval '3 days',now()+interval '3 days 1 hour','published');
 perform public.set_public_volunteer_signup(officer_public_id,true,'Officer as public volunteer');
 perform public.test_denied('select public.save_public_volunteer_event(''Invalid dates'','''','''',now(),now())');
 execute 'set local role anon';perform set_config('request.jwt.claim.sub','',true);
 perform public.test_assert((select count(*)=4 from public.public_volunteer_events),'Public listings show only published public events');
 perform public.test_denied(format('select public.set_public_volunteer_signup(%L,true,''Anonymous'')',event_id));
 perform public.test_denied('select * from public.public_volunteer_signups');
 execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',volunteer_a::text,true);
 perform public.test_assert(not public.has_officer_access(),'Non-leadership member has no officer access');
 perform public.test_assert(not exists(select 1 from public.officer_events where id=private_event_id),'Leadership-only events are hidden from non-officers');
 perform public.test_denied(format('select public.set_public_volunteer_signup(%L,true,''Volunteer'')',private_event_id));
 perform public.test_denied(format('select public.set_officer_event_signup(%L,true)',private_event_id));
 perform public.test_assert(not exists(select 1 from public.public_volunteer_events where id=draft_id),'Draft public events are hidden');
 perform public.test_denied(format('select public.set_public_volunteer_signup(%L,true,''Volunteer'')',draft_id));
 perform public.test_denied(format('select public.set_public_volunteer_signup(%L,true,''Volunteer'')',closed_id));
 perform public.test_denied(format('select public.set_public_volunteer_signup(%L,true,''Volunteer'')',past_id));
 perform public.test_denied('select public.save_public_volunteer_event(''Forged'','''','''',now(),now()+interval ''1 hour'')');
 perform public.set_public_volunteer_signup(event_id,true,'Volunteer A');
 perform public.set_public_volunteer_signup(event_id,true,'Repeat signup');
 perform public.test_assert((select count(*)=1 from public.public_volunteer_signups),'Repeat signup is idempotent');
 select id into signup_id from public.public_volunteer_signups where user_id=volunteer_a;
 perform public.test_assert((select email='volunteer.a@lvjusd.org' and user_id=volunteer_a from public.public_volunteer_signups where id=signup_id),'Identity and email come from the signed-in account');
 perform public.test_denied(format('select public.record_public_volunteer_attendance(%L,''present'',60,'''',1)',signup_id));
 perform public.test_denied(format('update public.public_volunteer_signups set attendance=''present'' where id=%L',signup_id));
 perform set_config('request.jwt.claim.sub',volunteer_b::text,true);
 perform public.test_assert((select count(*)=0 from public.public_volunteer_signups),'Volunteers cannot see other volunteers or emails');
 perform public.test_denied(format('select public.set_public_volunteer_signup(%L,true,''Volunteer B'')',event_id));
 perform set_config('request.jwt.claim.sub',volunteer_a::text,true);
 perform public.set_public_volunteer_signup(event_id,false);
 perform set_config('request.jwt.claim.sub',volunteer_b::text,true);
 perform public.set_public_volunteer_signup(event_id,true,'Volunteer B');
 perform set_config('request.jwt.claim.sub',volunteer_a::text,true);
 perform public.test_denied(format('select public.set_public_volunteer_signup(%L,true,''Volunteer A'')',event_id));
 perform public.test_assert((select status='withdrawn' from public.public_volunteer_signups where id=signup_id),'Withdrawal preserves signup history and frees capacity');
 perform set_config('request.jwt.claim.sub',owner::text,true);
 perform public.test_assert((select count(*)=3 from public.public_volunteer_signups),'Staff can view the separate public roster');
 perform public.test_denied(format('select public.save_public_volunteer_event(''Edited'','''','''',now()+interval ''2 days'',now()+interval ''2 days 2 hours'',''published'',true,1,%L,99)',event_id));
 select id into signup_id from public.public_volunteer_signups where user_id=volunteer_b;
 perform public.test_denied(format('select public.record_public_volunteer_attendance(%L,''present'',60,'''',1)',signup_id));
 perform public.save_public_volunteer_event('Community cleanup','','Park',now()-interval '2 days',now()-interval '2 days'+interval '1 hour','published',true,1,event_id,1);
 perform public.record_public_volunteer_attendance(signup_id,'present',60,'Thank you for helping',1);
 perform public.test_denied(format('select public.record_public_volunteer_attendance(%L,''absent'',60,'''',2)',signup_id));
 perform public.test_denied(format('select public.record_public_volunteer_attendance(%L,''present'',120,'''',1)',signup_id));
 perform set_config('request.jwt.claim.sub',volunteer_b::text,true);
 perform public.test_assert((select attendance='present' and verified_minutes=60 from public.public_volunteer_signups where id=signup_id),'Volunteer can see verified public attendance and service');
 perform public.test_denied(format('select public.set_public_volunteer_signup(%L,false)',event_id));
 perform set_config('request.jwt.claim.sub',owner::text,true);
 perform public.save_public_volunteer_event('Community cleanup','','Park',now()-interval '2 days',now()-interval '2 days'+interval '1 hour','cancelled',false,1,event_id,2);
 perform set_config('request.jwt.claim.sub',volunteer_b::text,true);
 perform public.test_assert((select status='cancelled' from public.public_volunteer_events where id=event_id),'Registered volunteers can still see cancellation and history');
 execute 'reset role';
 perform public.test_assert((select count(*)=old_officer_logs from public.officer_volunteer_logs),'Public volunteering never adds officer service hours');
 perform public.test_assert((select count(*)=old_officer_attendance from public.officer_attendance),'Public volunteering never changes officer attendance');
 perform public.test_assert((select count(*)=old_officer_signups from public.officer_event_signups),'Public volunteering never adds officer event signups');
end $$;
rollback;
