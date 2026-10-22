-- Apply after officer-strike-responses.sql. New incidents receive a full 24 hours.
-- Historical confirmed strikes retain their decisions. Safe to reapply.
begin;
create or replace function public.create_officer_strike(p_officer_id uuid,p_year text,p_category text,p_incident_date date,p_reason text,p_response_due_at timestamptz,p_attendance_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid; begin
  if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
  if not exists(select 1 from public.officer_profiles where id=p_officer_id and reviewer_kind is distinct from 'advisor') then raise exception 'Select a leadership officer, not a faculty advisor.'; end if;
  if p_category is null or p_category not in ('attendance','conduct') or p_incident_date is null or p_incident_date>current_date
    or p_year is null or p_year !~ '^[0-9]{4}-[0-9]{4}$' or right(p_year,4)::int<>left(p_year,4)::int+1
    or p_reason is null or length(btrim(p_reason)) not between 10 and 10000
    then raise exception 'Document the incident and select a valid category and academic year.'; end if;
  if p_attendance_id is not null and (p_category<>'attendance' or not exists(select 1 from public.officer_attendance a join public.officer_events e on e.id=a.event_id
    where a.id=p_attendance_id and a.officer_id=p_officer_id and a.status='unexcused' and not e.cancelled and e.academic_year=p_year)) then raise exception 'An attendance strike must reference this officer’s unexcused absence.'; end if;
  if exists(select 1 from public.officer_strikes where attendance_id=p_attendance_id and status in ('notified','confirmed')) then raise exception 'This absence already has an active concern.'; end if;
  perform 1 from public.officer_profiles where id=p_officer_id for update;
  insert into public.officer_strikes(officer_id,academic_year,category,incident_date,reason,response_due_at,attendance_id,created_by,status,decided_by,decided_at,decision_notes)
    values(p_officer_id,p_year,p_category,p_incident_date,btrim(p_reason),clock_timestamp()+interval '24 hours',p_attendance_id,auth.uid(),'notified',null,null,'') returning id into v_id;
  return v_id;
end $$;

create or replace function public.issue_unexcused_attendance_strike()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_event public.officer_events; begin
 if new.status<>'unexcused' then return new; end if;
 if tg_op='UPDATE' then
  if old.status='unexcused' then return new; end if;
 end if;
 select * into v_event from public.officer_events where id=new.event_id;
 if v_event.cancelled or not exists(select 1 from public.officer_profiles where id=new.officer_id and reviewer_kind is distinct from 'advisor') then return new; end if;
 perform 1 from public.officer_profiles where id=new.officer_id for update;
 insert into public.officer_strikes(officer_id,academic_year,category,incident_date,reason,attendance_id,status,response_due_at,created_by,decided_by,decided_at,decision_notes)
 values(new.officer_id,v_event.academic_year,'attendance',(v_event.starts_at at time zone 'America/Los_Angeles')::date,
  left('Unexcused absence: '||v_event.title,10000),new.id,'notified',clock_timestamp()+interval '24 hours',new.recorded_by,null,null,'')
 on conflict(attendance_id) where attendance_id is not null and status in ('notified','confirmed') do nothing;
 return new;
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
  if p_status='confirmed' and v_strike.responded_at is null and clock_timestamp()<v_strike.response_due_at then
    raise exception 'Allow the officer 24 hours to explain before confirming a strike.';
  end if;
  if v_strike.attendance_id is not null then
    perform 1 from public.officer_attendance a join public.officer_events e on e.id=a.event_id where a.id=v_strike.attendance_id for update of a,e;
  end if;
  if p_status='confirmed' and v_strike.attendance_id is not null and not exists(select 1 from public.officer_attendance a join public.officer_events e on e.id=a.event_id
    where a.id=v_strike.attendance_id and a.status='unexcused' and not e.cancelled) then raise exception 'The linked absence is no longer an unexcused absence.'; end if;
  update public.officer_strikes set status=p_status,decision_notes=p_notes,decided_by=auth.uid(),decided_at=now() where id=p_strike_id;
end $$;

create or replace function public.respond_officer_strike(p_strike_id uuid,p_response text)
returns void language plpgsql security definer set search_path='' as $$
declare incident public.officer_strikes; begin
 if not exists(select 1 from public.officer_profiles where id=auth.uid() and access_enabled) then
  raise exception 'Active officer access is required.';
 end if;
 if p_response is null or length(btrim(p_response)) not between 10 and 10000 then
  raise exception 'Explain your circumstances in 10–10000 characters.';
 end if;
 select * into incident from public.officer_strikes where id=p_strike_id and officer_id=auth.uid() for update;
 if not found or incident.status<>'notified' then raise exception 'This incident is no longer awaiting a response.'; end if;
 if clock_timestamp()>=incident.response_due_at then raise exception 'The 24-hour response window has ended.'; end if;
 update public.officer_strikes set officer_response=btrim(p_response),responded_at=clock_timestamp() where id=incident.id;
end $$;

-- Only unattended requests expire. Row locks serialize the deadline worker with
-- responses and reviewer decisions; timely explanations always await review.
create or replace function public.expire_officer_strike_responses()
returns integer language plpgsql security definer set search_path='' as $$
declare incident public.officer_strikes; total integer:=0; begin
 for incident in select * from public.officer_strikes
  where status='notified' and responded_at is null and response_due_at<=clock_timestamp()
  order by officer_id,id for update skip locked
 loop
  if incident.attendance_id is not null then
   perform 1 from public.officer_attendance a join public.officer_events e on e.id=a.event_id
    where a.id=incident.attendance_id for update of a,e;
  end if;
  if incident.attendance_id is not null and not exists(
    select 1 from public.officer_attendance a join public.officer_events e on e.id=a.event_id
    where a.id=incident.attendance_id and a.status='unexcused' and not e.cancelled) then
   update public.officer_strikes set status='dismissed',decided_at=clock_timestamp(),
    decision_notes='Automatically dismissed because the linked absence was corrected or cancelled.' where id=incident.id;
  else
   update public.officer_strikes set status='confirmed',decided_at=clock_timestamp(),
    decision_notes='Automatically confirmed: no explanation was submitted within 24 hours.' where id=incident.id;
   total:=total+1;
  end if;
 end loop;
 return total;
end $$;
revoke all on function public.expire_officer_strike_responses() from public,anon,authenticated;
grant execute on function public.expire_officer_strike_responses() to service_role;
create index if not exists officer_strikes_response_expiry_idx on public.officer_strikes(response_due_at,officer_id)
 where status='notified' and responded_at is null;
commit;
