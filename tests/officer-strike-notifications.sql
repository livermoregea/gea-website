-- Run after tests/officerboard.sql in a disposable local database only.
\ir ../supabase/officer-accountability.sql
-- Minimal compatibility fields from subsequent task migrations used by review snapshots.
alter table public.tasks add column if not exists cancelled_at timestamptz;
alter table public.peet_evaluations add column if not exists officer_id uuid;
create table if not exists public.officer_task_members(task_id uuid,officer_id uuid);
-- Restore pre-upgrade behavior even if this fixture is rerun.
drop trigger if exists unexcused_attendance_strike on public.officer_attendance;
drop trigger if exists officer_strike_review on public.officer_strikes;
-- Seed legacy records before the upgrade to exercise backfill and conversion.
set role authenticated;
set request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';
select public.save_officer_event('Legacy absence','meeting','2025-2026',now()-interval '2 hours',now()-interval '1 hour','School',true,false) legacy_event \gset
select public.record_officer_attendance(:'legacy_event','33333333-3333-3333-3333-333333333333','unexcused','Legacy absence');
select public.create_officer_strike('33333333-3333-3333-3333-333333333333','2025-2026','conduct',current_date,'Legacy pending conduct concern',now()+interval '2 days') legacy_strike \gset
reset role;
\ir ../supabase/officer-strike-notifications.sql
\ir ../supabase/officer-strike-notifications.sql
select public.test_assert((select status='confirmed' from public.officer_strikes where id=:'legacy_strike'),'Legacy pending notice becomes effective');
select public.test_assert((select count(*)=1 from public.officer_strikes s join public.officer_attendance a on a.id=s.attendance_id where a.event_id=:'legacy_event' and s.status='confirmed'),'Legacy unexcused attendance backfilled once across reruns');
begin;
do $$
declare meeting uuid; service uuid; strike uuid; attendance uuid; i integer;
begin
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 meeting:=public.save_officer_event('Strike test meeting','meeting','2026-2027',now()-interval '2 hours',now()-interval '1 hour','Classroom',false,false);
 perform public.record_officer_attendance(meeting,'22222222-2222-2222-2222-222222222222','unexcused','Absent');
 select id into attendance from public.officer_attendance where event_id=meeting;
 select id into strike from public.officer_strikes where attendance_id=attendance;
 perform public.test_assert((select status='confirmed' from public.officer_strikes where id=strike),'Unexcused attendance immediately counts, even at optional meetings');
 perform public.record_officer_attendance(meeting,'22222222-2222-2222-2222-222222222222','unexcused','Updated notes');
 perform public.test_assert((select count(*)=1 from public.officer_strikes where attendance_id=attendance),'Repeated saves do not duplicate strikes');
 perform public.test_denied(format('select public.create_officer_strike(%L,''2026-2027'',''attendance'',current_date,''Duplicate incident'',null,%L)','22222222-2222-2222-2222-222222222222',attendance));
 for i in 1..2 loop
  service:=public.save_officer_event('Service '||i,'volunteer','2026-2027',now()-interval '2 hours',now()-interval '1 hour','School',false,true);
  perform public.record_officer_attendance(service,'22222222-2222-2222-2222-222222222222','unexcused','Absent');
 end loop;
 perform public.test_assert((select count(*)=3 from public.officer_strikes where officer_id='22222222-2222-2222-2222-222222222222' and category='attendance' and status='confirmed'),'Service attendance also counts');
 perform public.test_assert((select jsonb_array_length(context_snapshot->'confirmed_strikes')=3 from public.officer_removal_reviews where officer_id='22222222-2222-2222-2222-222222222222' and academic_year='2026-2027' and category='attendance'),'Third automatic strike opens formal review');
 strike:=public.create_officer_strike('22222222-2222-2222-2222-222222222222','2026-2027','conduct',current_date,'Documented conduct incident',null);
 perform public.test_assert((select status='confirmed' from public.officer_strikes where id=strike),'Manual conduct strike needs no deadline or confirmation');
 perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
 perform public.test_assert((select reason='Documented conduct incident' from public.officer_strikes where id=strike),'Officer can read strike notification');
 perform public.test_denied(format('select public.respond_officer_strike(%L,''Response'')',strike));
 perform public.test_denied(format('select public.create_officer_strike(%L,''2026-2027'',''conduct'',current_date,''Self issued strike'',null)',auth.uid()));
 perform public.test_denied(format('select public.record_officer_attendance(%L,auth.uid(),''excused'')',meeting));
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 select id into strike from public.officer_strikes where attendance_id=attendance;
 perform public.decide_officer_strike(strike,'revoked','Correcting the attendance record.');
 perform public.record_officer_attendance(meeting,'22222222-2222-2222-2222-222222222222','excused','Excused by reviewer');
 perform public.test_assert((select count(*)=2 from public.officer_strikes where officer_id='22222222-2222-2222-2222-222222222222' and category='attendance' and status='confirmed'),'Reviewer correction removes the strike from totals');
end $$;
rollback;
