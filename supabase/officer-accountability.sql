-- Contract-based attendance, volunteer service, and accountability.
-- Run AFTER officerboard.sql in the existing Supabase project's SQL editor.
begin;
alter table public.officer_profiles add column if not exists position text not null default '';
alter table public.officer_profiles add column if not exists reviewer_kind text;
alter table public.officer_profiles add column if not exists peet_onboarding_seen_at timestamptz;
-- Existing reviewers remain Presidents unless an advisor is explicitly designated.
update public.officer_profiles set reviewer_kind = 'president' where role = 'admin' and reviewer_kind is null;
alter table public.officer_profiles drop constraint if exists officer_reviewer_kind_check;
alter table public.officer_profiles add constraint officer_reviewer_kind_check
  check ((role = 'officer' and reviewer_kind is null) or (role = 'admin' and reviewer_kind in ('president','advisor') and reviewer_kind is not null));

create or replace function public.is_peet_advisor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.officer_profiles where id = auth.uid() and role = 'admin' and reviewer_kind = 'advisor');
$$;

create table if not exists public.officer_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(btrim(title)) between 1 and 200),
  kind text not null check(kind in ('meeting','volunteer','outreach')),
  academic_year text not null check(academic_year ~ '^[0-9]{4}-[0-9]{4}$' and right(academic_year,4)::int = left(academic_year,4)::int + 1),
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at > starts_at),
  location text not null default '' check(length(location)<=500),
  mandatory boolean not null default false,
  gea_approved boolean not null default false,
  cancelled boolean not null default false,
  notes text not null default '' check(length(notes)<=10000),
  created_by uuid not null references public.officer_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.officer_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.officer_events(id),
  officer_id uuid not null references public.officer_profiles(id),
  status text not null default 'unmarked' check(status in ('unmarked','present','late','excused','unexcused')),
  absence_notice text not null default '' check(length(absence_notice)<=10000),
  notice_at timestamptz,
  reviewer_notes text not null default '' check(length(reviewer_notes)<=10000),
  recorded_by uuid references public.officer_profiles(id),
  updated_at timestamptz not null default now(),
  unique(event_id,officer_id)
);
create table if not exists public.officer_event_signups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.officer_events(id),
  officer_id uuid not null references public.officer_profiles(id),
  committed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,officer_id)
);
create table if not exists public.officer_volunteer_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.officer_events(id),
  officer_id uuid not null references public.officer_profiles(id),
  check_in timestamptz not null,
  check_out timestamptz not null check(check_out > check_in and check_out <= check_in + interval '24 hours'),
  minutes integer generated always as (floor(extract(epoch from (check_out-check_in))/60)::integer) stored,
  notes text not null default '' check(length(notes)<=10000),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  reviewed_by uuid references public.officer_profiles(id),
  review_notes text not null default '' check(length(review_notes)<=10000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,officer_id),
  check(check_out >= check_in + interval '1 minute')
);
create table if not exists public.officer_strikes (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid not null references public.officer_profiles(id),
  academic_year text not null check(academic_year ~ '^[0-9]{4}-[0-9]{4}$' and right(academic_year,4)::int = left(academic_year,4)::int + 1),
  category text not null check(category in ('attendance','conduct')),
  incident_date date not null,
  reason text not null check(length(btrim(reason)) between 10 and 10000),
  attendance_id uuid references public.officer_attendance(id),
  status text not null default 'notified' check(status in ('notified','confirmed','dismissed','revoked')),
  notified_at timestamptz not null default now(),
  response_due_at timestamptz not null check(response_due_at > notified_at),
  officer_response text not null default '' check(length(officer_response)<=10000),
  responded_at timestamptz,
  decision_notes text not null default '' check(length(decision_notes)<=10000),
  decided_by uuid references public.officer_profiles(id),
  decided_at timestamptz,
  created_by uuid not null references public.officer_profiles(id),
  created_at timestamptz not null default now(),
  check(attendance_id is null or category='attendance')
);
create unique index if not exists officer_strikes_attendance_active_idx on public.officer_strikes(attendance_id)
  where attendance_id is not null and status in ('notified','confirmed');
create table if not exists public.officer_removal_reviews (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid not null references public.officer_profiles(id),
  academic_year text not null,
  category text not null check(category in ('attendance','conduct')),
  status text not null default 'pending' check(status in ('pending','retained','removal_approved')),
  context_snapshot jsonb not null,
  advisor_notes text not null default '' check(length(advisor_notes)<=10000),
  opened_at timestamptz not null default now(),
  decided_by uuid references public.officer_profiles(id),
  decided_at timestamptz,
  unique(officer_id,academic_year,category)
);
create table if not exists public.officer_tracking_audit (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid references public.officer_profiles(id),
  table_name text not null,
  record_id uuid not null,
  actor_id uuid references auth.users(id),
  action text not null,
  before_record jsonb,
  after_record jsonb,
  recorded_at timestamptz not null default now()
);
create table if not exists public.officer_accountability_notes (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid not null references public.officer_profiles(id),
  academic_year text not null check(academic_year ~ '^[0-9]{4}-[0-9]{4}$' and right(academic_year,4)::int=left(academic_year,4)::int+1),
  notes text not null check(length(notes)<=10000),
  recorded_by uuid not null references public.officer_profiles(id),
  updated_at timestamptz not null default now(),
  unique(officer_id,academic_year)
);
create index if not exists officer_events_year_idx on public.officer_events(academic_year,starts_at);
create index if not exists officer_attendance_officer_idx on public.officer_attendance(officer_id);
create index if not exists officer_volunteer_officer_idx on public.officer_volunteer_logs(officer_id);
create index if not exists officer_strikes_officer_idx on public.officer_strikes(officer_id,academic_year,category,status);

-- Calendar is shared with members. All personal records are self-only or reviewer-only.
alter table public.officer_events enable row level security;
drop policy if exists officer_events_read on public.officer_events;
create policy officer_events_read on public.officer_events for select to authenticated
  using(exists(select 1 from public.officer_profiles where id=auth.uid()));
do $$ declare t text; begin
  foreach t in array array['officer_attendance','officer_event_signups','officer_volunteer_logs','officer_strikes','officer_removal_reviews','officer_tracking_audit','officer_accountability_notes'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists officer_tracking_read on public.%I',t);
    execute format('create policy officer_tracking_read on public.%I for select to authenticated using(public.is_peet_admin() or (officer_id=auth.uid() and exists(select 1 from public.officer_profiles where id=auth.uid())))',t);
  end loop;
end $$;
revoke all on public.officer_events, public.officer_attendance, public.officer_event_signups,
  public.officer_volunteer_logs, public.officer_strikes, public.officer_removal_reviews,
  public.officer_tracking_audit,public.officer_accountability_notes from public,anon,authenticated;
grant select on public.officer_events, public.officer_attendance, public.officer_event_signups,
  public.officer_volunteer_logs, public.officer_strikes, public.officer_removal_reviews,
  public.officer_tracking_audit,public.officer_accountability_notes to authenticated;
grant all on public.officer_events, public.officer_attendance, public.officer_event_signups,
  public.officer_volunteer_logs, public.officer_strikes, public.officer_removal_reviews,
  public.officer_tracking_audit,public.officer_accountability_notes to service_role;

create or replace function public.audit_officer_tracking()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_old jsonb; v_new jsonb; begin
  if tg_op <> 'INSERT' then v_old:=to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new:=to_jsonb(new); end if;
  insert into public.officer_tracking_audit(officer_id,table_name,record_id,actor_id,action,before_record,after_record)
    values(coalesce(v_new->>'officer_id',v_old->>'officer_id')::uuid,tg_table_name,
      coalesce(v_new->>'id',v_old->>'id')::uuid,auth.uid(),tg_op,v_old,v_new);
  return coalesce(new,old);
end $$;
do $$ declare t text; begin
  foreach t in array array['officer_events','officer_attendance','officer_event_signups','officer_volunteer_logs','officer_strikes','officer_removal_reviews','officer_accountability_notes'] loop
    execute format('drop trigger if exists officer_tracking_audit on public.%I',t);
    execute format('create trigger officer_tracking_audit after insert or update or delete on public.%I for each row execute function public.audit_officer_tracking()',t);
  end loop;
end $$;

create or replace function public.mark_peet_onboarding_seen()
returns void language plpgsql security definer set search_path='' as $$ begin
  update public.officer_profiles set peet_onboarding_seen_at=coalesce(peet_onboarding_seen_at,now()) where id=auth.uid();
  if not found then raise exception 'Officer access is required.'; end if;
end $$;

create or replace function public.save_officer_accountability_notes(p_officer_id uuid,p_year text,p_notes text)
returns void language plpgsql security definer set search_path='' as $$ begin
  if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
  if p_notes is null or length(p_notes)>10000 then raise exception 'Notes must be at most 10,000 characters.'; end if;
  insert into public.officer_accountability_notes(officer_id,academic_year,notes,recorded_by)
    values(p_officer_id,p_year,p_notes,auth.uid()) on conflict(officer_id,academic_year)
    do update set notes=excluded.notes,recorded_by=auth.uid(),updated_at=now();
end $$;

create or replace function public.save_officer_event(p_title text,p_kind text,p_year text,p_starts_at timestamptz,p_ends_at timestamptz,
  p_location text default '',p_mandatory boolean default false,p_approved boolean default false,p_notes text default '',p_event_id uuid default null,p_cancelled boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid; begin
  if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 200 or p_kind is null or p_kind not in ('meeting','volunteer','outreach')
    or p_year is null or p_year !~ '^[0-9]{4}-[0-9]{4}$' or right(p_year,4)::int<>left(p_year,4)::int+1
    or p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at
    or p_location is null or length(p_location)>500 or p_notes is null or length(p_notes)>10000
    or p_mandatory is null or p_approved is null or p_cancelled is null then raise exception 'Check the event title, school year, dates, and details.'; end if;
  if p_event_id is null then
    insert into public.officer_events(title,kind,academic_year,starts_at,ends_at,location,mandatory,gea_approved,notes,created_by,cancelled)
      values(btrim(p_title),p_kind,p_year,p_starts_at,p_ends_at,p_location,p_mandatory,p_approved,p_notes,auth.uid(),p_cancelled) returning id into v_id;
  else
    perform 1 from public.officer_events where id=p_event_id for update;
    if not found then raise exception 'Event not available.'; end if;
    if exists(select 1 from public.officer_attendance where event_id=p_event_id)
      or exists(select 1 from public.officer_volunteer_logs where event_id=p_event_id)
      or exists(select 1 from public.officer_event_signups where event_id=p_event_id) then
      if exists(select 1 from public.officer_events where id=p_event_id and (kind<>p_kind or academic_year<>p_year)) then
        raise exception 'An event with records must keep its category and school year.';
      end if;
    end if;
    update public.officer_events set title=btrim(p_title),kind=p_kind,academic_year=p_year,starts_at=p_starts_at,ends_at=p_ends_at,
      location=p_location,mandatory=p_mandatory,gea_approved=p_approved,notes=p_notes,cancelled=p_cancelled,updated_at=now() where id=p_event_id;
    v_id:=p_event_id;
  end if;
  return v_id;
end $$;

create or replace function public.record_officer_attendance(p_event_id uuid,p_officer_id uuid,p_status text,p_notes text default '')
returns void language plpgsql security definer set search_path='' as $$ declare v_event public.officer_events; begin
  if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
  select * into v_event from public.officer_events where id=p_event_id for update;
  if not found or v_event.cancelled then raise exception 'Select a scheduled meeting or service event.'; end if;
  if p_status is null or p_status not in ('unmarked','present','late','excused','unexcused') or p_notes is null or length(p_notes)>10000 then raise exception 'Check the attendance status and notes.'; end if;
  if not exists(select 1 from public.officer_profiles where id=p_officer_id) then raise exception 'Officer not available.'; end if;
  if p_status in ('present','late','unexcused') and v_event.starts_at>now() then raise exception 'Record actual attendance after the event begins.'; end if;
  if p_status<>'unexcused' and exists(select 1 from public.officer_strikes s join public.officer_attendance a on a.id=s.attendance_id
    where a.event_id=p_event_id and a.officer_id=p_officer_id and s.status='confirmed') then raise exception 'Revoke the linked attendance strike before correcting this absence.'; end if;
  insert into public.officer_attendance(event_id,officer_id,status,reviewer_notes,recorded_by)
    values(p_event_id,p_officer_id,p_status,p_notes,auth.uid()) on conflict(event_id,officer_id)
    do update set status=excluded.status,reviewer_notes=excluded.reviewer_notes,recorded_by=auth.uid(),updated_at=now();
end $$;

create or replace function public.notify_officer_absence(p_event_id uuid,p_notice text)
returns void language plpgsql security definer set search_path='' as $$ begin
  if not exists(select 1 from public.officer_profiles where id=auth.uid()) then raise exception 'Officer access is required.'; end if;
  if p_notice is null or length(btrim(p_notice)) not between 1 and 10000 then raise exception 'Explain the relevant circumstances.'; end if;
  perform 1 from public.officer_events where id=p_event_id and kind='meeting' and not cancelled for update;
  if not found then raise exception 'Meeting not available.'; end if;
  insert into public.officer_attendance(event_id,officer_id,absence_notice,notice_at)
    values(p_event_id,auth.uid(),p_notice,now()) on conflict(event_id,officer_id)
    do update set absence_notice=excluded.absence_notice,notice_at=coalesce(public.officer_attendance.notice_at,now()),updated_at=now();
end $$;

create or replace function public.set_officer_event_signup(p_event_id uuid,p_committed boolean)
returns void language plpgsql security definer set search_path='' as $$ begin
  if not exists(select 1 from public.officer_profiles where id=auth.uid()) then raise exception 'Officer access is required.'; end if;
  if p_committed is null then raise exception 'Choose your participation status.'; end if;
  perform 1 from public.officer_events where id=p_event_id and kind in ('volunteer','outreach') and not cancelled for update;
  if not found then raise exception 'Event not available.'; end if;
  insert into public.officer_event_signups(event_id,officer_id,committed) values(p_event_id,auth.uid(),p_committed)
    on conflict(event_id,officer_id) do update set committed=excluded.committed,updated_at=now();
end $$;

create or replace function public.submit_officer_volunteer(p_event_id uuid,p_check_in timestamptz,p_check_out timestamptz,p_notes text default '',p_officer_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_officer uuid:=coalesce(p_officer_id,auth.uid()); v_event public.officer_events; begin
  if not exists(select 1 from public.officer_profiles where id=auth.uid()) or (v_officer<>auth.uid() and not public.is_peet_admin()) then raise exception 'You can only log your own volunteer work.'; end if;
  select * into v_event from public.officer_events where id=p_event_id for update;
  if not found or v_event.kind not in ('volunteer','outreach') or v_event.cancelled then raise exception 'Event not available.'; end if;
  if p_check_in is null or p_check_out is null or p_check_out<p_check_in+interval '1 minute'
    or p_check_out>p_check_in+interval '24 hours' or p_check_out>now()
    or p_check_in<v_event.starts_at-interval '12 hours' or p_check_out>v_event.ends_at+interval '12 hours'
    or p_notes is null or length(p_notes)>10000 then raise exception 'Enter actual check-in and check-out times near the event, between 1 minute and 24 hours apart.'; end if;
  perform 1 from public.officer_volunteer_logs where event_id=p_event_id and officer_id=v_officer for update;
  if exists(select 1 from public.officer_volunteer_logs where event_id=p_event_id and officer_id=v_officer and status='approved') then raise exception 'Approved volunteer work is locked. Ask a reviewer to return it for correction.'; end if;
  insert into public.officer_volunteer_logs(event_id,officer_id,check_in,check_out,notes)
    values(p_event_id,v_officer,p_check_in,p_check_out,p_notes) on conflict(event_id,officer_id)
    do update set check_in=excluded.check_in,check_out=excluded.check_out,notes=excluded.notes,status='pending',
      reviewed_by=null,reviewed_at=null,review_notes='',updated_at=now();
end $$;

create or replace function public.review_officer_volunteer(p_log_id uuid,p_status text,p_notes text default '')
returns void language plpgsql security definer set search_path='' as $$ begin
  if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
  if p_status is null or p_status not in ('approved','rejected') or p_notes is null or length(p_notes)>10000
    or (p_status='rejected' and length(btrim(p_notes))<10) then raise exception 'Choose approved or returned, and explain any requested correction.'; end if;
  update public.officer_volunteer_logs set status=p_status,reviewed_by=auth.uid(),review_notes=p_notes,reviewed_at=now(),updated_at=now() where id=p_log_id;
  if not found then raise exception 'Volunteer log not available.'; end if;
end $$;

create or replace function public.create_officer_strike(p_officer_id uuid,p_year text,p_category text,p_incident_date date,p_reason text,p_response_due_at timestamptz,p_attendance_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid; begin
  if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
  if not exists(select 1 from public.officer_profiles where id=p_officer_id and reviewer_kind is distinct from 'advisor') then raise exception 'Select a leadership officer, not a faculty advisor.'; end if;
  if p_category is null or p_category not in ('attendance','conduct') or p_incident_date is null or p_incident_date>current_date
    or p_year is null or p_year !~ '^[0-9]{4}-[0-9]{4}$' or right(p_year,4)::int<>left(p_year,4)::int+1
    or p_reason is null or length(btrim(p_reason)) not between 10 and 10000 or p_response_due_at is null or p_response_due_at<=now()
    then raise exception 'Document the incident and choose a future response deadline.'; end if;
  if p_attendance_id is not null and (p_category<>'attendance' or not exists(select 1 from public.officer_attendance a join public.officer_events e on e.id=a.event_id
    where a.id=p_attendance_id and a.officer_id=p_officer_id and a.status='unexcused' and e.kind='meeting' and e.mandatory and not e.cancelled and e.academic_year=p_year)) then raise exception 'An attendance strike must reference this officer’s unexcused mandatory meeting absence.'; end if;
  if exists(select 1 from public.officer_strikes where attendance_id=p_attendance_id and status in ('notified','confirmed')) then raise exception 'This absence already has an active concern.'; end if;
  insert into public.officer_strikes(officer_id,academic_year,category,incident_date,reason,response_due_at,attendance_id,created_by)
    values(p_officer_id,p_year,p_category,p_incident_date,btrim(p_reason),p_response_due_at,p_attendance_id,auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.respond_officer_strike(p_strike_id uuid,p_response text)
returns void language plpgsql security definer set search_path='' as $$ begin
  if not exists(select 1 from public.officer_profiles where id=auth.uid()) then raise exception 'Officer access is required.'; end if;
  if p_response is null or length(btrim(p_response)) not between 1 and 10000 then raise exception 'Explain the relevant circumstances.'; end if;
  update public.officer_strikes set officer_response=p_response,responded_at=now()
    where id=p_strike_id and officer_id=auth.uid() and status='notified';
  if not found then raise exception 'This concern is no longer awaiting your response.'; end if;
end $$;

create or replace function public.decide_officer_strike(p_strike_id uuid,p_status text,p_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare v_strike public.officer_strikes; v_count integer; v_context jsonb; begin
  if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
  select * into v_strike from public.officer_strikes where id=p_strike_id for update;
  if not found then raise exception 'Concern not available.'; end if;
  -- Serialize confirmations for the same officer, including different concerns.
  perform 1 from public.officer_profiles where id=v_strike.officer_id for update;
  if p_status is null or p_status not in ('confirmed','dismissed','revoked') or p_notes is null or length(btrim(p_notes)) not between 10 and 10000
    or (v_strike.status='notified' and p_status='revoked') or (v_strike.status='confirmed' and p_status<>'revoked') or v_strike.status in ('dismissed','revoked') then raise exception 'Choose a valid decision and document your review of the circumstances.'; end if;
  if p_status='confirmed' and v_strike.responded_at is null and now()<v_strike.response_due_at then raise exception 'Give the officer an opportunity to respond before confirming.'; end if;
  if v_strike.attendance_id is not null then
    perform 1 from public.officer_attendance a join public.officer_events e on e.id=a.event_id where a.id=v_strike.attendance_id for update of a,e;
  end if;
  if p_status='confirmed' and v_strike.attendance_id is not null and not exists(select 1 from public.officer_attendance a join public.officer_events e on e.id=a.event_id
    where a.id=v_strike.attendance_id and a.status='unexcused' and e.mandatory and not e.cancelled) then raise exception 'The linked absence is no longer an unexcused mandatory absence.'; end if;
  update public.officer_strikes set status=p_status,decision_notes=p_notes,decided_by=auth.uid(),decided_at=now() where id=p_strike_id;
  select count(*) into v_count from public.officer_strikes where officer_id=v_strike.officer_id and academic_year=v_strike.academic_year and category=v_strike.category and status='confirmed';
  if p_status='confirmed' and v_count>=3 then
    select jsonb_build_object('confirmed_strikes',(select jsonb_agg(s) from public.officer_strikes s where s.officer_id=v_strike.officer_id and s.academic_year=v_strike.academic_year and s.category=v_strike.category and s.status='confirmed'),
      'peet_score',(select avg((e.efficiency+e.effectiveness+e.time)/3)/4*100 from public.peet_evaluations e join public.tasks t on t.id=e.task_id where t.assigned_to=v_strike.officer_id and t.status='completed')) into v_context;
    insert into public.officer_removal_reviews(officer_id,academic_year,category,context_snapshot)
      values(v_strike.officer_id,v_strike.academic_year,v_strike.category,v_context) on conflict(officer_id,academic_year,category)
      do update set status='pending',context_snapshot=excluded.context_snapshot,advisor_notes='',decided_by=null,decided_at=null;
  end if;
end $$;

create or replace function public.decide_officer_removal_review(p_review_id uuid,p_status text,p_notes text)
returns void language plpgsql security definer set search_path='' as $$ begin
  if not public.is_peet_advisor() then raise exception 'Academy Advisor approval is required.'; end if;
  if p_status is null or p_status not in ('retained','removal_approved') or p_notes is null or length(btrim(p_notes)) not between 10 and 10000 then raise exception 'Document the advisor’s decision and reasoning.'; end if;
  perform 1 from public.officer_removal_reviews where id=p_review_id for update;
  if p_status='removal_approved' and not exists(select 1 from public.officer_removal_reviews r where r.id=p_review_id and
    (select count(*) from public.officer_strikes s where s.officer_id=r.officer_id and s.academic_year=r.academic_year and s.category=r.category and s.status='confirmed')>=3) then
    raise exception 'Removal approval requires three currently confirmed strikes in the review category.';
  end if;
  update public.officer_removal_reviews set status=p_status,advisor_notes=p_notes,decided_by=auth.uid(),decided_at=now() where id=p_review_id and status='pending';
  if not found then raise exception 'Review is no longer pending.'; end if;
end $$;

-- Also enforce Article IV: Presidents cannot evaluate their own performance.
-- This trigger protects both the RPC and direct writes by trusted integrations.
create or replace function public.check_peet_reviewer()
returns trigger language plpgsql security definer set search_path='' as $$ begin
  if exists(select 1 from public.tasks t join public.officer_profiles p on p.id=t.assigned_to
    where t.id=new.task_id and p.reviewer_kind='president') and not exists(select 1 from public.officer_profiles where id=new.evaluated_by and role='admin' and reviewer_kind='advisor') then
    raise exception 'The President’s PEET performance must be evaluated by the Academy Advisor.';
  end if;
  return new;
end $$;
drop trigger if exists peet_reviewer_check on public.peet_evaluations;
create trigger peet_reviewer_check before insert or update on public.peet_evaluations for each row execute function public.check_peet_reviewer();

-- Revoke Supabase default execution grants, including trigger helpers.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('is_peet_advisor','audit_officer_tracking','mark_peet_onboarding_seen','save_officer_accountability_notes','save_officer_event','record_officer_attendance','notify_officer_absence','set_officer_event_signup','submit_officer_volunteer','review_officer_volunteer','create_officer_strike','respond_officer_strike','decide_officer_strike','decide_officer_removal_review','check_peet_reviewer') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    if f.signature::text not like '%audit_officer_tracking(%' and f.signature::text not like '%check_peet_reviewer(%' then execute format('grant execute on function %s to authenticated',f.signature); end if;
  end loop;
end $$;
commit;
