-- LOCAL TEST ONLY. Run with psql in an empty disposable database.
-- Deployment: use supabase/gea-geai-cache-recovery.sql instead.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create table public.officer_profiles(id uuid primary key references auth.users(id),access_enabled boolean default true);
create table public.admins(auth_user_id uuid);
create table public.super_admins(auth_user_id uuid);
create table public.teacher_profiles(auth_user_id uuid);
\ir ../supabase/gea-geai-cache-recovery.sql
\ir ../supabase/gea-geai-cache-recovery.sql
create function public.test_assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',message;end if;end $$;
create function public.test_denied(command text) returns void language plpgsql as $$ begin begin execute command;raise exception 'FAIL: unauthorized command succeeded';exception when insufficient_privilege then null;end;end $$;
insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into officer_profiles(id) select id from auth.users;
do $$
declare who uuid:='00000000-0000-0000-0000-000000000001';who2 uuid:='00000000-0000-0000-0000-000000000002';job jsonb;old_job jsonb;candidate jsonb;
 snapshot jsonb:='{"sources":[{"id":"s0","title":"Meeting"}]}';
 old_brief jsonb:='{"mode":"ai","summary":"Saved AI text","priorities":[]}';
begin
 perform public.queue_gea_geai_brief(who,repeat('a',64),snapshot);
 job:=public.claim_gea_geai_brief();perform public.test_assert(job is not null,'initial attempt available');
 perform public.test_assert(public.finish_gea_geai_brief(who,(job->>'lease_token')::uuid,repeat('a',64),old_brief),'success saved');
 perform public.test_assert(public.queue_gea_geai_brief(who,repeat('a',64),snapshot)=old_brief,'matching saved cache reused');
 candidate:=public.queue_gea_geai_brief(who,repeat('b',64),snapshot);
 perform public.test_assert(candidate->>'kind'='geai-cache-candidate' and candidate->'brief'=old_brief,'changed list keeps previous AI as a candidate');
 perform public.test_assert(public.claim_gea_geai_brief() is null,'successful generation keeps normal six-hour interval');
 update public.gea_geai_briefs set attempt_window_at=now()-interval '7 hours',last_attempt_at=now()-interval '7 hours' where user_id=who;
 job:=public.claim_gea_geai_brief();old_job:=job;
 perform public.test_assert(public.fail_gea_geai_brief(who,(job->>'lease_token')::uuid,'timeout'),'failure recorded');
 perform public.test_assert((select brief=old_brief and last_error_code='timeout' from public.gea_geai_briefs where user_id=who),'failure retains AI and stores safe reason');
 perform public.test_assert(public.claim_gea_geai_brief() is null,'failure has a fifteen-minute backoff');
 update public.gea_geai_briefs set last_attempt_at=now()-interval '16 minutes' where user_id=who;
 job:=public.claim_gea_geai_brief();perform public.test_assert(job is not null,'one retry available after backoff');
 perform public.test_assert(not public.finish_gea_geai_brief(who,(old_job->>'lease_token')::uuid,repeat('b',64),old_brief),'old lease cannot publish over retry');
 perform public.fail_gea_geai_brief(who,(job->>'lease_token')::uuid,'PRIVATE provider response');
 perform public.test_assert((select last_error_code='generation_failed' and window_attempts=2 from public.gea_geai_briefs where user_id=who),'failure code sanitized and retry counted');
 update public.gea_geai_briefs set last_attempt_at=now()-interval '16 minutes' where user_id=who;
 perform public.test_assert(public.claim_gea_geai_brief() is null,'no third attempt in same six-hour window');
 perform public.queue_gea_geai_brief(who2,repeat('c',64),snapshot);
 job:=public.claim_gea_geai_brief();
 update public.gea_geai_briefs set lease_until=now()-interval '1 minute',last_attempt_at=now()-interval '16 minutes' where user_id=who2;
 job:=public.claim_gea_geai_brief();perform public.test_assert(job is not null,'abandoned attempt gets the same bounded retry');
 perform public.queue_gea_geai_brief(who2,repeat('d',64),snapshot);
 perform public.test_assert(not public.finish_gea_geai_brief(who2,(job->>'lease_token')::uuid,repeat('c',64),old_brief),'old facts cannot overwrite changed source');
 perform public.test_assert((select last_error_code='source_changed' and brief is null from public.gea_geai_briefs where user_id=who2),'stale completion leaves safe fallback');
 perform public.test_assert((select requests=5 from public.gea_geai_daily_usage where usage_day=(now() at time zone 'UTC')::date),'failed and interrupted attempts consume global budget');
 update public.gea_geai_daily_usage set requests=23 where usage_day=(now() at time zone 'UTC')::date;
 update public.gea_geai_briefs set attempt_window_at=now()-interval '7 hours' where user_id=who;
 job:=public.claim_gea_geai_brief();perform public.test_assert(job is not null,'last daily slot available');
 perform public.fail_gea_geai_brief(who,(job->>'lease_token')::uuid,'timeout');
 update public.gea_geai_briefs set last_attempt_at=now()-interval '16 minutes' where user_id=who;
 perform public.test_assert(public.claim_gea_geai_brief() is null,'daily budget also blocks retries');
end $$;
set role authenticated;
select public.test_denied('select * from public.gea_geai_briefs');
select public.test_denied('select public.claim_gea_geai_brief()');
select public.test_denied('select public.fail_gea_geai_brief(null,null,''timeout'')');
reset role;
select 'GEAI recovery, stale cache, retry backoff, privacy, and daily cap checks passed.';
