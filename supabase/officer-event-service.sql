-- Run after officer-accountability.sql. Adds service-event attendance and bulk verification.
begin;
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


-- Verify the reviewed snapshot atomically: edits by another reviewer require a refresh.
create or replace function public.verify_officer_event_service(p_event_id uuid, p_logs jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_snapshot jsonb; v_log public.officer_volunteer_logs;
begin
  if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
  perform 1 from public.officer_events where id=p_event_id and kind in ('volunteer','outreach') and not cancelled for update;
  if not found then raise exception 'Select an active service event.'; end if;
  if p_logs is null or jsonb_typeof(p_logs)<>'array' then raise exception 'Select pending service logs.'; end if;
  if jsonb_array_length(p_logs)=0 or jsonb_array_length(p_logs)>1000 then raise exception 'Select between 1 and 1000 pending service logs.'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_logs))<>jsonb_array_length(p_logs) then raise exception 'Select each log only once.'; end if;
  for v_snapshot in select value from jsonb_array_elements(p_logs) order by value->>'id' loop
    select * into v_log from public.officer_volunteer_logs where id=(v_snapshot->>'id')::uuid and event_id=p_event_id for update;
    if not found then raise exception 'A service log is unavailable. Refresh the roster.'; end if;
    if v_log.status<>'pending' or v_snapshot->>'status' is distinct from 'pending'
      or v_log.officer_id is distinct from (v_snapshot->>'officer_id')::uuid
      or v_log.check_in is distinct from (v_snapshot->>'check_in')::timestamptz
      or v_log.check_out is distinct from (v_snapshot->>'check_out')::timestamptz
      or v_log.notes is distinct from (v_snapshot->>'notes')
      or v_log.review_notes is distinct from (v_snapshot->>'review_notes')
      or v_log.reviewed_at is distinct from (v_snapshot->>'reviewed_at')::timestamptz then
      raise exception 'Service details changed. Refresh and review the logs before verifying.';
    end if;
    update public.officer_volunteer_logs set status='approved', reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now() where id=v_log.id;
  end loop;
end $$;
revoke all on function public.verify_officer_event_service(uuid,jsonb) from public, anon;
grant execute on function public.verify_officer_event_service(uuid,jsonb) to authenticated;
commit;
