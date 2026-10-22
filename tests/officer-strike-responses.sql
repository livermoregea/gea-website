-- Synthetic disposable local PostgreSQL only. Never run in a live project.
\ir discord-officer-workspace.fixture.sql
reset role;
\ir ../supabase/officer-strike-notifications.sql
\ir ../supabase/officer-strike-responses.sql
\ir ../supabase/officer-strike-responses.sql
begin;
update public.officer_profiles set discord_id='111111111111111111' where id='11111111-1111-4111-8111-111111111111';
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
select public.create_officer_strike('11111111-1111-4111-8111-111111111111','2026-2027','conduct',current_date,'Documented conduct incident',null) strike \gset
select public.save_officer_event('Response test meeting','meeting','2026-2027',now()-interval '2 hours',now()-interval '1 hour','School',true,false) meeting \gset
select public.record_officer_attendance(:'meeting','11111111-1111-4111-8111-111111111111','unexcused','Absent');
select public.record_officer_attendance(:'meeting','11111111-1111-4111-8111-111111111111','unexcused','Updated notes');
reset role;
select public.test_assert((select count(*)=1 from public.discord_jobs where id='strike-response:'||:'strike'),'Conduct strike queues one response request');
select public.test_assert((select count(*)=1 from public.discord_jobs j join public.officer_strikes s on j.id='strike-response:'||s.id join public.officer_attendance a on a.id=s.attendance_id where a.event_id=:'meeting'),'Automatic absence queues once across repeated saves');
set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.test_denied(format('select public.respond_officer_strike(%L,''Forged explanation'')',:'strike'));
select public.test_denied(format('select public.discord_strike_response(''111111111111111111'',%L,''Forged explanation'',''forged-key'')',:'strike'));
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.test_denied(format('select public.respond_officer_strike(%L,'' '')',:'strike'));
select public.respond_officer_strike(:'strike','A family emergency prevented me from attending.');
select public.test_assert((select officer_response='A family emergency prevented me from attending.' and responded_at is not null and status='confirmed' from public.officer_strikes where id=:'strike'),'Own explanation persists without changing reviewer decision');
reset role;
set role service_role;
select public.discord_strike_response('111111111111111111',:'strike','Updated explanation through Discord.','response-test');
select public.discord_strike_response('111111111111111111',:'strike','Replay must not replace the response.','response-test');
select public.test_assert((select officer_response='Updated explanation through Discord.' from public.officer_strikes where id=:'strike'),'Discord submission is idempotent');
select public.test_denied(format('select public.discord_strike_response(''222222222222222222'',%L,''Someone else response'',''other-response'')',:'strike'));
reset role;
update public.officer_profiles set access_enabled=false where id='11111111-1111-4111-8111-111111111111';
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.test_denied(format('select public.respond_officer_strike(%L,''Disabled response'')',:'strike'));
reset role;
update public.officer_profiles set access_enabled=true where id='11111111-1111-4111-8111-111111111111';
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
select public.test_assert((select officer_response='Updated explanation through Discord.' from public.officer_strikes where id=:'strike'),'Reviewer can read the same explanation');
select public.decide_officer_strike(:'strike','revoked','Reviewed the circumstances and corrected the record.');
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.test_denied(format('select public.respond_officer_strike(%L,''Late revoked explanation'')',:'strike'));
rollback;
