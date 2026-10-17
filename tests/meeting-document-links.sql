-- Disposable fixture DB only, after tests/gea-operations.sql.
\ir ../supabase/meeting-document-links.sql
\ir ../supabase/meeting-document-links.sql
begin;
insert into auth.users(id) values('77777777-7777-7777-7777-777777777777'),('88888888-8888-8888-8888-888888888888'),('99999999-9999-9999-9999-999999999999');
insert into public.officer_profiles(id,name,role,position,access_enabled) values
 ('77777777-7777-7777-7777-777777777777','Secretary','officer','Secretary',true),
 ('88888888-8888-8888-8888-888888888888','Officer','officer','Treasurer',true),
 ('99999999-9999-9999-9999-999999999999','Disabled secretary','officer','Secretary',false);
do $$ declare meeting uuid; service uuid; cancelled uuid;
 advisor uuid:='11111111-1111-1111-1111-111111111111'; secretary uuid:='77777777-7777-7777-7777-777777777777';
 officer uuid:='88888888-8888-8888-8888-888888888888'; disabled uuid:='99999999-9999-9999-9999-999999999999'; begin
 execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',advisor::text,true);
 meeting:=public.save_officer_event('Document meeting','meeting','2026-2027',now(),now()+interval '1 hour');
 service:=public.save_officer_event('Service','volunteer','2026-2027',now(),now()+interval '1 hour');
 cancelled:=public.save_officer_event('Cancelled meeting','meeting','2026-2027',now(),now()+interval '1 hour',p_cancelled=>true);
 perform public.save_meeting_notes(meeting,'Old written notes','Old decisions',0);
 perform set_config('request.jwt.claim.sub',secretary::text,true);
 perform public.save_meeting_documents(meeting,'https://docs.google.com/document/d/agenda123/edit','https://docs.google.com/document/u/0/d/notes123/edit?usp=sharing',1);
 perform public.test_assert((select minutes='Old written notes' and decisions='Old decisions' and version=2 from public.gea_meeting_notes where event_id=meeting),'Link changes preserve old written history and increment version');
 perform public.test_assert((select agenda_doc_url='https://docs.google.com/document/d/agenda123/edit' from public.gea_meeting_notes where event_id=meeting),'Secretary can save agenda document');
 perform public.test_denied(format('select public.save_meeting_documents(%L,null,null,1)',meeting));
 perform public.test_denied(format('select public.save_meeting_documents(%L,''https://evil.test/document/d/id'',null,2)',meeting));
 perform public.test_denied(format('select public.save_meeting_documents(%L,''javascript:alert(1)'',null,2)',meeting));
 perform public.test_denied(format('select public.save_meeting_documents(%L,''https://docs.google.com@evil.test/document/d/id'',null,2)',meeting));
 perform public.test_denied(format('select public.save_meeting_documents(%L,''https://docs.google.com/spreadsheets/d/id'',null,2)',meeting));
 perform public.test_denied(format('select public.save_meeting_documents(%L,null,null,0)',service));
 perform public.test_denied(format('select public.save_meeting_documents(%L,null,null,0)',cancelled));
 perform set_config('request.jwt.claim.sub',officer::text,true);
 perform public.test_assert((select notes_doc_url is not null from public.gea_meeting_notes where event_id=meeting),'All active officers can read document links');
 perform public.test_denied(format('select public.save_meeting_documents(%L,null,null,2)',meeting));
 perform public.test_denied(format('update public.gea_meeting_notes set agenda_doc_url=null where event_id=%L',meeting));
 perform set_config('request.jwt.claim.sub',disabled::text,true);
 perform public.test_denied(format('select public.save_meeting_documents(%L,null,null,2)',meeting));
 perform public.test_assert(not exists(select 1 from public.gea_meeting_notes where event_id=meeting),'Disabled officer cannot read meeting links');
 perform set_config('request.jwt.claim.sub',advisor::text,true);
 perform public.save_meeting_documents(meeting,null,'',2);
 perform public.test_assert((select agenda_doc_url is null and notes_doc_url is null and minutes='Old written notes' from public.gea_meeting_notes where event_id=meeting),'Reviewer can remove links without deleting history');
 perform public.test_assert(exists(select 1 from public.officer_tracking_audit where table_name='gea_meeting_notes' and after_record->>'notes_doc_url' is not null),'Document changes are audited');
 execute 'reset role';execute 'set local role anon';
 perform public.test_denied(format('select public.save_meeting_documents(%L,null,null,3)',meeting));
 execute 'reset role';
end $$;
rollback;
