-- Hosted Supabase setup: run once in the SQL editor as postgres, after
-- officer-strike-response-window.sql and before reissuing existing notices.
-- Safe to reapply: the named job is updated rather than duplicated.
-- Supabase Cron executes this SQL inside Postgres, independently of Vercel.
begin;

do $$ begin
 if to_regprocedure('public.expire_officer_strike_responses()') is null then
  raise exception 'Apply officer-strike-response-window.sql before installing the deadline scheduler.';
 end if;
end $$;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
 'gea-officer-strike-response-expiry',
 '* * * * *',
 $job$select public.expire_officer_strike_responses();$job$
);

commit;

-- Verify installation in the SQL editor:
-- select jobid,jobname,schedule,active from cron.job
-- where jobname='gea-officer-strike-response-expiry';
-- Inspect runs under Integrations > Cron > History, or:
-- select status,return_message,start_time,end_time from cron.job_run_details
-- where jobid in (select jobid from cron.job where jobname='gea-officer-strike-response-expiry')
-- order by start_time desc limit 10;
