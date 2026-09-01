-- Run this once in Supabase after the existing leadership schema.
alter table leadership_members add column if not exists display_order integer not null default 0;

update leadership_members
set display_order = case role
  when 'president' then 0
  when 'vice-president' then 1
  when 'secretary' then 2
  when 'publicist' then 3
  when 'treasurer' then 4
  when 'rep-10' then 5
  when 'rep-9' then 6
  else display_order
end
where display_order = 0;

create table if not exists leadership_history (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  name text not null,
  contact_email text,
  bio text,
  photo_url text,
  school_year text not null,
  display_order integer not null default 0,
  retired_at timestamptz not null default now()
);

alter table leadership_history add column if not exists display_order integer not null default 0;

create index if not exists leadership_history_school_year_idx
  on leadership_history (school_year desc);

alter table leadership_history enable row level security;

drop policy if exists "leadership_history_public_read" on leadership_history;
create policy "leadership_history_public_read" on leadership_history
  for select using (true);

drop policy if exists "leadership_history_staff_write" on leadership_history;
create policy "leadership_history_staff_write" on leadership_history
  for all using (is_staff()) with check (is_staff());
