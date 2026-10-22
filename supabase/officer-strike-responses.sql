-- Apply after officer-strike-notifications.sql. Discord installations also need
-- discord.sql and discord-officer-workspace.sql. Safe to reapply.
begin;

-- Responses supplement the record; reviewers retain control of strike decisions.
create or replace function public.respond_officer_strike(p_strike_id uuid,p_response text)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.officer_profiles where id=auth.uid() and access_enabled) then
  raise exception 'Active officer access is required.';
 end if;
 if p_response is null or length(btrim(p_response)) not between 10 and 10000 then
  raise exception 'Explain your circumstances in 10–10000 characters.';
 end if;
 update public.officer_strikes set officer_response=btrim(p_response),responded_at=now()
 where id=p_strike_id and officer_id=auth.uid() and status in ('notified','confirmed');
 if not found then raise exception 'This incident is unavailable or has already been resolved.'; end if;
end $$;
revoke all on function public.respond_officer_strike(uuid,text) from public,anon,authenticated;
grant execute on function public.respond_officer_strike(uuid,text) to authenticated,service_role;

-- A dedicated, service-only bridge derives the actor from the verified link.
create or replace function public.discord_strike_response(p_discord_id text,p_strike_id uuid,p_response text,p_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; result jsonb; begin
 select p.id into actor from public.officer_profiles p
 where to_jsonb(p)->>'discord_id'=p_discord_id and p.access_enabled;
 if actor is null then raise exception 'Connect your active GEA One account to Discord first.'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 if p_key is null or length(p_key) not between 1 and 200 then raise exception 'A response receipt is required.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key,0));
 select a.result into result from public.discord_actions a where a.id=p_key;
 if found then return result; end if;
 perform public.respond_officer_strike(p_strike_id,p_response);
 result:=jsonb_build_object('saved',true);
 insert into public.discord_actions(id,result) values(p_key,result);
 return result;
end $$;
revoke all on function public.discord_strike_response(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.discord_strike_response(text,uuid,text,text) to service_role;

-- This trigger covers manual conduct strikes and automatic attendance strikes
-- from both website roll call and Discord. No network calls in the transaction.
create or replace function public.enqueue_discord_strike_response()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if to_regclass('public.discord_jobs') is null or new.status not in ('notified','confirmed') then return new; end if;
 if tg_op='UPDATE' then
  if old.status in ('notified','confirmed') then return new; end if;
 end if;
 if exists(select 1 from public.officer_profiles p where p.id=new.officer_id
   and p.access_enabled and to_jsonb(p)->>'discord_id' is not null) then
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
commit;
