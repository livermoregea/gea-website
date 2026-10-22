-- Synthetic disposable local PostgreSQL only. Never run in a live project.
\ir officer-strike-response-window.sql
reset role;
\ir ../supabase/officer-strike-president-updates.sql
\ir ../supabase/officer-strike-president-updates.sql
begin;
update public.officer_profiles set discord_id='111111111111111111' where id='11111111-1111-4111-8111-111111111111';
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
select public.create_officer_strike('11111111-1111-4111-8111-111111111111','2097-2098','conduct',current_date,'President update test incident',null) incident \gset
select notified_at from public.officer_strikes where id=:'incident' \gset
select public.test_denied(format('select public.record_discord_notice_delivery(%L,%L,''dm_sent'')',:'incident',:'notified_at'));
reset role;
set role service_role;
select public.record_discord_notice_delivery(:'incident',:'notified_at','dm_sent');
select public.record_discord_notice_delivery(:'incident',:'notified_at','dm_sent');
select public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'topic'='strike_president' and payload->>'strike_id'=:'incident'),'Duplicate delivery receipts queue once');
select public.record_discord_notice_delivery(:'incident',:'notified_at','delivery_failed');
select public.record_discord_notice_delivery(:'incident',:'notified_at','notices_sent');
select public.test_assert((select count(*)=3 from public.discord_jobs where payload->>'topic'='strike_president' and payload->>'strike_id'=:'incident'),'Different retry outcomes receive separate president updates');
select public.test_denied(format('select public.record_discord_notice_delivery(%L,%L,''forged-status'')',:'incident',:'notified_at'));
reset role;
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.respond_officer_strike(:'incident','My private explanation from the website.');
select public.respond_officer_strike(:'incident','An edited private website explanation.');
reset role;
select public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'topic'='strike_president' and payload->>'strike_id'=:'incident' and payload->>'status'='responded'),'Website response queues once, edits do not repeat it');
select public.test_assert((select bool_and(not (payload ? 'officer_response') and not (payload ? 'reason') and payload->>'occurred_at' is not null) from public.discord_jobs where payload->>'topic'='strike_president'),'President payload contains status metadata without incident or explanation text');
-- Simulate the one-time reissue: a new notice timestamp gets independent receipts.
update public.officer_strikes set notified_at=clock_timestamp(),response_due_at=clock_timestamp()+interval '24 hours',responded_at=null where id=:'incident';
select notified_at new_notice_at from public.officer_strikes where id=:'incident' \gset
set role service_role;
select public.record_discord_notice_delivery(:'incident',:'notified_at','dm_sent');
select public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'topic'='strike_president' and payload->>'strike_id'=:'incident' and payload->>'status'='dm_sent'),'Stale receipt from old window is ignored');
select public.record_discord_notice_delivery(:'incident',:'new_notice_at','dm_sent');
select public.discord_strike_response('111111111111111111',:'incident','A private explanation submitted through Discord.','president-response-test');
select public.discord_strike_response('111111111111111111',:'incident','Duplicate replay explanation.','president-response-test');
select public.test_assert((select count(*)=2 from public.discord_jobs where payload->>'topic'='strike_president' and payload->>'strike_id'=:'incident' and payload->>'status'='responded'),'Reissued Discord response queues once in the new window');
select public.test_assert((select count(*)=2 from public.discord_jobs where payload->>'topic'='strike_president' and payload->>'strike_id'=:'incident' and payload->>'status'='dm_sent'),'Reissued delivery receives a fresh president update');
rollback;
