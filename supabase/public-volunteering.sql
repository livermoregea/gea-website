-- Apply after super-admin.sql / teacher-super-admin.sql.
-- Public volunteer events and records are separate from leadership officer tracking.
begin;
create table if not exists public.public_volunteer_events (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(btrim(title)) between 1 and 200),
 description text not null default '' check(length(description)<=10000),
 location text not null default '' check(length(location)<=500),
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at),
 status text not null default 'draft' check(status in ('draft','published','cancelled')),
 signup_open boolean not null default true,
 capacity integer check(capacity between 1 and 10000),
 version integer not null default 1,
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
create table if not exists public.public_volunteer_signups (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.public_volunteer_events(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 160),
 email text not null check(length(email)<=254),
 status text not null default 'registered' check(status in ('registered','withdrawn')),
 attendance text not null default 'unmarked' check(attendance in ('unmarked','present','absent')),
 verified_minutes integer not null default 0 check(verified_minutes between 0 and 1440),
 attendance_note text not null default '' check(length(attendance_note)<=2000),
 version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 unique(event_id,user_id),
 check(verified_minutes=0 or (status='registered' and attendance='present'))
);
create index if not exists public_volunteer_signups_event on public.public_volunteer_signups(event_id,status);
alter table public.public_volunteer_events enable row level security;
alter table public.public_volunteer_signups enable row level security;
drop policy if exists public_volunteer_events_read on public.public_volunteer_events;
create policy public_volunteer_events_read on public.public_volunteer_events for select to anon,authenticated using(status='published');
drop policy if exists public_volunteer_events_member_read on public.public_volunteer_events;
create policy public_volunteer_events_member_read on public.public_volunteer_events for select to authenticated using(
 public.is_staff() or exists(select 1 from public.public_volunteer_signups s where s.event_id=public_volunteer_events.id and s.user_id=auth.uid())
);
drop policy if exists public_volunteer_signups_read on public.public_volunteer_signups;
create policy public_volunteer_signups_read on public.public_volunteer_signups for select to authenticated using(user_id=auth.uid() or public.is_staff());
revoke all on public.public_volunteer_events,public.public_volunteer_signups from public,anon,authenticated;
grant select on public.public_volunteer_events to anon,authenticated;
grant select on public.public_volunteer_signups to authenticated;
grant all on public.public_volunteer_events,public.public_volunteer_signups to service_role;

create or replace function public.save_public_volunteer_event(
 p_title text,p_description text,p_location text,p_starts_at timestamptz,p_ends_at timestamptz,
 p_status text default 'draft',p_signup_open boolean default true,p_capacity integer default null,
 p_id uuid default null,p_version integer default 0
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_event public.public_volunteer_events; v_id uuid; begin
 if auth.uid() is null or not public.is_staff() then raise exception 'Staff access is required.'; end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 200 or p_description is null or length(p_description)>10000
  or p_location is null or length(p_location)>500 or p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at
  or p_status is null or p_status not in ('draft','published','cancelled') or p_signup_open is null
  or (p_capacity is not null and p_capacity not between 1 and 10000) then raise exception 'Enter valid event details, dates, and capacity.'; end if;
 if p_id is null then
  insert into public.public_volunteer_events(title,description,location,starts_at,ends_at,status,signup_open,capacity,created_by,updated_by)
  values(btrim(p_title),p_description,btrim(p_location),p_starts_at,p_ends_at,p_status,p_signup_open,p_capacity,auth.uid(),auth.uid()) returning id into v_id;
 else
  select * into v_event from public.public_volunteer_events where id=p_id for update;
  if not found or p_version is distinct from v_event.version then raise exception 'This event changed. Refresh before saving.'; end if;
  if p_capacity is not null and p_capacity<(select count(*) from public.public_volunteer_signups where event_id=p_id and status='registered') then
   raise exception 'Capacity cannot be lower than the number already signed up.';
  end if;
  update public.public_volunteer_events set title=btrim(p_title),description=p_description,location=btrim(p_location),starts_at=p_starts_at,ends_at=p_ends_at,
   status=p_status,signup_open=p_signup_open,capacity=p_capacity,version=version+1,updated_by=auth.uid(),updated_at=now() where id=p_id;
  v_id:=p_id;
 end if;
 return v_id;
end $$;

create or replace function public.set_public_volunteer_signup(p_event_id uuid,p_registered boolean,p_name text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_event public.public_volunteer_events; v_signup public.public_volunteer_signups; v_email text; v_name text:=btrim(p_name); begin
 if auth.uid() is null then raise exception 'Sign in to GEA One to volunteer.'; end if;
 if p_registered is null then raise exception 'Choose whether to sign up or withdraw.'; end if;
 select * into v_event from public.public_volunteer_events where id=p_event_id for update;
 if not found then raise exception 'Public volunteer event not available.'; end if;
 select * into v_signup from public.public_volunteer_signups where event_id=p_event_id and user_id=auth.uid() for update;
 if p_registered then
  if v_event.status<>'published' or not v_event.signup_open or v_event.starts_at<=now() then raise exception 'Signups for this public event are closed.'; end if;
  if v_signup.status='registered' then return; end if;
  if v_event.capacity is not null and (select count(*) from public.public_volunteer_signups where event_id=p_event_id and status='registered')>=v_event.capacity then
   raise exception 'This public event is full.';
  end if;
  select lower(email) into v_email from auth.users where id=auth.uid();
  if v_name is null or length(v_name) not between 1 and 160 or v_email is null then raise exception 'Enter your full name to sign up.'; end if;
  insert into public.public_volunteer_signups(event_id,user_id,name,email) values(p_event_id,auth.uid(),v_name,v_email)
   on conflict(event_id,user_id) do update set name=excluded.name,email=excluded.email,status='registered',version=public.public_volunteer_signups.version+1,updated_at=now();
 else
  if v_signup.id is null or v_signup.status='withdrawn' then return; end if;
  if v_signup.attendance<>'unmarked' or v_signup.verified_minutes>0 or (v_event.starts_at<=now() and v_event.status<>'cancelled') then
   raise exception 'Contact a coordinator to change a past attendance record.';
  end if;
  update public.public_volunteer_signups set status='withdrawn',version=version+1,updated_at=now() where id=v_signup.id;
 end if;
end $$;

create or replace function public.record_public_volunteer_attendance(
 p_signup_id uuid,p_attendance text,p_minutes integer default 0,p_note text default '',p_version integer default null
) returns void language plpgsql security definer set search_path='' as $$
declare v_signup public.public_volunteer_signups; v_event public.public_volunteer_events; v_event_id uuid; begin
 if auth.uid() is null or not public.is_staff() then raise exception 'Staff access is required.'; end if;
 select event_id into v_event_id from public.public_volunteer_signups where id=p_signup_id;
 -- Match the event-first lock order used by signup and event editing.
 select * into v_event from public.public_volunteer_events where id=v_event_id for update;
 select * into v_signup from public.public_volunteer_signups where id=p_signup_id for update;
 if not found or v_signup.status<>'registered' or p_version is distinct from v_signup.version then raise exception 'This signup changed. Refresh before recording attendance.'; end if;
 if v_event.status<>'published' then raise exception 'Attendance is only available for published public events.'; end if;
 if p_attendance is null or p_attendance not in ('unmarked','present','absent') or p_minutes is null or p_minutes not between 0 and 1440
  or (p_minutes>0 and p_attendance<>'present') or p_note is null or length(p_note)>2000 then raise exception 'Enter valid attendance and verified minutes.'; end if;
 if (p_attendance<>'unmarked' and v_event.starts_at>now()) or (p_minutes>0 and v_event.ends_at>now()) then raise exception 'Record attendance after the event starts and verify hours after it ends.'; end if;
 update public.public_volunteer_signups set attendance=p_attendance,verified_minutes=p_minutes,attendance_note=p_note,
  reviewed_by=auth.uid(),version=version+1,updated_at=now() where id=p_signup_id;
end $$;
revoke all on function public.save_public_volunteer_event(text,text,text,timestamptz,timestamptz,text,boolean,integer,uuid,integer),
 public.set_public_volunteer_signup(uuid,boolean,text),public.record_public_volunteer_attendance(uuid,text,integer,text,integer) from public,anon,authenticated;
grant execute on function public.save_public_volunteer_event(text,text,text,timestamptz,timestamptz,text,boolean,integer,uuid,integer),
 public.set_public_volunteer_signup(uuid,boolean,text),public.record_public_volunteer_attendance(uuid,text,integer,text,integer) to authenticated;
commit;
