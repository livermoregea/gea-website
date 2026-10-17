-- Disposable fixture DB only, after tests/officer-shared-tasks.sql.
\ir ../supabase/event-participant-assignments.sql
\ir ../supabase/event-participant-assignments.sql
begin;
insert into auth.users(id) values('77777777-7777-7777-7777-777777777777'),('88888888-8888-8888-8888-888888888888'),('99999999-9999-9999-9999-999999999999');
insert into public.officer_profiles(id,name,role,access_enabled) values
 ('77777777-7777-7777-7777-777777777777','Officer A','officer',true),
 ('88888888-8888-8888-8888-888888888888','Officer B','officer',true),
 ('99999999-9999-9999-9999-999999999999','Disabled officer','officer',false);
do $$ declare service uuid; outreach uuid; meeting uuid; cancelled uuid;
 reviewer uuid:='11111111-1111-1111-1111-111111111111'; officer_a uuid:='77777777-7777-7777-7777-777777777777';
 officer_b uuid:='88888888-8888-8888-8888-888888888888'; disabled uuid:='99999999-9999-9999-9999-999999999999'; begin
 execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',reviewer::text,true);
 service:=public.save_officer_event('Service assignments','volunteer','2026-2027',now(),now()+interval '1 hour');
 outreach:=public.save_officer_event('Outreach assignments','outreach','2026-2027',now(),now()+interval '1 hour');
 meeting:=public.save_officer_event('Meeting','meeting','2026-2027',now(),now()+interval '1 hour');
 cancelled:=public.save_officer_event('Cancelled','volunteer','2026-2027',now(),now()+interval '1 hour',p_cancelled=>true);
 perform public.save_officer_event_assignment(service,officer_a,true,'Greeter','Meet at the entrance',0);
 perform public.test_assert((select assigned and not committed and participation_role='Greeter' and version=1 from public.officer_event_signups where event_id=service and officer_id=officer_a),'Reviewer assigns without a prior signup');
 perform set_config('request.jwt.claim.sub',officer_a::text,true);
 perform public.set_officer_event_signup(service,true);
 perform public.test_assert((select assigned and committed and participation_notes='Meet at the entrance' and version=2 from public.officer_event_signups where event_id=service and officer_id=officer_a),'Officer request preserves reviewer assignment and details');
 perform public.set_officer_event_signup(service,false);
 perform public.test_assert((select assigned and not committed and participation_role='Greeter' and version=3 from public.officer_event_signups where event_id=service and officer_id=officer_a),'Withdrawing a request does not remove an assignment');
 perform public.set_officer_event_signup(outreach,true);
 perform public.test_denied(format('select public.save_officer_event_assignment(%L,%L,true,'''','''',0)',outreach,officer_b));
 perform public.test_denied(format('update public.officer_event_signups set assigned=false where event_id=%L',service));
 perform public.test_denied(format('select public.set_officer_event_signup(%L,true)',meeting));
 perform public.test_denied(format('select public.set_officer_event_signup(%L,true)',cancelled));
 perform public.test_denied(format('select public.set_officer_event_signup(%L,null)',service));
 perform set_config('request.jwt.claim.sub',officer_b::text,true);
 perform public.test_assert(not exists(select 1 from public.officer_event_signups),'Another officer cannot read assignment details');
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 perform public.test_denied(format('select public.save_officer_event_assignment(%L,%L,false,'''','''',1)',service,officer_a));
 perform public.save_officer_event_assignment(service,officer_a,true,'Setup lead','Bring the signs',3);
 perform public.test_assert((select assigned and not committed and participation_role='Setup lead' and version=4 from public.officer_event_signups where event_id=service and officer_id=officer_a),'Reviewer edits participation details');
 perform public.save_officer_event_assignment(outreach,officer_a,true,'Outreach','',1);
 perform public.save_officer_event_assignment(outreach,officer_a,false,'Outreach','',2);
 perform public.test_assert((select not assigned and committed and version=3 from public.officer_event_signups where event_id=outreach and officer_id=officer_a),'Unassigning preserves officer request');
 perform public.test_assert(not exists(select 1 from public.officer_volunteer_logs where event_id=service),'Assignments do not create verified service');
 perform public.test_denied(format('select public.save_officer_event_assignment(%L,%L,true,'''','''',0)',meeting,officer_b));
 perform public.test_denied(format('select public.save_officer_event_assignment(%L,%L,true,'''','''',0)',cancelled,officer_b));
 perform public.test_denied(format('select public.save_officer_event_assignment(%L,%L,true,'''','''',0)',service,disabled));
 perform public.test_denied(format('select public.save_officer_event_assignment(%L,null,true,'''','''',0)',service));
 perform public.test_denied(format('select public.save_officer_event_assignment(%L,%L,null,'''','''',0)',service,officer_b));
 perform public.test_denied(format('select public.save_officer_event_assignment(%L,%L,true,%L,'''',0)',service,officer_b,repeat('x',201)));
 perform public.test_denied(format('select public.save_officer_event_assignment(%L,%L,true,'''','''',null)',service,officer_b));
 perform public.test_assert(exists(select 1 from public.officer_tracking_audit where table_name='officer_event_signups' and after_record->>'participation_role'='Setup lead'),'Assignment changes are audited');
 perform set_config('request.jwt.claim.sub',disabled::text,true);
 perform public.test_denied(format('select public.set_officer_event_signup(%L,true)',service));
 perform public.test_denied(format('select public.save_officer_event_assignment(%L,%L,true,'''','''',0)',service,officer_b));
 perform public.test_assert(not exists(select 1 from public.officer_event_signups),'Disabled officer cannot read requests or assignments');
 execute 'reset role';execute 'set local role anon';
 perform public.test_denied(format('select public.set_officer_event_signup(%L,true)',service));
 perform public.test_denied(format('select public.save_officer_event_assignment(%L,%L,true,'''','''',0)',service,officer_b));
 execute 'reset role';
end $$;
rollback;
