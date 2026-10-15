-- Standalone regression test. Run ONLY in an empty disposable PostgreSQL database.
\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.admins(auth_user_id uuid primary key);
create function public.is_staff() returns boolean language sql stable security definer as $$ select exists(select 1 from public.admins where auth_user_id=auth.uid()) $$;
create table public.applications(id uuid primary key default gen_random_uuid(), name text, created_at timestamptz default now(), booked_slot_id uuid);
create table public.interview_slots(id uuid primary key default gen_random_uuid(), application_id uuid references public.applications(id) on delete set null, is_booked boolean default false, label text);
alter table public.applications add foreign key(booked_slot_id) references public.interview_slots(id) on delete set null;
\ir ../supabase/application-archives.sql
\ir ../supabase/application-archives.sql
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
insert into public.admins values ('11111111-1111-1111-1111-111111111111');
insert into public.applications(name) select 'Applicant ' || n from generate_series(1,1005) n;
insert into public.interview_slots(application_id,is_booked,label) select id,true,'Lunch' from public.applications limit 1;
update public.applications a set booked_slot_id=s.id from public.interview_slots s where s.application_id=a.id;
do $$
declare snapshot jsonb; archive_id uuid; changed_id uuid; later_id uuid; n integer;
begin
  perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
  begin
    perform public.prepare_application_archive();
    raise exception 'Unauthorized archive allowed';
  exception when others then if sqlerrm <> 'Staff access required.' then raise; end if; end;
  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
  snapshot := public.prepare_application_archive(); archive_id := (snapshot->>'id')::uuid;
  if (snapshot->>'application_count')::int <> 1005 or (select count(*) from applications) <> 1005 then raise exception 'Snapshot truncated or deleted data'; end if;
  select id into changed_id from applications limit 1;
  update applications set name='Changed after export' where id=changed_id;
  begin
    perform public.clear_archived_applications(archive_id);
    raise exception 'Changed applications deleted';
  exception when others then if sqlerrm not like 'Applications or interviews changed%' then raise; end if; end;
  if (select count(*) from applications) <> 1005 then raise exception 'Failed transaction deleted rows'; end if;
  snapshot := public.prepare_application_archive(); archive_id := (snapshot->>'id')::uuid;
  insert into applications(name) values('Next year applicant') returning id into later_id;
  perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
  begin
    perform public.clear_archived_applications(archive_id);
    raise exception 'Unauthorized deletion allowed';
  exception when others then if sqlerrm <> 'Staff access required.' then raise; end if; end;
  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
  n := public.clear_archived_applications(archive_id);
  if n <> 1005 or (select count(*) from applications) <> 1 or not exists(select 1 from applications where id=later_id) then raise exception 'Cleared wrong applications'; end if;
  if exists(select 1 from interview_slots where is_booked or application_id is not null) then raise exception 'Interview slots not released'; end if;
  if not exists(select 1 from application_archives where id=archive_id and cleared_at is not null and jsonb_array_length(applications)=1005) then raise exception 'Archive missing after deletion'; end if;
  if public.clear_archived_applications(archive_id) <> 0 then raise exception 'Repeat clear is not idempotent'; end if;
  raise notice 'PASS: full snapshot, access checks, concurrent edits, newer records, slot release, retained archive, idempotence';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$ begin if exists(select 1 from public.application_archives) then raise exception 'Archive exposed to student'; end if; end $$;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$ begin if (select count(*) from public.application_archives) <> 2 then raise exception 'Staff cannot read archives'; end if; end $$;
