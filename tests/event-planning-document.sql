-- Disposable fixture DB only, after tests/meeting-document-links.sql.
\ir ../supabase/event-planning-document.sql
\ir ../supabase/event-planning-document.sql
begin;
insert into auth.users(id) values('77777777-7777-7777-7777-777777777777'),('88888888-8888-8888-8888-888888888888'),('99999999-9999-9999-9999-999999999999');
insert into public.officer_profiles(id,name,role,position,access_enabled) values
 ('77777777-7777-7777-7777-777777777777','Unassigned officer','officer','Secretary',true),
 ('88888888-8888-8888-8888-888888888888','Organizer','officer','Treasurer',true),
 ('99999999-9999-9999-9999-999999999999','Disabled officer','officer','Secretary',false);
do $$ declare service uuid; outreach uuid; meeting uuid; cancelled uuid;
 advisor uuid:='11111111-1111-1111-1111-111111111111'; outsider uuid:='77777777-7777-7777-7777-777777777777';
 organizer uuid:='88888888-8888-8888-8888-888888888888'; disabled uuid:='99999999-9999-9999-9999-999999999999'; begin
 execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',advisor::text,true);
 service:=public.save_officer_event('Volunteer planning','volunteer','2026-2027',now(),now()+interval '1 hour');
 outreach:=public.save_officer_event('Outreach planning','outreach','2026-2027',now(),now()+interval '1 hour');
 meeting:=public.save_officer_event('Meeting','meeting','2026-2027',now(),now()+interval '1 hour');
 cancelled:=public.save_officer_event('Cancelled event','volunteer','2026-2027',now(),now()+interval '1 hour',p_cancelled=>true);
 perform public.save_event_plan(service,organizer,'Old staffing','Old supplies','Old recap',0);
 perform public.save_event_checklist(service,'Old preparation');
 perform public.save_event_planning_document(service,organizer,' https://docs.google.com/document/d/planning123/edit ',1);
 perform public.test_assert((select planning_doc_url='https://docs.google.com/document/d/planning123/edit' and version=2 and staffing='Old staffing' and supplies='Old supplies' and recap='Old recap' from public.gea_event_plans where event_id=service),'Document saves preserve prior content and increment version');
 perform public.test_assert(exists(select 1 from public.gea_event_checklist where event_id=service and title='Old preparation'),'Prior checklist retained');
 perform public.save_event_planning_document(outreach,organizer,'https://docs.google.com/document/d/outreach123/edit',0);
 perform public.test_denied(format('select public.save_event_planning_document(%L,%L,null,0)',meeting,organizer));
 perform public.test_denied(format('select public.save_event_planning_document(%L,%L,null,0)',cancelled,organizer));
 perform public.test_denied(format('select public.save_event_planning_document(%L,%L,null,2)',service,disabled));
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform public.test_assert((select planning_doc_url is not null from public.gea_event_plans where event_id=service),'Active officers can read planning links');
 perform public.test_denied(format('select public.save_event_planning_document(%L,%L,null,2)',service,outsider));
 perform set_config('request.jwt.claim.sub',organizer::text,true);
 perform public.save_event_planning_document(service,organizer,'https://docs.google.com/document/u/0/d/newplan/edit?usp=sharing',2);
 perform public.test_denied(format('select public.save_event_planning_document(%L,%L,null,2)',service,organizer));
 perform public.test_denied(format('select public.save_event_planning_document(%L,%L,null,null)',service,organizer));
 perform public.test_denied(format('select public.save_event_planning_document(%L,%L,null,3)',service,outsider));
 perform public.test_denied(format('select public.save_event_planning_document(%L,%L,''https://evil.test/document/d/id'',3)',service,organizer));
 perform public.test_denied(format('select public.save_event_planning_document(%L,%L,''javascript:alert(1)'',3)',service,organizer));
 perform public.test_denied(format('select public.save_event_planning_document(%L,%L,''https://docs.google.com/spreadsheets/d/id'',3)',service,organizer));
 perform public.test_denied(format('update public.gea_event_plans set planning_doc_url=null where event_id=%L',service));
 perform public.save_event_planning_document(service,organizer,'',3);
 perform public.test_assert((select planning_doc_url is null and version=4 from public.gea_event_plans where event_id=service),'Organizer can remove a document link');
 perform set_config('request.jwt.claim.sub',disabled::text,true);
 perform public.test_denied(format('select public.save_event_planning_document(%L,%L,null,4)',service,disabled));
 perform public.test_assert(not exists(select 1 from public.gea_event_plans),'Disabled officers cannot read plans');
 perform set_config('request.jwt.claim.sub',advisor::text,true);
 perform public.save_event_planning_document(service,outsider,null,4);
 perform public.test_assert((select organizer_id=outsider from public.gea_event_plans where event_id=service),'Reviewer can reassign organizer');
 perform public.test_assert(exists(select 1 from public.officer_tracking_audit where table_name='gea_event_plans' and after_record->>'planning_doc_url' is not null),'Planning sheet changes audited');
 execute 'reset role';execute 'set local role anon';
 perform public.test_denied(format('select public.save_event_planning_document(%L,%L,null,5)',service,organizer));
 execute 'reset role';
end $$;
rollback;
