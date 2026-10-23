-- Apply after officer-strike-president-updates.sql. Deploy updated bot first.
-- Reports missing links and delivers open notices when officers connect Discord.
-- Safe to reapply; existing outbox receipts are not reset by the backfill.
begin;
create or replace function public.record_discord_notice_delivery(p_strike_id uuid,p_notice_at timestamptz,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare incident public.officer_strikes; begin
 if p_status is null or p_status not in ('dm_sent','notices_sent','delivery_failed','not_linked') then raise exception 'Invalid notice delivery status.'; end if;
 select * into incident from public.officer_strikes where id=p_strike_id and notified_at=p_notice_at;
 if not found then return; end if;
 insert into public.discord_jobs(id,kind,payload) values(
  'strike-president:'||incident.id||':'||extract(epoch from incident.notified_at)::text||':'||p_status,'notification',
  jsonb_build_object('topic','strike_president','strike_id',incident.id,'officer_id',incident.officer_id,
   'status',p_status,'occurred_at',clock_timestamp(),'response_due_at',incident.response_due_at))
 on conflict(id) do nothing;
end $$;
revoke all on function public.record_discord_notice_delivery(uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_discord_notice_delivery(uuid,timestamptz,text) to service_role;


create or replace function public.enqueue_unlinked_officer_notice()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if to_regclass('public.discord_jobs') is null or new.status<>'notified' or new.responded_at is not null then return new; end if;
 if tg_op='UPDATE' then
  if old.status='notified' and old.notified_at=new.notified_at then return new; end if;
 end if;
 if exists(select 1 from public.officer_profiles p where p.id=new.officer_id and p.access_enabled and to_jsonb(p)->>'discord_id' is null) then
  perform public.record_discord_notice_delivery(new.id,new.notified_at,'not_linked');
 end if;
 return new;
end $$;
revoke all on function public.enqueue_unlinked_officer_notice() from public,anon,authenticated;
drop trigger if exists unlinked_officer_notice on public.officer_strikes;
create trigger unlinked_officer_notice after insert or update of status,notified_at on public.officer_strikes
 for each row execute function public.enqueue_unlinked_officer_notice();

create or replace function public.enqueue_notices_on_discord_link()
returns trigger language plpgsql security definer set search_path='' as $$
declare discord_id text:=to_jsonb(new)->>'discord_id'; incident record; begin
 if to_regclass('public.discord_jobs') is null or not new.access_enabled or discord_id is null then return new; end if;
 if tg_op='UPDATE' then
  if old.access_enabled and to_jsonb(old)->>'discord_id'=discord_id then return new; end if;
 end if;
 for incident in select id from public.officer_strikes where officer_id=new.id
  and status='notified' and responded_at is null and response_due_at>clock_timestamp()
 loop
  insert into public.discord_jobs(id,kind,payload) values('strike-response:'||incident.id,'notification',
   jsonb_build_object('topic','strike_response','strike_id',incident.id,'officer_id',new.id))
  on conflict(id) do update set payload=excluded.payload,available_at=clock_timestamp(),attempts=0,
   leased_until=null,finished_at=null,failed=false
  where discord_jobs.finished_at is not null or discord_jobs.failed;
 end loop;
 return new;
end $$;
revoke all on function public.enqueue_notices_on_discord_link() from public,anon,authenticated;
drop trigger if exists notices_on_discord_link on public.officer_profiles;
create trigger notices_on_discord_link after insert or update on public.officer_profiles
 for each row execute function public.enqueue_notices_on_discord_link();

-- Recover currently open notices without extending deadlines or rerunning the
-- one-time reissue. Missing links are reported to the president instead.
do $$ declare incident record; begin
 if to_regclass('public.discord_jobs') is null then return; end if;
 for incident in select s.id,s.officer_id,s.notified_at,to_jsonb(p)->>'discord_id' as discord_id
  from public.officer_strikes s join public.officer_profiles p on p.id=s.officer_id
  where s.status='notified' and s.responded_at is null and p.access_enabled
 loop
  if incident.discord_id is null then
   perform public.record_discord_notice_delivery(incident.id,incident.notified_at,'not_linked');
  elsif exists(select 1 from public.officer_strikes where id=incident.id and response_due_at>clock_timestamp()) then
   insert into public.discord_jobs(id,kind,payload) values('strike-response:'||incident.id,'notification',
    jsonb_build_object('topic','strike_response','strike_id',incident.id,'officer_id',incident.officer_id))
   on conflict(id) do nothing;
  end if;
 end loop;
end $$;
commit;
