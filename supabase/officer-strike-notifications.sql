-- Apply after the existing officer migrations. Safe to reapply.
begin;

-- PEET scale v2: average raw 1–4 ratings first, then convert without rounding.
create or replace function public.peet_percentage(p_average numeric)
returns numeric language sql immutable strict parallel safe set search_path='' as $$
 select case when p_average <= 3 then 85 + 20 * (p_average - 3)
             else 85 + 15 * (p_average - 3) end;
$$;
revoke all on function public.peet_percentage(numeric) from public,anon,authenticated;
grant execute on function public.peet_percentage(numeric) to authenticated,service_role;


-- Keep the legacy RPC signature for compatibility; response deadlines are ignored.
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
    values(p_officer_id,p_year,p_category,p_incident_date,btrim(p_reason),now()+interval '1 second',p_attendance_id,auth.uid(),'confirmed',auth.uid(),now(),'Strike issued and officer notified.') returning id into v_id;
  return v_id;
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
  if v_strike.attendance_id is not null then
    perform 1 from public.officer_attendance a join public.officer_events e on e.id=a.event_id where a.id=v_strike.attendance_id for update of a,e;
  end if;
  if p_status='confirmed' and v_strike.attendance_id is not null and not exists(select 1 from public.officer_attendance a join public.officer_events e on e.id=a.event_id
    where a.id=v_strike.attendance_id and a.status='unexcused' and not e.cancelled) then raise exception 'The linked absence is no longer an unexcused absence.'; end if;
  update public.officer_strikes set status=p_status,decision_notes=p_notes,decided_by=auth.uid(),decided_at=now() where id=p_strike_id;
end $$;

create or replace function public.respond_officer_strike(p_strike_id uuid,p_response text)
returns void language plpgsql security definer set search_path='' as $$ begin
 raise exception 'Strikes are notifications only. Officer responses are not accepted.';
end $$;
revoke all on function public.respond_officer_strike(uuid,text) from public,anon,authenticated;

-- Preserve the three-strike advisor review for both automatic and manual strikes.
create or replace function public.open_officer_strike_review()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_count integer; v_context jsonb; begin
 if new.status<>'confirmed' then return new; end if;
 if tg_op='UPDATE' then
  if old.status='confirmed' then return new; end if;
 end if;
 perform 1 from public.officer_profiles where id=new.officer_id for update;
  select count(*) into v_count from public.officer_strikes where officer_id=new.officer_id and academic_year=new.academic_year and category=new.category and status='confirmed';
  if v_count>=3 then
    select jsonb_build_object('confirmed_strikes',(select jsonb_agg(s) from public.officer_strikes s where s.officer_id=new.officer_id and s.academic_year=new.academic_year and s.category=new.category and s.status='confirmed'),
      'peet_score',(select public.peet_percentage(avg((e.efficiency+e.effectiveness+e.time)/3)) from public.peet_evaluations e join public.tasks t on t.id=e.task_id where (e.officer_id=new.officer_id or (e.officer_id is null and (t.assigned_to=new.officer_id or exists(select 1 from public.officer_task_members m where m.task_id=t.id and m.officer_id=new.officer_id)))) and (e.officer_id is not null or t.status='completed') and t.cancelled_at is null)) into v_context;
    insert into public.officer_removal_reviews(officer_id,academic_year,category,context_snapshot)
      values(new.officer_id,new.academic_year,new.category,v_context) on conflict(officer_id,academic_year,category)
      do update set status='pending',context_snapshot=excluded.context_snapshot,advisor_notes='',decided_by=null,decided_at=null;
  end if;

 return new;
end $$;
drop trigger if exists officer_strike_review on public.officer_strikes;
create trigger officer_strike_review after insert or update of status on public.officer_strikes
 for each row execute function public.open_officer_strike_review();

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
  left('Unexcused absence: '||v_event.title,10000),new.id,'confirmed',now()+interval '1 second',new.recorded_by,new.recorded_by,now(),'Automatically issued for unexcused attendance.')
 on conflict(attendance_id) where attendance_id is not null and status in ('notified','confirmed') do nothing;
 return new;
end $$;
drop trigger if exists unexcused_attendance_strike on public.officer_attendance;
create trigger unexcused_attendance_strike after insert or update of status on public.officer_attendance
 for each row execute function public.issue_unexcused_attendance_strike();
revoke all on function public.open_officer_strike_review(),public.issue_unexcused_attendance_strike() from public,anon,authenticated;

-- Existing notifications become effective immediately; historical responses stay in the audit history.
update public.officer_strikes set status='confirmed',decided_by=created_by,decided_at=now(),
 decision_notes='Strike issued and officer notified.' where status='notified';

-- Include existing unexcused attendance, without duplicating active or corrected strikes.
insert into public.officer_strikes(officer_id,academic_year,category,incident_date,reason,attendance_id,status,response_due_at,created_by,decided_by,decided_at,decision_notes)
 select a.officer_id,e.academic_year,'attendance',(e.starts_at at time zone 'America/Los_Angeles')::date,
 left('Unexcused absence: '||e.title,10000),a.id,'confirmed',now()+interval '1 second',a.recorded_by,a.recorded_by,now(),'Automatically issued for unexcused attendance.'
 from public.officer_attendance a join public.officer_events e on e.id=a.event_id
 join public.officer_profiles p on p.id=a.officer_id
 where a.status='unexcused' and not e.cancelled and p.reviewer_kind is distinct from 'advisor'
 and a.recorded_by is not null and not exists(select 1 from public.officer_strikes s where s.attendance_id=a.id)
 on conflict(attendance_id) where attendance_id is not null and status in ('notified','confirmed') do nothing;
commit;
