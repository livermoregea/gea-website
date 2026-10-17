-- Apply after public-volunteering.sql and officer-preregistration.sql.
-- One event record, with a safe public view and separate public/officer rosters.
begin;
alter table public.officer_events add column if not exists public_volunteering boolean not null default false;
alter table public.officer_events add column if not exists public_listing boolean not null default false;
alter table public.officer_events add column if not exists public_description text not null default '' check(length(public_description)<=10000);
alter table public.officer_events add column if not exists public_signup_open boolean not null default true;
alter table public.officer_events add column if not exists public_capacity integer check(public_capacity between 1 and 10000);
alter table public.officer_events add column if not exists public_version integer not null default 1;
alter table public.officer_events drop constraint if exists officer_events_public_kind;
alter table public.officer_events add constraint officer_events_public_kind check(not public_volunteering or kind<>'meeting');
-- Event creators are authenticated people, including staff without officer membership.
alter table public.officer_events drop constraint if exists officer_events_created_by_fkey;
alter table public.officer_events add constraint officer_events_created_by_fkey foreign key(created_by) references auth.users(id);

-- Preserve existing public IDs, signups, attendance and minutes during the transition.
do $$ begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='public_volunteer_events' and c.relkind='r') then
  insert into public.officer_events(id,title,kind,academic_year,starts_at,ends_at,location,cancelled,created_by,public_volunteering,public_listing,public_description,public_signup_open,public_capacity,public_version)
   select id,title,'volunteer',
    (extract(year from starts_at at time zone 'America/Los_Angeles')::int-case when extract(month from starts_at at time zone 'America/Los_Angeles')<7 then 1 else 0 end)::text||'-'||
    (extract(year from starts_at at time zone 'America/Los_Angeles')::int+case when extract(month from starts_at at time zone 'America/Los_Angeles')>=7 then 1 else 0 end)::text,
    starts_at,ends_at,location,status='cancelled',created_by,status<>'draft',true,description,signup_open,capacity,version
   from public.public_volunteer_events;
  alter table public.public_volunteer_signups drop constraint public_volunteer_signups_event_id_fkey;
  alter table public.public_volunteer_events rename to public_volunteer_events_legacy;
  revoke all on public.public_volunteer_events_legacy from public,anon,authenticated;
 end if;
end $$;
alter table public.public_volunteer_signups drop constraint if exists public_volunteer_signups_event_id_fkey;
alter table public.public_volunteer_signups add constraint public_volunteer_signups_event_id_fkey foreign key(event_id) references public.officer_events(id);

-- This view intentionally exposes only the public description, never officer notes.
create or replace view public.public_volunteer_events with (security_barrier=true) as
 select e.id,e.title,e.public_description as description,e.location,e.starts_at,e.ends_at,
  case when e.cancelled then 'cancelled' when e.public_volunteering then 'published' else 'draft' end as status,
  e.public_signup_open as signup_open,e.public_capacity as capacity,e.public_version as version
 from public.officer_events e
 where e.kind<>'meeting' and e.public_listing and
  ((e.public_volunteering and not e.cancelled) or public.is_staff() or exists(
    select 1 from public.public_volunteer_signups s where s.event_id=e.id and s.user_id=auth.uid()));
revoke all on public.public_volunteer_events from public,anon,authenticated;
grant select on public.public_volunteer_events to anon,authenticated,service_role;

create or replace function public.guard_officer_membership()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is not null and not public.has_officer_access() and not public.is_super_admin()
  and not (tg_table_name='officer_events' and public.is_staff()) then raise exception 'Active officer access is required.'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create or replace function public.version_public_event()
returns trigger language plpgsql set search_path='' as $$ begin
 new.public_listing:=new.public_listing or new.public_volunteering;
 if tg_op='UPDATE' then new.public_version:=old.public_version+1; end if;
 return new;
end $$;
drop trigger if exists public_event_version on public.officer_events;
create trigger public_event_version before insert or update on public.officer_events for each row execute function public.version_public_event();

-- Replace the old signature so PostgREST has one unambiguous event save function.
drop function if exists public.save_officer_event(text,text,text,timestamptz,timestamptz,text,boolean,boolean,text,uuid,boolean);
create or replace function public.save_officer_event(p_title text,p_kind text,p_year text,p_starts_at timestamptz,p_ends_at timestamptz,
  p_location text default '',p_mandatory boolean default false,p_approved boolean default false,p_notes text default '',p_event_id uuid default null,p_cancelled boolean default false,
  p_public_volunteering boolean default null,p_public_description text default null,
  p_public_signup_open boolean default null,p_public_capacity integer default null)
returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid; begin
  if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 200 or p_kind is null or p_kind not in ('meeting','volunteer','outreach')
    or p_year is null or p_year !~ '^[0-9]{4}-[0-9]{4}$' or right(p_year,4)::int<>left(p_year,4)::int+1
    or p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at
    or p_location is null or length(p_location)>500 or p_notes is null or length(p_notes)>10000
    or p_mandatory is null or p_approved is null or p_cancelled is null then raise exception 'Check the event title, school year, dates, and details.'; end if;
  if (p_public_volunteering and p_kind='meeting') or (p_public_description is not null and length(p_public_description)>10000)
    or (p_public_capacity is not null and p_public_capacity not between 1 and 10000) then
    raise exception 'Only volunteer or outreach events can be public. Check the public details and capacity.';
  end if;
  if p_event_id is null then
    insert into public.officer_events(title,kind,academic_year,starts_at,ends_at,location,mandatory,gea_approved,notes,created_by,cancelled,public_volunteering,public_listing,public_description,public_signup_open,public_capacity)
      values(btrim(p_title),p_kind,p_year,p_starts_at,p_ends_at,p_location,p_mandatory,p_approved,p_notes,auth.uid(),p_cancelled,coalesce(p_public_volunteering,false),coalesce(p_public_volunteering,false),coalesce(p_public_description,''),coalesce(p_public_signup_open,true),p_public_capacity) returning id into v_id;
  else
    perform 1 from public.officer_events where id=p_event_id for update;
    if not found then raise exception 'Event not available.'; end if;
    if p_kind='meeting' and exists(select 1 from public.officer_events where id=p_event_id and public_volunteering)
      and p_public_volunteering is distinct from false then raise exception 'Leadership meetings cannot be public volunteer events.'; end if;
    if p_public_volunteering is not null and p_public_capacity is not null
      and p_public_capacity<(select count(*) from public.public_volunteer_signups where event_id=p_event_id and status='registered') then
      raise exception 'Capacity cannot be lower than the number already signed up.';
    end if;
    if exists(select 1 from public.public_volunteer_signups where event_id=p_event_id)
      or exists(select 1 from public.officer_attendance where event_id=p_event_id)
      or exists(select 1 from public.officer_volunteer_logs where event_id=p_event_id)
      or exists(select 1 from public.officer_event_signups where event_id=p_event_id) then
      if exists(select 1 from public.officer_events where id=p_event_id and (kind<>p_kind or academic_year<>p_year)) then
        raise exception 'An event with records must keep its category and school year.';
      end if;
    end if;
    update public.officer_events set title=btrim(p_title),kind=p_kind,academic_year=p_year,starts_at=p_starts_at,ends_at=p_ends_at,
      location=p_location,mandatory=p_mandatory,gea_approved=p_approved,notes=p_notes,cancelled=p_cancelled,updated_at=now(),
      public_volunteering=coalesce(p_public_volunteering,public_volunteering),
      public_listing=public_listing or coalesce(p_public_volunteering,false),
      public_description=coalesce(p_public_description,public_description),
      public_signup_open=coalesce(p_public_signup_open,public_signup_open),
      public_capacity=case when p_public_volunteering is distinct from true then public_capacity else p_public_capacity end where id=p_event_id;
    v_id:=p_event_id;
  end if;
  return v_id;
end $$;


-- The public admin editor updates the very same event and preserves officer-only data.
create or replace function public.save_public_volunteer_event(
 p_title text,p_description text,p_location text,p_starts_at timestamptz,p_ends_at timestamptz,
 p_status text default 'draft',p_signup_open boolean default true,p_capacity integer default null,
 p_id uuid default null,p_version integer default 0
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_event public.officer_events; v_id uuid; v_year integer; begin
 if auth.uid() is null or not public.is_staff() then raise exception 'Staff access is required.'; end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 200 or p_description is null or length(p_description)>10000
  or p_location is null or length(p_location)>500 or p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at
  or p_status is null or p_status not in ('draft','published','cancelled') or p_signup_open is null
  or (p_capacity is not null and p_capacity not between 1 and 10000) then raise exception 'Enter valid event details, dates, and capacity.'; end if;
 if p_id is null then
  v_year:=extract(year from p_starts_at at time zone 'America/Los_Angeles')::int-case when extract(month from p_starts_at at time zone 'America/Los_Angeles')<7 then 1 else 0 end;
  insert into public.officer_events(title,kind,academic_year,starts_at,ends_at,location,cancelled,created_by,public_volunteering,public_listing,public_description,public_signup_open,public_capacity)
  values(btrim(p_title),'volunteer',v_year::text||'-'||(v_year+1)::text,p_starts_at,p_ends_at,btrim(p_location),p_status='cancelled',auth.uid(),p_status<>'draft',true,p_description,p_signup_open,p_capacity) returning id into v_id;
 else
  select * into v_event from public.officer_events where id=p_id for update;
  if not found or not v_event.public_listing or p_version is distinct from v_event.public_version then raise exception 'This event changed. Refresh before saving.'; end if;
  if p_capacity is not null and p_capacity<(select count(*) from public.public_volunteer_signups where event_id=p_id and status='registered') then
   raise exception 'Capacity cannot be lower than the number already signed up.';
  end if;
  update public.officer_events set title=btrim(p_title),public_description=p_description,location=btrim(p_location),starts_at=p_starts_at,ends_at=p_ends_at,
   cancelled=p_status='cancelled',public_volunteering=p_status<>'draft',public_signup_open=p_signup_open,public_capacity=p_capacity,updated_at=now() where id=p_id;
  v_id:=p_id;
 end if;
 return v_id;
end $$;
create or replace function public.set_public_volunteer_signup(p_event_id uuid,p_registered boolean,p_name text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_event public.officer_events; v_signup public.public_volunteer_signups; v_email text; v_name text:=btrim(p_name); begin
 if auth.uid() is null then raise exception 'Sign in to GEA One to volunteer.'; end if;
 if p_registered is null then raise exception 'Choose whether to sign up or withdraw.'; end if;
 select * into v_event from public.officer_events where id=p_event_id for update;
 if not found or not v_event.public_listing or (not v_event.public_volunteering and not exists(select 1 from public.public_volunteer_signups where event_id=p_event_id and user_id=auth.uid())) then raise exception 'Public volunteer event not available.'; end if;
 select * into v_signup from public.public_volunteer_signups where event_id=p_event_id and user_id=auth.uid() for update;
 if p_registered then
  if not v_event.public_volunteering or v_event.cancelled or not v_event.public_signup_open or v_event.starts_at<=now() then raise exception 'Signups for this public event are closed.'; end if;
  if v_signup.status='registered' then return; end if;
  if v_event.public_capacity is not null and (select count(*) from public.public_volunteer_signups where event_id=p_event_id and status='registered')>=v_event.public_capacity then
   raise exception 'This public event is full.';
  end if;
  select lower(email) into v_email from auth.users where id=auth.uid();
  if v_name is null or length(v_name) not between 1 and 160 or v_email is null then raise exception 'Enter your full name to sign up.'; end if;
  insert into public.public_volunteer_signups(event_id,user_id,name,email) values(p_event_id,auth.uid(),v_name,v_email)
   on conflict(event_id,user_id) do update set name=excluded.name,email=excluded.email,status='registered',version=public.public_volunteer_signups.version+1,updated_at=now();
 else
  if v_signup.id is null or v_signup.status='withdrawn' then return; end if;
  if v_signup.attendance<>'unmarked' or v_signup.verified_minutes>0 or (v_event.starts_at<=now() and not v_event.cancelled) then
   raise exception 'Contact a coordinator to change a past attendance record.';
  end if;
  update public.public_volunteer_signups set status='withdrawn',version=version+1,updated_at=now() where id=v_signup.id;
 end if;
end $$;

create or replace function public.record_public_volunteer_attendance(
 p_signup_id uuid,p_attendance text,p_minutes integer default 0,p_note text default '',p_version integer default null
) returns void language plpgsql security definer set search_path='' as $$
declare v_signup public.public_volunteer_signups; v_event public.officer_events; v_event_id uuid; begin
 if auth.uid() is null or not public.is_staff() then raise exception 'Staff access is required.'; end if;
 select event_id into v_event_id from public.public_volunteer_signups where id=p_signup_id;
 -- Match the event-first lock order used by signup and event editing.
 select * into v_event from public.officer_events where id=v_event_id for update;
 select * into v_signup from public.public_volunteer_signups where id=p_signup_id for update;
 if not found or v_signup.status<>'registered' or p_version is distinct from v_signup.version then raise exception 'This signup changed. Refresh before recording attendance.'; end if;
 if not v_event.public_volunteering or v_event.cancelled then raise exception 'Attendance is only available for published public events.'; end if;
 if p_attendance is null or p_attendance not in ('unmarked','present','absent') or p_minutes is null or p_minutes not between 0 and 1440
  or (p_minutes>0 and p_attendance<>'present') or p_note is null or length(p_note)>2000 then raise exception 'Enter valid attendance and verified minutes.'; end if;
 if (p_attendance<>'unmarked' and v_event.starts_at>now()) or (p_minutes>0 and v_event.ends_at>now()) then raise exception 'Record attendance after the event starts and verify hours after it ends.'; end if;
 update public.public_volunteer_signups set attendance=p_attendance,verified_minutes=p_minutes,attendance_note=p_note,
  reviewed_by=auth.uid(),version=version+1,updated_at=now() where id=p_signup_id;
end $$;
revoke all on function public.version_public_event(),public.guard_officer_membership(),
 public.save_officer_event(text,text,text,timestamptz,timestamptz,text,boolean,boolean,text,uuid,boolean,boolean,text,boolean,integer),
 public.save_public_volunteer_event(text,text,text,timestamptz,timestamptz,text,boolean,integer,uuid,integer),
 public.set_public_volunteer_signup(uuid,boolean,text),public.record_public_volunteer_attendance(uuid,text,integer,text,integer) from public,anon,authenticated;
grant execute on function public.save_officer_event(text,text,text,timestamptz,timestamptz,text,boolean,boolean,text,uuid,boolean,boolean,text,boolean,integer),
 public.save_public_volunteer_event(text,text,text,timestamptz,timestamptz,text,boolean,integer,uuid,integer),
 public.set_public_volunteer_signup(uuid,boolean,text),public.record_public_volunteer_attendance(uuid,text,integer,text,integer) to authenticated;
commit;
