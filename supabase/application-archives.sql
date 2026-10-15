-- Run after schema.sql to enable the admin year-end archive workflow.
create table if not exists public.application_archives (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  application_count integer not null,
  applications jsonb not null,
  interview_slots jsonb not null,
  cleared_at timestamptz
);
alter table public.application_archives enable row level security;
drop policy if exists application_archives_staff_read on public.application_archives;
create policy application_archives_staff_read on public.application_archives for select to authenticated using (public.is_staff());
grant select on public.application_archives to authenticated;

-- Capture every row server-side, without the API pagination limit. No deletion here.
create or replace function public.prepare_application_archive() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_apps jsonb; v_slots jsonb; v_archive public.application_archives;
begin
  if not public.is_staff() then raise exception 'Staff access required.'; end if;
  lock table public.applications in share mode;
  lock table public.interview_slots in share mode;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at, a.id), '[]'::jsonb) into v_apps from public.applications a;
  if jsonb_array_length(v_apps) = 0 then raise exception 'No applications to archive.'; end if;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb) into v_slots
    from public.interview_slots s where s.application_id in (select (a->>'id')::uuid from jsonb_array_elements(v_apps) a)
    or s.id in (select (a->>'booked_slot_id')::uuid from jsonb_array_elements(v_apps) a);
  insert into public.application_archives(created_by, application_count, applications, interview_slots)
    values (auth.uid(), jsonb_array_length(v_apps), v_apps, v_slots) returning * into v_archive;
  return to_jsonb(v_archive);
end;
$$;

-- Clear exactly the exported snapshot. Reject changed records and keep newer applications.
create or replace function public.clear_archived_applications(p_archive_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare v_archive public.application_archives; v_count integer;
begin
  if not public.is_staff() then raise exception 'Staff access required.'; end if;
  select * into v_archive from public.application_archives where id = p_archive_id for update;
  if not found then raise exception 'Archive not found.'; end if;
  if v_archive.cleared_at is not null then return 0; end if;
  if v_archive.created_by is distinct from auth.uid() then raise exception 'Only the creator can clear this archive.'; end if;
  lock table public.applications in share row exclusive mode;
  lock table public.interview_slots in share row exclusive mode;
  if exists (
    select 1 from jsonb_array_elements(v_archive.applications) snapshot
    left join public.applications a on a.id = (snapshot->>'id')::uuid
    where a.id is null or to_jsonb(a) is distinct from snapshot
  ) or exists (
    select 1 from jsonb_array_elements(v_archive.interview_slots) snapshot
    left join public.interview_slots s on s.id = (snapshot->>'id')::uuid
    where s.id is null or to_jsonb(s) is distinct from snapshot
  ) then raise exception 'Applications or interviews changed after export. Create a fresh archive before clearing.'; end if;
  update public.interview_slots set is_booked = false, application_id = null
    where application_id in (select (a->>'id')::uuid from jsonb_array_elements(v_archive.applications) a);
  delete from public.applications where id in (select (a->>'id')::uuid from jsonb_array_elements(v_archive.applications) a);
  get diagnostics v_count = row_count;
  update public.application_archives set cleared_at = now() where id = p_archive_id;
  return v_count;
end;
$$;
revoke all on function public.prepare_application_archive() from public, anon;
revoke all on function public.clear_archived_applications(uuid) from public, anon;
grant execute on function public.prepare_application_archive(), public.clear_archived_applications(uuid) to authenticated;
