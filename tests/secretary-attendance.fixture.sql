-- Empty disposable database only. Exercises real website and Discord permissions.
\ir discord-attendance.fixture.sql
begin;
insert into auth.users(id) values('55555555-5555-4555-8555-555555555555'),('66666666-6666-4666-8666-666666666666');
insert into public.officer_profiles(id,name,role,position,discord_id,access_enabled) values
 ('55555555-5555-4555-8555-555555555555','Secretary','officer','Secretary','555555555555555555',true),
 ('66666666-6666-4666-8666-666666666666','Disabled secretary','officer','Secretary','666666666666666666',false);
update public.officer_profiles set discord_id='111111111111111111' where id='11111111-1111-4111-8111-111111111111';
update public.officer_profiles set discord_id='222222222222222222' where id='22222222-2222-4222-8222-222222222222';
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$
declare meeting uuid; service uuid; future_meeting uuid; secretary uuid:='55555555-5555-4555-8555-555555555555'; officer uuid:='11111111-1111-4111-8111-111111111111'; begin
 meeting:=public.save_officer_event('Secretary roll call','meeting','2026-2027',now()-interval '1 day',now()-interval '23 hours');
 service:=public.save_officer_event('Service attendance','volunteer','2026-2027',now()-interval '1 day',now()-interval '23 hours');
 future_meeting:=public.save_officer_event('Future meeting','meeting','2026-2027',now()+interval '1 day',now()+interval '25 hours');
 perform public.record_officer_attendance(meeting,officer,'late','Private advisor observation');
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',secretary::text,true);
 perform public.test_assert(public.can_manage_meetings() and not public.is_peet_admin(),'secretary can take roll without reviewer privileges');
 perform public.test_assert(exists(select 1 from public.meeting_roll_call(meeting) where officer_id=officer and status='late'),'secretary can load the full safe roll call');
 perform public.test_assert(not exists(select 1 from public.officer_attendance where officer_id=officer),'secretary cannot read private attendance explanations');
 perform public.save_meeting_attendance(meeting,jsonb_build_array(jsonb_build_object('officer_id',officer,'status','present','original_status','late')));
 execute 'set local role service_role';
 perform public.discord_action('555555555555555555','attendance',jsonb_build_object('event',meeting,'officer','111111111111111111','status','late'),'secretary-roll');
 perform public.test_assert((select status='late' and reviewer_notes='Private advisor observation' from public.officer_attendance where event_id=meeting and officer_id=officer),'Discord secretary roll call preserves reviewer notes');
 perform public.test_denied(format('select public.discord_action(%L,%L,%L::jsonb)','555555555555555555','attendance',jsonb_build_object('event',meeting,'officer','111111111111111111','status','present','notes','Forged reviewer note')));
 perform public.test_denied(format('select public.discord_action(%L,%L,%L::jsonb)','555555555555555555','attendance',jsonb_build_object('event',service,'officer','111111111111111111','status','present')));
 perform public.test_denied(format('select public.discord_action(%L,%L,%L::jsonb)','555555555555555555','attendance',jsonb_build_object('event',future_meeting,'officer','111111111111111111','status','present')));
 perform public.test_denied(format('select public.discord_action(%L,%L,%L::jsonb)','222222222222222222','attendance',jsonb_build_object('event',meeting,'officer','111111111111111111','status','present')));
 perform public.test_denied(format('select public.discord_action(%L,%L,%L::jsonb)','666666666666666666','attendance',jsonb_build_object('event',meeting,'officer','111111111111111111','status','present')));
 perform public.test_denied('select public.discord_action(''555555555555555555'',''assign'',''{"officer":"111111111111111111","title":"Unauthorized assignment"}'')');
end $$;
reset role;
rollback;
select 'Secretary website and Discord attendance permissions passed.';
