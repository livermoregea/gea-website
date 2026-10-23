-- Disposable empty local PostgreSQL only. Never run in a live project.
\ir officer-strike-notice-link-recovery.sql
reset role;
update public.officer_profiles set discord_id=null,access_enabled=true where id='22222222-2222-4222-8222-222222222222';
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
select public.create_officer_strike('22222222-2222-4222-8222-222222222222','2095-2096','conduct',current_date,'Previously skipped unlinked incident',null) existing_notice \gset
select response_due_at from public.officer_strikes where id=:'existing_notice' \gset
reset role;
select public.test_assert(not exists(select 1 from public.discord_jobs where id='strike-response:'||:'existing_notice'),'Old implementation skipped the unlinked officer delivery job');
\ir ../supabase/officer-strike-channel-fallback.sql
select public.test_assert((select payload->>'topic'='strike_response' from public.discord_jobs where id='strike-response:'||:'existing_notice'),'Migration recovers the unlinked officer channel alert');
select public.test_assert((select response_due_at=:'response_due_at'::timestamptz from public.officer_strikes where id=:'existing_notice'),'Recovering an alert preserves the existing deadline');
update public.discord_jobs set finished_at=now(),payload='{}' where id='strike-response:'||:'existing_notice';
\ir ../supabase/officer-strike-channel-fallback.sql
select public.test_assert((select finished_at is not null from public.discord_jobs where id='strike-response:'||:'existing_notice'),'Reapplying never resends completed channel alerts');
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
select public.create_officer_strike('22222222-2222-4222-8222-222222222222','2095-2096','conduct',current_date,'New unlinked incident',null) new_notice \gset
reset role;
select public.test_assert((select payload->>'topic'='strike_response' from public.discord_jobs where id='strike-response:'||:'new_notice'),'New unlinked notices immediately queue delivery');
select public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'strike_id'=:'new_notice' and payload->>'status'='not_linked'),'President is also told the officer has no Discord link');
