-- One-time rollout for existing strikes. Deploy the new website/bot first, then
-- apply after officer-strike-response-window.sql and the Discord migrations.
-- Install officer-strike-response-scheduler.sql before this rollout for automatic expiry.
-- Apply officer-strike-president-updates.sql first to enable president updates.
-- Run with the Discord worker idle. Reapplying never restarts the window or resends notices.
begin;
create table if not exists public.officer_strike_response_reissues (
 id text primary key check(id='existing-strikes-v1'),
 started_at timestamptz not null,
 reissued_count integer not null default 0,
 queued_count integer not null default 0
);
alter table public.officer_strike_response_reissues enable row level security;
revoke all on public.officer_strike_response_reissues from public,anon,authenticated;
grant all on public.officer_strike_response_reissues to service_role;

do $rollout$
declare incident record; started timestamptz:=clock_timestamp(); reopened integer:=0; queued integer:=0;
begin
 insert into public.officer_strike_response_reissues(id,started_at)
 values('existing-strikes-v1',started) on conflict(id) do nothing;
 if not found then return; end if;
 -- Serialize with attendance/decision writes while each record is renewed.
 lock table public.officer_strikes in share row exclusive mode;
 for incident in
  select s.id,s.officer_id,p.discord_id from public.officer_strikes s
  join public.officer_profiles p on p.id=s.officer_id
  where s.status in ('notified','confirmed') and p.access_enabled
   and p.reviewer_kind is distinct from 'advisor'
  order by s.officer_id,s.id for update of s
 loop
  -- The tracking audit trigger retains the old deadline, explanation timestamp,
  -- and decision. Keep explanation text as a draft for the officer to confirm.
  update public.officer_strikes set status='notified',notified_at=started,
   response_due_at=started+interval '24 hours',responded_at=null,
   decided_by=null,decided_at=null,decision_notes='' where id=incident.id;
  reopened:=reopened+1;
  if incident.discord_id is not null then
   -- Reuse the canonical outbox ID, including finished/failed old receipts.
   -- A single database job per incident prevents duplicate queued notices.
   insert into public.discord_jobs(id,kind,payload,available_at)
   values('strike-response:'||incident.id,'notification',
    jsonb_build_object('topic','strike_response','strike_id',incident.id,'officer_id',incident.officer_id,'reissued',true),started)
   on conflict(id) do update set kind=excluded.kind,payload=excluded.payload,
    available_at=excluded.available_at,attempts=0,leased_until=null,finished_at=null,failed=false;
   queued:=queued+1;
  end if;
 end loop;
 update public.officer_strike_response_reissues set reissued_count=reopened,queued_count=queued
 where id='existing-strikes-v1';
end $rollout$;
commit;
