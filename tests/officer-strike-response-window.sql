-- Synthetic disposable local PostgreSQL only. Never run in a live project.
\ir officer-strike-responses.sql
reset role;
\ir ../supabase/officer-strike-response-window.sql
\ir ../supabase/officer-strike-response-window.sql
begin;
update public.officer_profiles set discord_id='111111111111111111' where id='11111111-1111-4111-8111-111111111111';
do $$
declare who uuid:='11111111-1111-4111-8111-111111111111'; reviewer uuid:='33333333-3333-4333-8333-333333333333';
 incident uuid; answered uuid; meeting uuid; corrected uuid; pending_ids uuid[]:='{}'; i integer; result integer;
begin
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 answered:=public.create_officer_strike(who,'2098-2099','conduct',current_date,'Conduct explanation requested',now()+interval '10 days');
 perform public.test_assert((select status='notified' and decided_at is null and response_due_at between clock_timestamp()+interval '23 hours 59 minutes' and clock_timestamp()+interval '24 hours' from public.officer_strikes where id=answered),'New incident is pending with a fixed 24-hour window, ignoring custom deadlines');
 perform public.test_denied(format('select public.decide_officer_strike(%L,''confirmed'',''Premature confirmation attempt'')',answered));
 perform set_config('request.jwt.claim.sub',who::text,true);
 perform public.respond_officer_strike(answered,'Here are my circumstances for the reviewer.');
 perform public.test_denied('select public.expire_officer_strike_responses()');
 execute 'reset role'; execute 'set local role service_role';
 perform public.test_assert(public.expire_officer_strike_responses()=0,'Nothing expires before the deadline');
 execute 'reset role';
 update public.officer_strikes set notified_at=now()-interval '25 hours',response_due_at=now()-interval '1 hour',responded_at=now()-interval '2 hours' where id=answered;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 for i in 1..3 loop
  incident:=public.create_officer_strike(who,'2098-2099','conduct',current_date,'Unanswered conduct incident '||i,null);
  pending_ids:=array_append(pending_ids,incident);
 end loop;
 meeting:=public.save_officer_event('Corrected pending absence','meeting','2098-2099',now()-interval '2 hours',now()-interval '1 hour','School',true,false);
 perform public.record_officer_attendance(meeting,who,'unexcused','Initial attendance');
 perform public.record_officer_attendance(meeting,who,'unexcused','Updated notes');
 select s.id into corrected from public.officer_strikes s join public.officer_attendance a on a.id=s.attendance_id where a.event_id=meeting;
 perform public.test_assert((select status='notified' from public.officer_strikes where id=corrected),'Attendance starts pending, not confirmed');
 perform public.record_officer_attendance(meeting,who,'excused','Corrected the absence before deadline');
 execute 'reset role';
 perform public.test_assert((select count(*)=1 from public.discord_jobs where id='strike-response:'||corrected),'Repeated attendance saves queue only one request');
 update public.officer_strikes set notified_at=now()-interval '25 hours',response_due_at=now()-interval '1 hour' where id=any(pending_ids) or id=corrected;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',who::text,true);
 perform public.test_denied(format('select public.respond_officer_strike(%L,''This response missed the deadline'')',pending_ids[1]));
 execute 'reset role'; execute 'set local role service_role';
 perform public.test_denied(format('select public.discord_strike_response(''111111111111111111'',%L,''Late Discord response'',''late-window-test'')',pending_ids[1]));
 result:=public.expire_officer_strike_responses();
 perform public.test_assert(result=3,'Only unanswered overdue incidents automatically confirm');
 perform public.test_assert(public.expire_officer_strike_responses()=0,'Expiry is idempotent');
 perform public.test_assert((select status='notified' and officer_response<>'' from public.officer_strikes where id=answered),'Timely explanation stays pending after the deadline');
 perform public.test_assert((select status='dismissed' from public.officer_strikes where id=corrected),'Corrected attendance never becomes a strike');
 perform public.test_assert((select count(*)=3 from public.officer_strikes where id=any(pending_ids) and status='confirmed' and decided_at is not null),'Three unanswered incidents count as strikes');
 perform public.test_assert((select status='pending' and jsonb_array_length(context_snapshot->'confirmed_strikes')=3 from public.officer_removal_reviews where officer_id=who and academic_year='2098-2099' and category='conduct'),'Third timeout opens the existing formal review');
 execute 'reset role'; execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 perform public.decide_officer_strike(answered,'dismissed','Reviewed the timely explanation and dismissed.');
end $$;
rollback;
