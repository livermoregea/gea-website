-- Apply after officer-strike-response-window.sql, before the one-time reissue.
-- Discord installations require discord.sql. Safe to reapply.
begin;
create or replace function public.record_discord_notice_delivery(p_strike_id uuid,p_notice_at timestamptz,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare incident public.officer_strikes; begin
 if p_status is null or p_status not in ('dm_sent','notices_sent','delivery_failed') then raise exception 'Invalid notice delivery status.'; end if;
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

-- Website and Discord responses share this trigger. Notify on the first response
-- in each notice window; later edits do not flood the president channel.
create or replace function public.enqueue_president_strike_response()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.responded_at is null or old.responded_at is not null or to_regclass('public.discord_jobs') is null then return new; end if;
 insert into public.discord_jobs(id,kind,payload) values(
  'strike-president:'||new.id||':'||extract(epoch from new.notified_at)::text||':responded','notification',
  jsonb_build_object('topic','strike_president','strike_id',new.id,'officer_id',new.officer_id,
   'status','responded','occurred_at',new.responded_at,'response_due_at',new.response_due_at))
 on conflict(id) do nothing;
 return new;
end $$;
revoke all on function public.enqueue_president_strike_response() from public,anon,authenticated;
drop trigger if exists president_strike_response on public.officer_strikes;
create trigger president_strike_response after update of responded_at on public.officer_strikes
 for each row execute function public.enqueue_president_strike_response();
commit;
