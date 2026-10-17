-- Apply after officer-shared-tasks.sql. Requests and reviewer assignments are independent.
begin;
alter table public.officer_event_signups add column if not exists assigned boolean not null default false;
alter table public.officer_event_signups add column if not exists participation_role text not null default '' check(length(participation_role)<=200);
alter table public.officer_event_signups add column if not exists participation_notes text not null default '' check(length(participation_notes)<=5000);
alter table public.officer_event_signups add column if not exists version integer not null default 1;

create or replace function public.set_officer_event_signup(p_event_id uuid,p_committed boolean)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_officer_access() or not public.is_task_officer(auth.uid()) then raise exception 'Active officer access is required.'; end if;
 if p_committed is null then raise exception 'Choose your participation request status.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind in ('volunteer','outreach') and not cancelled for update;
 if not found then raise exception 'Event not available.'; end if;
 insert into public.officer_event_signups(event_id,officer_id,committed) values(p_event_id,auth.uid(),p_committed)
 on conflict(event_id,officer_id) do update set committed=excluded.committed,
 version=public.officer_event_signups.version+1,updated_at=now();
end $$;

create or replace function public.save_officer_event_assignment(p_event_id uuid,p_officer_id uuid,p_assigned boolean,p_role text,p_notes text,p_version integer)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_officer_access() or not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind in ('volunteer','outreach') and not cancelled for update;
 if not found then raise exception 'Select an active volunteer or outreach event.'; end if;
 if not public.is_task_officer(p_officer_id) then raise exception 'Choose an active officer.'; end if;
 if p_assigned is null then raise exception 'Choose an assignment status.'; end if;
 if p_version is null or coalesce((select version from public.officer_event_signups where event_id=p_event_id and officer_id=p_officer_id),0)<>p_version then
 raise exception 'Participation changed in another session. Reload before saving.'; end if;
 insert into public.officer_event_signups(event_id,officer_id,committed,assigned,participation_role,participation_notes)
 values(p_event_id,p_officer_id,false,p_assigned,btrim(coalesce(p_role,'')),btrim(coalesce(p_notes,'')))
 on conflict(event_id,officer_id) do update set assigned=excluded.assigned,
 participation_role=excluded.participation_role,participation_notes=excluded.participation_notes,
 version=public.officer_event_signups.version+1,updated_at=now();
end $$;
revoke all on function public.set_officer_event_signup(uuid,boolean),public.save_officer_event_assignment(uuid,uuid,boolean,text,text,integer) from public,anon,authenticated;
grant execute on function public.set_officer_event_signup(uuid,boolean),public.save_officer_event_assignment(uuid,uuid,boolean,text,text,integer) to authenticated;
commit;
