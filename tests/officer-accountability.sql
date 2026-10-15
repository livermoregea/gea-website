-- Run after tests/officerboard.sql in the SAME disposable local database.
\ir ../supabase/officer-accountability.sql
\ir ../supabase/officer-accountability.sql
begin;
insert into auth.users values ('55555555-5555-5555-5555-555555555555');
insert into public.officer_profiles(id,name,role,reviewer_kind) values('55555555-5555-5555-5555-555555555555','Academy Advisor','admin','advisor');

do $$
declare meeting uuid; event_a uuid; event_b uuid; attendance_id uuid; log_id uuid; strike_id uuid; review_id uuid; task_id uuid; i integer; strikes uuid[] := '{}';
begin
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 meeting:=public.save_officer_event('Leadership meeting','meeting','2026-2027','2026-09-22 19:00Z','2026-09-22 20:00Z','Classroom',true,false);
 event_a:=public.save_officer_event('Science at Stockmans Park','outreach','2026-2027','2026-10-03 16:00Z','2026-10-03 21:00Z','Stockmans Park',false,true);
 event_b:=public.save_officer_event('Second outreach event','volunteer','2026-2027','2026-10-04 16:00Z','2026-10-04 21:00Z','School',false,true);
 perform public.test_denied('select public.save_officer_event(''Invalid'',''meeting'',''2026-2027'',''2026-09-22 19:00Z'',''2026-09-22 18:00Z'')');
 perform public.test_denied('select public.create_officer_strike(''55555555-5555-5555-5555-555555555555'',''2026-2027'',''conduct'',''2026-10-01'',''Faculty advisor outside officer contract.'',now()+interval ''2 days'')');
 perform public.record_officer_attendance(meeting,'22222222-2222-2222-2222-222222222222','unexcused','No arrival recorded.');
 select id into attendance_id from public.officer_attendance where event_id=meeting;
 perform public.test_assert((select count(*)=0 from public.officer_strikes),'Absence does not automatically issue a strike');
 perform public.save_officer_accountability_notes('22222222-2222-2222-2222-222222222222','2026-2027','Discussed communication expectations.');

 perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
 perform public.test_assert((select count(*)=3 from public.officer_events),'Officer can read shared calendar');
 perform public.mark_peet_onboarding_seen();
 perform public.test_assert((select peet_onboarding_seen_at is not null from public.officer_profiles where id=auth.uid()),'Onboarding flag lives in database');
 perform public.test_denied('update public.officer_profiles set reviewer_kind=''advisor'',role=''admin''');
 perform public.test_denied('select public.save_officer_event(''Forged'',''meeting'',''2026-2027'',''2026-09-22 19:00Z'',''2026-09-22 20:00Z'')');
 perform public.test_denied(format('select public.record_officer_attendance(%L,auth.uid(),''present'')',meeting));
 perform public.notify_officer_absence(meeting,'Emergency; notification was delayed.');
 perform public.test_assert((select status='unexcused' and absence_notice<>'' and notice_at is not null from public.officer_attendance where id=attendance_id),'Officer notice does not self-excuse');
 perform public.set_officer_event_signup(event_a,true);
 perform public.test_assert((select count(*)=0 from public.officer_volunteer_logs),'Commitment does not create verified service');
 perform public.submit_officer_volunteer(event_a,'2026-10-03 15:10Z','2026-10-03 21:20Z','Setup and outreach.');
 select id into log_id from public.officer_volunteer_logs where event_id=event_a;
 perform public.test_assert((select minutes=370 and status='pending' from public.officer_volunteer_logs where id=log_id),'Database calculates 6 hours 10 minutes including setup');
 perform public.test_denied(format('update public.officer_volunteer_logs set status=''approved'' where id=%L',log_id));
 perform public.test_denied(format('select public.review_officer_volunteer(%L,''approved'')',log_id));
 perform public.test_denied(format('select public.submit_officer_volunteer(%L,''2026-10-03 16:00Z'',''2026-10-03 15:00Z'')',event_b));
 perform public.test_denied(format('select public.submit_officer_volunteer(%L,''2026-10-03 15:00Z'',''2026-10-03 16:00Z'','''',''33333333-3333-3333-3333-333333333333'')',event_a));

 perform set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
 perform public.test_assert((select count(*)=0 from public.officer_volunteer_logs),'Officer B cannot read A service logs');
 perform public.test_assert((select count(*)=0 from public.officer_attendance),'Officer B cannot read A absence notice');
 perform public.test_assert((select count(*)=0 from public.officer_accountability_notes),'Officer B cannot read A general notes');
 perform public.test_assert((select count(*)=0 from public.officer_tracking_audit),'Audit does not leak other officers');
 perform public.test_denied(format('select public.review_officer_volunteer(%L,''approved'')',log_id));

 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 perform public.review_officer_volunteer(log_id,'approved','Service verified.');
 perform public.test_assert((select minutes=370 and status='approved' from public.officer_volunteer_logs where id=log_id),'Reviewer approves exact recorded time');
 perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
 perform public.test_denied(format('select public.submit_officer_volunteer(%L,''2026-10-03 16:00Z'',''2026-10-03 21:00Z'')',event_a));
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 perform public.review_officer_volunteer(log_id,'rejected','Please correct the departure time.');
 perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
 perform public.submit_officer_volunteer(event_a,'2026-10-03 15:10Z','2026-10-03 21:00Z','Corrected time.');
 perform public.test_assert((select minutes=350 and status='pending' and reviewed_at is null from public.officer_volunteer_logs where id=log_id),'Correction returns to pending without duplicate hours');

 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 strike_id:=public.create_officer_strike('22222222-2222-2222-2222-222222222222','2026-2027','attendance','2026-09-22','Unexcused absence from mandatory meeting.',now()+interval '2 days',attendance_id);
 strikes:=array_append(strikes,strike_id);
 perform public.test_denied(format('select public.decide_officer_strike(%L,''confirmed'',''Reviewed the incident.'')',strike_id));
 perform public.test_denied(format('select public.create_officer_strike(''22222222-2222-2222-2222-222222222222'',''2026-2027'',''attendance'',''2026-09-22'',''Duplicate absence concern.'',now()+interval ''2 days'',%L)',attendance_id));
 perform set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
 perform public.test_assert((select count(*)=0 from public.officer_strikes),'Other officer cannot read concern');
 perform public.test_denied(format('select public.respond_officer_strike(%L,''Forged response'')',strike_id));
 perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
 perform public.respond_officer_strike(strike_id,'Here are my circumstances for review.');
 perform public.test_denied(format('select public.decide_officer_strike(%L,''confirmed'',''Self-confirmed strike.'')',strike_id));
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 perform public.decide_officer_strike(strike_id,'confirmed','Reviewed explanation and confirmed unexcused absence.');
 perform public.test_denied(format('select public.record_officer_attendance(%L,''22222222-2222-2222-2222-222222222222'',''excused'')',meeting));

 -- Two attendance + two conduct strikes do not combine into a removal review.
 for i in 1..3 loop
   strike_id:=public.create_officer_strike('22222222-2222-2222-2222-222222222222','2026-2027',case when i=1 then 'attendance' else 'conduct' end,'2026-10-01','Documented incident with individual circumstances.',now()+interval '2 days');
   if i=1 then strikes:=array_append(strikes,strike_id); end if;
   perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
   perform public.respond_officer_strike(strike_id,'My explanation of the incident.');
   perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
   perform public.decide_officer_strike(strike_id,'confirmed','Reviewed the circumstances and explanation.');
 end loop;
 perform public.test_assert((select count(*)=0 from public.officer_removal_reviews),'Separate categories do not combine');
 strike_id:=public.create_officer_strike('22222222-2222-2222-2222-222222222222','2026-2027','attendance','2026-10-02','Third documented attendance incident.',now()+interval '2 days');
 perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
 perform public.respond_officer_strike(strike_id,'Please consider my circumstances.');
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 perform public.decide_officer_strike(strike_id,'confirmed','Reviewed all information and confirmed.');
 select id into review_id from public.officer_removal_reviews;
 perform public.test_assert((select count(*)=1 from public.officer_removal_reviews),'Third confirmed strike opens one formal review');
 perform public.test_assert((select status='pending' and jsonb_array_length(context_snapshot->'confirmed_strikes')=3 from public.officer_removal_reviews),'Review stores documented strike context');
 perform public.test_assert((select role='officer' from public.officer_profiles where id='22222222-2222-2222-2222-222222222222'),'Review does not remove the officer');
 perform public.test_denied(format('select public.decide_officer_removal_review(%L,''removal_approved'',''President alone approves.'')',review_id));
 perform public.decide_officer_strike(strikes[1],'revoked','Absence subsequently reasonably excused.');
 perform public.record_officer_attendance(meeting,'22222222-2222-2222-2222-222222222222','excused','Emergency circumstances accepted.');
 perform public.test_assert((select count(*)=2 from public.officer_strikes where category='attendance' and status='confirmed'),'Revoked strike no longer counted');

 -- President PEET requires an advisor, enforced on evaluation writes.
 task_id:=public.save_officer_task('President deliverable');
 perform public.submit_officer_task(task_id,'https://example.com/work');
 perform public.test_denied(format('select public.evaluate_officer_task(%L,3,3,3)',task_id));
 perform set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',true);
 perform public.evaluate_officer_task(task_id,3,3,3,'Reviewed by Academy Advisor.');
 perform public.test_denied(format('select public.decide_officer_removal_review(%L,''removal_approved'',''Reconsidered after a strike was revoked.'')',review_id));
 perform public.decide_officer_removal_review(review_id,'retained','Reviewed the PEET history, strike context, and subsequent correction.');
 perform public.test_assert((select status='retained' and decided_by=auth.uid() from public.officer_removal_reviews),'Only advisor records formal outcome');
 perform public.test_assert((select count(*)>10 from public.officer_tracking_audit),'Changes have an immutable audit history');
 perform public.test_denied('delete from public.officer_tracking_audit');

 perform set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
 perform public.test_assert((select count(*)=0 from public.officer_events),'Unapproved accounts cannot read the calendar');
 perform public.test_denied('select public.mark_peet_onboarding_seen()');
 perform public.test_denied(format('select public.set_officer_event_signup(%L,true)',event_a));
 execute 'set local role anon';
 perform set_config('request.jwt.claim.sub','',true);
 perform public.test_denied('select * from public.officer_strikes');
 perform public.test_denied('select * from public.officer_volunteer_logs');
 perform public.test_denied('select * from public.officer_attendance');
 perform public.test_denied('select * from public.officer_removal_reviews');
 perform public.test_denied('select public.mark_peet_onboarding_seen()');
end $$;
rollback;
