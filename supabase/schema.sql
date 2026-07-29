-- =========================================================
-- GEA Website — Supabase schema
-- Run this in the Supabase SQL editor for a fresh project.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- ADMINS: auth users allowed into the hidden admin portal.
-- Add rows manually after creating the corresponding Supabase
-- Auth user (Authentication > Users > Add user).
-- ---------------------------------------------------------
create table if not exists admins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from admins where auth_user_id = auth.uid());
$$;

-- ---------------------------------------------------------
-- UPPERCLASSMEN: students allowed to log in and answer Q&A.
-- Add rows manually (name + school email + their Supabase
-- Auth user id) after creating their Auth account.
-- ---------------------------------------------------------
create table if not exists upperclassmen (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  name text not null,
  school_email text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- LEADERSHIP MEMBERS: filled seats on the leadership board.
-- Only rows that exist here show as "filled" on /leadership.
-- Seed the President row yourself; leave every other role
-- absent from this table until it's filled.
-- ---------------------------------------------------------
create table if not exists leadership_members (
  id uuid primary key default gen_random_uuid(),
  role text not null unique check (role in (
    'president','vice-president','secretary','publicist','treasurer',
    'rep-11','rep-10','rep-9'
  )),
  name text not null,
  bio text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- Example seed for the President seat — edit the name, then run:
-- insert into leadership_members (role, name, bio)
-- values ('president', 'Jaden [Last Name]', 'GEA President, Class of 2027');

-- ---------------------------------------------------------
-- APPLICATIONS: leadership role applications from students.
-- ---------------------------------------------------------
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  name text not null,
  school_email text not null,
  why_apply text not null,
  why_fit text not null,
  proof_of_work text,
  status text not null default 'pending'
    check (status in ('pending','reviewing','invited','interview_booked','approved','rejected')),
  interview_token uuid unique,
  invite_sent_at timestamptz,
  booked_slot_id uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- INTERVIEW SLOTS: lunch-period interview times admins open up.
-- ---------------------------------------------------------
create table if not exists interview_slots (
  id uuid primary key default gen_random_uuid(),
  label text not null,             -- e.g. "Tuesday Lunch — Nov 12"
  slot_time timestamptz not null,
  is_booked boolean not null default false,
  application_id uuid references applications(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_booked_slot_fk'
      and conrelid = 'applications'::regclass
  ) then
    alter table applications
      add constraint applications_booked_slot_fk
      foreign key (booked_slot_id) references interview_slots(id) on delete set null;
  end if;
end
$$;

-- ---------------------------------------------------------
-- Q&A: public questions + upperclassman answers, both gated
-- behind admin approval before they're shown publicly.
-- ---------------------------------------------------------
create table if not exists qa_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  asked_by_name text not null default 'Anonymous Student',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists qa_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references qa_questions(id) on delete cascade,
  answer text not null,
  answered_by_name text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table leadership_members enable row level security;
alter table applications enable row level security;
alter table interview_slots enable row level security;
alter table qa_questions enable row level security;
alter table qa_answers enable row level security;
alter table upperclassmen enable row level security;
alter table admins enable row level security;

-- Leadership: anyone can view the board; only admins can edit.
create policy "leadership_public_read" on leadership_members
  for select using (true);
create policy "leadership_admin_write" on leadership_members
  for all using (is_admin()) with check (is_admin());

-- Applications: anyone can submit one; only admins can read/update.
-- (Public read is intentionally NOT allowed — applicant status and
-- interview details are only ever delivered through the token-based
-- RPC functions below, never a direct table read.)
create policy "applications_public_insert" on applications
  for insert with check (true);
create policy "applications_admin_manage" on applications
  for select using (is_admin());
create policy "applications_admin_update" on applications
  for update using (is_admin()) with check (is_admin());

-- Interview slots: anyone can see open times; only admins manage them.
create policy "slots_public_read" on interview_slots
  for select using (true);
create policy "slots_admin_write" on interview_slots
  for all using (is_admin()) with check (is_admin());

-- Q&A questions: anyone can ask; anyone can read approved ones;
-- only admins can read pending ones or change status.
create policy "questions_public_insert" on qa_questions
  for insert with check (true);
create policy "questions_read_approved_or_admin" on qa_questions
  for select using (status = 'approved' or is_admin());
create policy "questions_admin_update" on qa_questions
  for update using (is_admin()) with check (is_admin());

-- Q&A answers: only signed-in upperclassmen can submit answers;
-- anyone can read approved ones; only admins moderate.
create policy "answers_upperclassman_insert" on qa_answers
  for insert with check (
    exists (select 1 from upperclassmen u where u.auth_user_id = auth.uid())
  );
create policy "answers_read_approved_or_admin" on qa_answers
  for select using (status = 'approved' or is_admin());
create policy "answers_admin_update" on qa_answers
  for update using (is_admin()) with check (is_admin());

-- Upperclassmen: a user can check their own row; admins manage all.
create policy "upperclassmen_self_read" on upperclassmen
  for select using (auth_user_id = auth.uid() or is_admin());
create policy "upperclassmen_admin_write" on upperclassmen
  for all using (is_admin()) with check (is_admin());

-- Admins table: only admins can read/manage the admin list.
create policy "admins_admin_read" on admins
  for select using (is_admin());

-- =========================================================
-- RPC FUNCTIONS — the ONLY way the public interview page
-- touches application data, so a stolen table read can never
-- expose every applicant's info.
-- =========================================================

-- Look up minimal, non-sensitive info for the token-based booking page.
create or replace function get_application_by_token(p_token uuid)
returns table (
  role text,
  status text,
  booked_slot_id uuid
)
language sql
security definer
set search_path = public
as $$
  select role, status, booked_slot_id
  from applications
  where interview_token = p_token;
$$;

-- Book an open interview slot for a given token. Returns the label
-- of the slot booked, or raises an exception if it's unavailable.
create or replace function book_interview_slot(p_token uuid, p_slot_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_id uuid;
  v_label text;
begin
  select id into v_app_id from applications where interview_token = p_token;
  if v_app_id is null then
    raise exception 'Invalid interview link.';
  end if;

  update interview_slots
     set is_booked = true, application_id = v_app_id
   where id = p_slot_id and is_booked = false
   returning label into v_label;

  if v_label is null then
    raise exception 'That slot was just booked by someone else — please pick another.';
  end if;

  update applications
     set booked_slot_id = p_slot_id, status = 'interview_booked'
   where id = v_app_id;

  return v_label;
end;
$$;

grant execute on function get_application_by_token(uuid) to anon, authenticated;
grant execute on function book_interview_slot(uuid, uuid) to anon, authenticated;
