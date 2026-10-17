-- Run after tests/officerboard.sql and tests/officer-accountability.sql in a disposable database.
\ir ../supabase/officer-event-service.sql
\ir ../supabase/officer-event-service.sql
begin;
do $$
declare v_event_id uuid; other_event uuid; snapshot jsonb; stale jsonb; log_a uuid; log_b uuid;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
  v_event_id:=public.save_officer_event('Bulk service','volunteer','2026-2027','2026-01-01 18:00Z','2026-01-01 20:00Z');
  other_event:=public.save_officer_event('Other service','outreach','2026-2027','2026-01-01 18:00Z','2026-01-01 20:00Z');
  perform public.record_officer_attendance(v_event_id,'22222222-2222-2222-2222-222222222222','present','Service attendance notes');
  perform public.record_officer_attendance(v_event_id,'33333333-3333-3333-3333-333333333333','excused','Absent with notice');
  perform public.test_assert((select count(*)=0 from public.officer_volunteer_logs where officer_volunteer_logs.event_id=v_event_id),'Attendance alone awards no hours');
  perform public.submit_officer_volunteer(v_event_id,'2026-01-01 18:00Z','2026-01-01 19:00Z','A details','22222222-2222-2222-2222-222222222222');
  perform public.submit_officer_volunteer(v_event_id,'2026-01-01 18:30Z','2026-01-01 20:00Z','B details','33333333-3333-3333-3333-333333333333');
  select id into log_a from public.officer_volunteer_logs l where l.event_id=v_event_id and officer_id='22222222-2222-2222-2222-222222222222';
  select id into log_b from public.officer_volunteer_logs l where l.event_id=v_event_id and officer_id='33333333-3333-3333-3333-333333333333';
  select jsonb_agg(to_jsonb(l)) into snapshot from public.officer_volunteer_logs l where l.event_id=v_event_id;
  perform public.test_denied(format('select public.verify_officer_event_service(%L,%L::jsonb)',other_event,snapshot));
  perform public.test_denied(format('select public.verify_officer_event_service(%L,''[]''::jsonb)',v_event_id));
  perform public.test_denied(format('select public.verify_officer_event_service(%L,%L::jsonb)',v_event_id,jsonb_build_array(snapshot->0,snapshot->0)));
  -- A changed final row must roll back any earlier approvals.
  stale:=jsonb_set(snapshot,'{1,notes}','"Stale service details"');
  perform public.test_denied(format('select public.verify_officer_event_service(%L,%L::jsonb)',v_event_id,stale));
  perform public.test_assert((select count(*)=2 from public.officer_volunteer_logs l where l.event_id=v_event_id and status='pending'),'Stale batch approves no logs');
  perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
  perform public.test_denied(format('select public.verify_officer_event_service(%L,%L::jsonb)',v_event_id,snapshot));
  perform public.test_denied(format('select public.record_officer_attendance(%L,auth.uid(),''present'')',v_event_id));
  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
  perform public.review_officer_volunteer(log_b,'rejected','Please correct the check-out time.');
  perform public.test_denied(format('select public.verify_officer_event_service(%L,%L::jsonb)',v_event_id,snapshot));
  perform public.test_assert((select status='pending' from public.officer_volunteer_logs where id=log_a),'Returned exception prevents stale batch approval');
  select jsonb_agg(to_jsonb(l)) into snapshot from public.officer_volunteer_logs l where id=log_a;
  perform public.verify_officer_event_service(v_event_id,snapshot);
  perform public.test_assert((select status='approved' and notes='A details' and minutes=60 from public.officer_volunteer_logs where id=log_a),'Verify preserves actual service details');
  perform public.test_assert((select status='rejected' from public.officer_volunteer_logs where id=log_b),'Unselected returned log is preserved');
  perform public.submit_officer_volunteer(v_event_id,'2026-01-01 18:30Z','2026-01-01 20:00Z','Corrected B','33333333-3333-3333-3333-333333333333');
  select jsonb_agg(to_jsonb(l)) into snapshot from public.officer_volunteer_logs l where id=log_b;
  -- Simulate cancellation via the authorized event API.
  perform public.save_officer_event('Bulk service','volunteer','2026-2027','2026-01-01 18:00Z','2026-01-01 20:00Z','',false,false,'',v_event_id,true);
  perform public.test_denied(format('select public.verify_officer_event_service(%L,%L::jsonb)',v_event_id,snapshot));
  perform public.test_denied(format('select public.record_officer_attendance(%L,auth.uid(),''present'')',v_event_id));
end $$;
rollback;
