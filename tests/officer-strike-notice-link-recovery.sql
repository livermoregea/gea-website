-- Disposable empty local PostgreSQL only. Never run in a live project.
\ir officer-strike-president-updates.sql
reset role;
update public.officer_profiles set discord_id=null where id='11111111-1111-4111-8111-111111111111';
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
select public.create_officer_strike('11111111-1111-4111-8111-111111111111','2096-2097','conduct',current_date,'Unlinked existing notice',null) open_notice \gset
select public.create_officer_strike('11111111-1111-4111-8111-111111111111','2096-2097','conduct',current_date,'Already answered notice',null) answered \gset
select public.create_officer_strike('11111111-1111-4111-8111-111111111111','2096-2097','conduct',current_date,'Already expired notice',null) expired \gset
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.respond_officer_strike(:'answered','Already provided my circumstances.');
reset role;
select response_due_at from public.officer_strikes where id=:'open_notice' \gset
update public.officer_strikes set notified_at=now()-interval '25 hours',response_due_at=now()-interval '1 hour' where id=:'expired';
insert into public.discord_jobs(id,kind,payload,finished_at) values('strike-response:'||:'open_notice','notification','{}',now());
\ir ../supabase/officer-strike-notice-link-recovery.sql
\ir ../supabase/officer-strike-notice-link-recovery.sql
select public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'strike_id'=:'open_notice' and payload->>'status'='not_linked'),'Existing unlinked incident reported to president once across reruns');
select public.test_assert(not exists(select 1 from public.discord_jobs where payload->>'strike_id'=:'answered' and payload->>'status'='not_linked'),'Answered incidents are not reported as undelivered');
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
select public.create_officer_strike('11111111-1111-4111-8111-111111111111','2096-2097','conduct',current_date,'New unlinked notice',null) new_notice \gset
reset role;
select public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'strike_id'=:'new_notice' and payload->>'status'='not_linked'),'New notices report missing Discord links');
insert into auth.identities(user_id,provider,identity_data) values('11111111-1111-4111-8111-111111111111','discord','{"sub":"111111111111111111"}');
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.test_assert(public.bind_officer_discord(),'Officer connects a verified Discord identity');
reset role;
select public.test_assert((select finished_at is null and not failed and payload->>'topic'='strike_response' from public.discord_jobs where id='strike-response:'||:'open_notice'),'Connecting requeues the still-open notice');
select public.test_assert((select payload->>'topic'='strike_response' from public.discord_jobs where id='strike-response:'||:'new_notice'),'Connecting also queues the new pending notice');
select public.test_assert(not exists(select 1 from public.discord_jobs where id='strike-response:'||:'expired'),'Connecting never sends expired notices');
select public.test_assert(not exists(select 1 from public.discord_jobs where id='strike-response:'||:'answered'),'Connecting never sends answered notices');
select public.test_assert((select response_due_at=:'response_due_at'::timestamptz from public.officer_strikes where id=:'open_notice'),'Connecting does not reset deadlines');
update public.discord_jobs set finished_at=now(),payload='{}' where id='strike-response:'||:'open_notice';
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.bind_officer_discord();
reset role;
select public.test_assert((select finished_at is not null from public.discord_jobs where id='strike-response:'||:'open_notice'),'Checking an unchanged connection does not resend the notice');
