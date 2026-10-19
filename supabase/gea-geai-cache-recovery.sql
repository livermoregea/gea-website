-- GEAI cache recovery upgrade. Run the entire file in the Supabase SQL editor.
-- Includes the cache setup so it is safe for existing and new installations.
-- GEAI durable summary cache and bounded background generation.
-- Run AFTER schema.sql (or existing officer/operations/account migrations).
-- Paste this entire file into the Supabase SQL editor. Safe to rerun.
begin;
create table if not exists public.gea_geai_briefs (
 user_id uuid primary key references auth.users(id) on delete cascade,
 fingerprint text not null,
 snapshot jsonb not null,
 brief jsonb,
 brief_fingerprint text,
 generated_at timestamptz,
 last_seen_at timestamptz not null default now(),
 last_attempt_at timestamptz,
 lease_token uuid,
 lease_until timestamptz
);
-- Additive when the cache is already installed.
alter table public.gea_geai_briefs add column if not exists attempt_window_at timestamptz;
alter table public.gea_geai_briefs add column if not exists window_attempts integer not null default 0 check(window_attempts between 0 and 2);
alter table public.gea_geai_briefs add column if not exists last_error_code text;
alter table public.gea_geai_briefs add column if not exists last_error_at timestamptz;
update public.gea_geai_briefs set attempt_window_at=last_attempt_at,window_attempts=1
 where attempt_window_at is null and last_attempt_at is not null;
-- Recover an older failed/interrupted attempt without erasing the last good text.
update public.gea_geai_briefs set last_error_code='generation_failed',last_error_at=last_attempt_at
 where last_error_code is null and last_attempt_at is not null
 and (generated_at is null or generated_at<last_attempt_at)
 and lease_until is null and last_attempt_at<now()-interval '2 minutes';

create table if not exists public.gea_geai_daily_usage (
 usage_day date primary key,
 requests integer not null default 0 check(requests between 0 and 24)
);
alter table public.gea_geai_briefs enable row level security;
alter table public.gea_geai_daily_usage enable row level security;
-- Access is through server-only RPCs; no direct browser reads or writes.
revoke all on public.gea_geai_briefs, public.gea_geai_daily_usage from public, anon, authenticated;
grant all on public.gea_geai_briefs, public.gea_geai_daily_usage to service_role;

create or replace function public.queue_gea_geai_brief(p_user_id uuid, p_fingerprint text, p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.gea_geai_briefs;
begin
 if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$'
  or p_snapshot is null or jsonb_typeof(p_snapshot)<>'object'
  or jsonb_typeof(p_snapshot->'sources') is distinct from 'array'
  or jsonb_array_length(p_snapshot->'sources')>40 or octet_length(p_snapshot::text)>60000 then
  raise exception 'Invalid GEAI snapshot.';
 end if;
 insert into public.gea_geai_briefs(user_id,fingerprint,snapshot)
 values(p_user_id,p_fingerprint,p_snapshot)
 on conflict(user_id) do update set fingerprint=excluded.fingerprint,
  snapshot=excluded.snapshot,last_seen_at=now()
 returning * into v_row;
 if v_row.brief_fingerprint=p_fingerprint and v_row.generated_at>now()-interval '24 hours' then
  return v_row.brief;
 end if;
 return jsonb_build_object('kind','geai-cache-candidate','brief',v_row.brief,'lastErrorCode',v_row.last_error_code);
end $$;

create or replace function public.claim_gea_geai_brief()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.gea_geai_briefs; v_day date:=(now() at time zone 'UTC')::date; v_token uuid;
begin
 -- One lock serializes the daily budget across all workers/instances.
 perform pg_advisory_xact_lock(hashtextextended('gea-geai-daily-budget',0));
 insert into public.gea_geai_daily_usage(usage_day) values(v_day) on conflict do nothing;
 if (select requests from public.gea_geai_daily_usage where usage_day=v_day)>=24 then return null; end if;
 select b.* into v_row from public.gea_geai_briefs b
 where b.last_seen_at>now()-interval '48 hours'
  and jsonb_array_length(b.snapshot->'sources')>0
  and (b.brief_fingerprint is distinct from b.fingerprint or b.generated_at<now()-interval '24 hours')
  and (b.attempt_window_at is null or b.attempt_window_at<=now()-interval '6 hours'
    or (b.window_attempts<2 and b.last_attempt_at<=now()-interval '15 minutes'
      and (b.last_error_code is not null or (b.lease_until is not null and b.lease_until<=now()))))
  and (b.lease_until is null or b.lease_until<=now())
  and (exists(select 1 from public.admins where auth_user_id=b.user_id)
   or exists(select 1 from public.super_admins where auth_user_id=b.user_id)
   or exists(select 1 from public.teacher_profiles where auth_user_id=b.user_id)
   or exists(select 1 from public.officer_profiles where id=b.user_id and access_enabled))
 order by b.last_attempt_at nulls first,b.last_seen_at desc,b.user_id
 for update skip locked limit 1;
 if not found then return null; end if;
 v_token:=gen_random_uuid();
 update public.gea_geai_briefs set lease_token=v_token,lease_until=now()+interval '2 minutes',last_attempt_at=now(),
  window_attempts=case when attempt_window_at is null or attempt_window_at<=now()-interval '6 hours' then 1 else window_attempts+1 end,
  attempt_window_at=case when attempt_window_at is null or attempt_window_at<=now()-interval '6 hours' then now() else attempt_window_at end,
  last_error_code=null,last_error_at=null
 where user_id=v_row.user_id;
 update public.gea_geai_daily_usage set requests=requests+1 where usage_day=v_day;
 delete from public.gea_geai_daily_usage where usage_day<v_day-30;
 return jsonb_build_object('user_id',v_row.user_id,'fingerprint',v_row.fingerprint,'snapshot',v_row.snapshot,'lease_token',v_token);
end $$;

create or replace function public.finish_gea_geai_brief(p_user_id uuid,p_lease_token uuid,p_fingerprint text,p_brief jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_row public.gea_geai_briefs; v_saved boolean:=false;
begin
 select * into v_row from public.gea_geai_briefs where user_id=p_user_id for update;
 if not found or p_lease_token is null or v_row.lease_token is distinct from p_lease_token
  or v_row.lease_until is null or v_row.lease_until<now() then return false; end if;
 if p_brief is not null and v_row.fingerprint=p_fingerprint then
  update public.gea_geai_briefs set brief=p_brief,brief_fingerprint=p_fingerprint,generated_at=now() where user_id=p_user_id;
  v_saved:=true;
 end if;
 update public.gea_geai_briefs set lease_token=null,lease_until=null,
  last_error_code=case when v_saved then null when p_brief is null then 'generation_failed' else 'source_changed' end,
  last_error_at=case when v_saved then null else now() end where user_id=p_user_id;
 return v_saved;
end $$;
create or replace function public.fail_gea_geai_brief(p_user_id uuid,p_lease_token uuid,p_error_code text)
returns boolean language plpgsql security definer set search_path='' as $$ begin
 update public.gea_geai_briefs set lease_token=null,lease_until=null,last_error_at=now(),
  last_error_code=case when p_error_code in ('rate_limited','provider_auth','provider_unavailable','timeout','invalid_response') then p_error_code else 'generation_failed' end
 where user_id=p_user_id and lease_token=p_lease_token and lease_until>=now();
 return found;
end $$;
revoke all on function public.queue_gea_geai_brief(uuid,text,jsonb),public.claim_gea_geai_brief(),public.finish_gea_geai_brief(uuid,uuid,text,jsonb),public.fail_gea_geai_brief(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.queue_gea_geai_brief(uuid,text,jsonb),public.claim_gea_geai_brief(),public.finish_gea_geai_brief(uuid,uuid,text,jsonb),public.fail_gea_geai_brief(uuid,uuid,text) to service_role;
commit;
