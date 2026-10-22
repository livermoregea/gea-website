-- Synthetic disposable local PostgreSQL only. Never run in a live project.
\ir officer-strike-response-window.sql
reset role;
update public.officer_profiles set discord_id='111111111111111111' where id='11111111-1111-4111-8111-111111111111';
update public.officer_profiles set discord_id=null where id='44444444-4444-4444-8444-444444444444';
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
select public.create_officer_strike('11111111-1111-4111-8111-111111111111','2025-2026','conduct',current_date,'Existing confirmed incident',null) legacy \gset
select public.create_officer_strike('11111111-1111-4111-8111-111111111111','2026-2027','conduct',current_date,'Existing pending incident',null) pending \gset
select public.create_officer_strike('11111111-1111-4111-8111-111111111111','2026-2027','conduct',current_date,'Existing dismissed incident',null) dismissed \gset
select public.decide_officer_strike(:'dismissed','dismissed','Dismissed before the new rollout.');
select public.create_officer_strike('22222222-2222-4222-8222-222222222222','2026-2027','conduct',current_date,'Disabled officer incident',null) disabled \gset
select public.create_officer_strike('44444444-4444-4444-8444-444444444444','2026-2027','conduct',current_date,'Unlinked officer incident',null) unlinked \gset
reset role;
update public.officer_strikes set status='confirmed',notified_at=now()-interval '30 days',response_due_at=now()-interval '29 days',
 officer_response='My original explanation.',responded_at=now()-interval '30 days'+interval '1 hour',
 decided_at=now()-interval '29 days',decision_notes='Original confirmed decision.' where id=:'legacy';
update public.officer_profiles set access_enabled=false where id='22222222-2222-4222-8222-222222222222';
update public.discord_jobs set finished_at=now(),payload='{}',attempts=5,failed=true where id='strike-response:'||:'legacy';
\ir ../supabase/officer-strike-response-reissue.sql
select public.test_assert((select status='notified' and responded_at is null and officer_response='My original explanation.' and decided_at is null and decision_notes='' and response_due_at-notified_at=interval '24 hours' and response_due_at>clock_timestamp()+interval '23 hours 59 minutes' from public.officer_strikes where id=:'legacy'),'Existing confirmed incident reopens with full window and original explanation draft');
select public.test_assert((select after_record->>'status'='notified' and before_record->>'decision_notes'='Original confirmed decision.' and before_record->>'responded_at' is not null from public.officer_tracking_audit where record_id=:'legacy' and before_record->>'status'='confirmed' order by recorded_at desc limit 1),'Prior decision and response timestamp preserved in audit');
select public.test_assert((select not failed and attempts=0 and finished_at is null and leased_until is null and payload->>'reissued'='true' from public.discord_jobs where id='strike-response:'||:'legacy'),'Finished/failed delivery is queued again with the new system');
select public.test_assert((select payload->>'reissued'='true' from public.discord_jobs where id='strike-response:'||:'pending'),'Existing pending incident also receives a new request');
select public.test_assert((select status='dismissed' from public.officer_strikes where id=:'dismissed'),'Dismissed incident stays closed');
select public.test_assert((select notified_at<(select started_at from public.officer_strike_response_reissues) from public.officer_strikes where id=:'disabled'),'Disabled officer is not reissued');
select public.test_assert((select response_due_at-notified_at=interval '24 hours' and notified_at=(select started_at from public.officer_strike_response_reissues) from public.officer_strikes where id=:'unlinked'),'Unlinked active officer gets a renewed website notice');
select public.test_assert(not exists(select 1 from public.discord_jobs where id='strike-response:'||:'unlinked'),'Unlinked officer has no undeliverable DM job');
-- Complete the reissued job and shorten the window to detect any reset on rerun.
update public.discord_jobs set finished_at=now(),payload='{}' where id='strike-response:'||:'legacy';
update public.officer_strikes set response_due_at=notified_at+interval '23 hours' where id=:'legacy';
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
select public.create_officer_strike('11111111-1111-4111-8111-111111111111','2026-2027','conduct',current_date,'Incident created after the rollout',null) later \gset
select public.test_denied('select * from public.officer_strike_response_reissues');
select public.test_denied('delete from public.officer_strike_response_reissues');
reset role;
\ir ../supabase/officer-strike-response-reissue.sql
select public.test_assert((select response_due_at-notified_at=interval '23 hours' from public.officer_strikes where id=:'legacy'),'Reapplying never extends the response window');
select public.test_assert((select finished_at is not null and payload='{}'::jsonb from public.discord_jobs where id='strike-response:'||:'legacy'),'Reapplying never sends another notice');
select public.test_assert((select payload->>'reissued' is null from public.discord_jobs where id='strike-response:'||:'later'),'Later incidents are not included when migration is rerun');
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.respond_officer_strike(:'legacy','My renewed explanation under the new system.');
select public.test_assert((select responded_at is not null and status='notified' from public.officer_strikes where id=:'legacy'),'Officer can respond to the reopened existing strike');
reset role;
