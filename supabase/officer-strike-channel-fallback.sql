-- Apply after officer-strike-notice-link-recovery.sql. Deploy the updated bot
-- first. Unlinked officers receive a notices/position-channel alert.
begin;
create or replace function public.enqueue_discord_strike_response()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if to_regclass('public.discord_jobs') is null or new.status not in ('notified','confirmed') then return new; end if;
 if tg_op='UPDATE' then
  if old.status in ('notified','confirmed') then return new; end if;
 end if;
 if exists(select 1 from public.officer_profiles p where p.id=new.officer_id
   and p.access_enabled) then
  insert into public.discord_jobs(id,kind,payload) values('strike-response:'||new.id,'notification',
   jsonb_build_object('topic','strike_response','strike_id',new.id,'officer_id',new.officer_id))
  on conflict(id) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.enqueue_discord_strike_response() from public,anon,authenticated;
drop trigger if exists discord_strike_response_notification on public.officer_strikes;
create trigger discord_strike_response_notification after insert or update of status on public.officer_strikes
 for each row execute function public.enqueue_discord_strike_response();

-- Queue still-open notices omitted by earlier linked-only enqueue logic.
-- Existing receipts are preserved, so reapplying does not resend completed jobs.
do $$ begin
 if to_regclass('public.discord_jobs') is null then return; end if;
 insert into public.discord_jobs(id,kind,payload)
 select 'strike-response:'||s.id,'notification',
  jsonb_build_object('topic','strike_response','strike_id',s.id,'officer_id',s.officer_id)
 from public.officer_strikes s join public.officer_profiles p on p.id=s.officer_id
 where s.status='notified' and s.responded_at is null and s.response_due_at>clock_timestamp() and p.access_enabled
 on conflict(id) do nothing;
end $$;
commit;
