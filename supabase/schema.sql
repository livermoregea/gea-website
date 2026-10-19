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

create or replace function is_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    exists (select 1 from admins where auth_user_id = auth.uid())
    or exists (select 1 from teacher_profiles where auth_user_id = auth.uid());
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
-- STUDENT PROFILES: the unified student account record.
-- Students sign up once, then their account data is reused for
-- dashboard access, Q&A, and leadership applications.
-- ---------------------------------------------------------
create table if not exists student_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  auth_email text not null unique,
  full_name text not null,
  display_username text not null unique,
  graduating_class_year integer not null,
  student_id_number text not null unique,
  school_email text,
  can_answer_qa boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_profiles_auth_user_id_idx on student_profiles(auth_user_id);
create index if not exists student_profiles_display_username_idx on student_profiles(display_username);
create index if not exists student_profiles_full_name_idx on student_profiles(full_name);

-- ---------------------------------------------------------
-- STUDENT ACCOUNT REQUESTS: legacy signup records kept for
-- historical compatibility with the old approval flow.
-- ---------------------------------------------------------
create table if not exists student_account_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  display_username text not null unique,
  school_email text not null unique,
  graduating_class_year integer not null,
  student_id_number text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by_auth_user_id uuid references auth.users(id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists student_account_requests_status_idx on student_account_requests(status);
create index if not exists student_account_requests_school_email_idx on student_account_requests(school_email);

-- ---------------------------------------------------------
-- STUDENT EMAIL BLOCKS: admin-managed blacklist for student
-- emails that should not be allowed to create new accounts.
-- ---------------------------------------------------------
create table if not exists student_email_blocks (
  school_email text primary key,
  reason text not null check (reason in ('not_in_gea','inappropriate_behavior','other')),
  note text,
  is_active boolean not null default true,
  blocked_by_auth_user_id uuid references auth.users(id) on delete set null,
  blocked_at timestamptz not null default now(),
  unblocked_by_auth_user_id uuid references auth.users(id) on delete set null,
  unblocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table student_email_blocks add column if not exists reason text not null default 'not_in_gea';
alter table student_email_blocks add column if not exists note text;
alter table student_email_blocks add column if not exists is_active boolean not null default true;
alter table student_email_blocks add column if not exists blocked_by_auth_user_id uuid references auth.users(id) on delete set null;
alter table student_email_blocks add column if not exists blocked_at timestamptz not null default now();
alter table student_email_blocks add column if not exists unblocked_by_auth_user_id uuid references auth.users(id) on delete set null;
alter table student_email_blocks add column if not exists unblocked_at timestamptz;
alter table student_email_blocks add column if not exists created_at timestamptz not null default now();
alter table student_email_blocks add column if not exists updated_at timestamptz not null default now();

create index if not exists student_email_blocks_is_active_idx on student_email_blocks(is_active);

-- ---------------------------------------------------------
-- TEACHER PROFILES: private teacher accounts created with a
-- sign-up code, so staff can access the teacher portal.
-- ---------------------------------------------------------
create table if not exists teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  auth_email text not null unique,
  full_name text not null,
  school_email text not null unique,
  created_at timestamptz not null default now()
);

alter table teacher_profiles add column if not exists auth_email text;
alter table teacher_profiles add column if not exists full_name text;
alter table teacher_profiles add column if not exists school_email text;

create index if not exists teacher_profiles_auth_user_id_idx on teacher_profiles(auth_user_id);
create index if not exists teacher_profiles_school_email_idx on teacher_profiles(school_email);

-- ---------------------------------------------------------
-- TEACHER INVITES: one-time links generated by admins for a
-- specific teacher name/email. The invite is consumed once the
-- teacher creates their account.
-- ---------------------------------------------------------
create table if not exists teacher_invites (
  id uuid primary key default gen_random_uuid(),
  invite_token text not null unique,
  teacher_name text not null,
  teacher_email text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_auth_user_id uuid references auth.users(id) on delete set null,
  created_by_auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table teacher_invites add column if not exists invite_token text;
alter table teacher_invites add column if not exists teacher_name text;
alter table teacher_invites add column if not exists teacher_email text;
alter table teacher_invites add column if not exists expires_at timestamptz;
alter table teacher_invites add column if not exists used_at timestamptz;
alter table teacher_invites add column if not exists used_auth_user_id uuid references auth.users(id) on delete set null;
alter table teacher_invites add column if not exists created_by_auth_user_id uuid references auth.users(id) on delete set null;

create index if not exists teacher_invites_token_idx on teacher_invites(invite_token);
create index if not exists teacher_invites_teacher_email_idx on teacher_invites(teacher_email);
create index if not exists teacher_invites_used_at_idx on teacher_invites(used_at);

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
    'rep-10','rep-9'
  )),
  name text not null,
  contact_email text,
  bio text,
  photo_url text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table leadership_members add column if not exists contact_email text;
alter table leadership_members add column if not exists display_order integer not null default 0;

-- Archived leadership members, grouped by school year after retirement.
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

-- ---------------------------------------------------------
-- STORAGE: leadership photos uploaded directly from the admin
-- portal and rendered publicly on /leadership.
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('leadership-photos', 'leadership-photos', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'leadership_photos_public_read'
  ) then
    create policy leadership_photos_public_read
      on storage.objects
      for select
      using (bucket_id = 'leadership-photos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'leadership_photos_staff_write'
  ) then
    create policy leadership_photos_staff_write
      on storage.objects
      for all
      using (bucket_id = 'leadership-photos' and is_staff())
      with check (bucket_id = 'leadership-photos' and is_staff());
  end if;
end
$$;

-- Example seed for the President seat — edit the name, then run:
-- insert into leadership_members (role, name, bio)
-- values ('president', 'Jaden [Last Name]', 'GEA President, Class of 2027');

-- ---------------------------------------------------------
-- APPLICATIONS: leadership role applications from students.
-- ---------------------------------------------------------
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  student_profile_id uuid references student_profiles(id) on delete set null,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  display_username text,
  graduating_class_year integer,
  student_id_number text,
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

alter table applications add column if not exists student_profile_id uuid references student_profiles(id) on delete set null;
alter table applications add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
alter table applications add column if not exists display_username text;
alter table applications add column if not exists graduating_class_year integer;
alter table applications add column if not exists student_id_number text;

-- ---------------------------------------------------------
-- PROFILE CHANGE REQUESTS: user-submitted profile edits that
-- must be reviewed by admins before being applied.
-- ---------------------------------------------------------
create table if not exists profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  profile_type text not null check (profile_type in ('student', 'teacher')),
  profile_id uuid not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  requested_by_name text not null,
  current_fields jsonb not null,
  requested_fields jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz not null default now()
);

alter table profile_change_requests add column if not exists profile_type text not null default 'student';
alter table profile_change_requests add column if not exists profile_id uuid;
alter table profile_change_requests add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
alter table profile_change_requests add column if not exists requested_by_name text;
alter table profile_change_requests add column if not exists current_fields jsonb;
alter table profile_change_requests add column if not exists requested_fields jsonb;
alter table profile_change_requests add column if not exists rejection_reason text;

-- ---------------------------------------------------------
-- WEBSITE ANNOUNCEMENTS: admin-managed popup and banner
-- content that can be shown site-wide or just on the home page.
-- ---------------------------------------------------------
create table if not exists website_announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null unique check (kind in ('popup', 'banner')),
  is_enabled boolean not null default false,
  scope text not null default 'site' check (scope in ('site', 'home')),
  title text not null default '',
  body text not null default '',
  buttons jsonb not null default '[]'::jsonb,
  allow_dont_show_again boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table website_announcements add column if not exists kind text not null default 'popup';
alter table website_announcements add column if not exists is_enabled boolean not null default false;
alter table website_announcements add column if not exists scope text not null default 'site';
alter table website_announcements add column if not exists title text not null default '';
alter table website_announcements add column if not exists body text not null default '';
alter table website_announcements add column if not exists buttons jsonb not null default '[]'::jsonb;
alter table website_announcements add column if not exists allow_dont_show_again boolean not null default true;
alter table website_announcements add column if not exists updated_at timestamptz not null default now();

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
  question_type text not null default 'general' check (question_type in ('general', 'math', 'word_problem')),
  forum_board text not null default 'general' check (forum_board in ('general', 'academics', 'projects', 'events', 'advice', 'life')),
  equation_lines text,
  work_text text,
  graph_notes text,
  graph_link text,
  asked_by_name text not null default 'Anonymous Student',
  asked_by_auth_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  upvote_count integer not null default 0,
  downvote_count integer not null default 0,
  report_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table qa_questions add column if not exists asked_by_auth_user_id uuid references auth.users(id) on delete set null;
alter table qa_questions add column if not exists question_type text not null default 'general';
alter table qa_questions add column if not exists forum_board text not null default 'general';
alter table qa_questions add column if not exists equation_lines text;
alter table qa_questions add column if not exists work_text text;
alter table qa_questions add column if not exists graph_notes text;
alter table qa_questions add column if not exists graph_link text;
alter table qa_questions add column if not exists rejection_reason text;
alter table qa_questions add column if not exists upvote_count integer not null default 0;
alter table qa_questions add column if not exists downvote_count integer not null default 0;
alter table qa_questions add column if not exists report_count integer not null default 0;

create index if not exists qa_questions_forum_board_idx on qa_questions(forum_board);

create table if not exists qa_question_votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references qa_questions(id) on delete cascade,
  voter_auth_user_id uuid not null references auth.users(id) on delete cascade,
  value integer not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (question_id, voter_auth_user_id)
);

alter table qa_question_votes add column if not exists question_id uuid not null references qa_questions(id) on delete cascade;
alter table qa_question_votes add column if not exists voter_auth_user_id uuid not null references auth.users(id) on delete cascade;
alter table qa_question_votes add column if not exists value integer not null check (value in (-1, 1));

create table if not exists qa_question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references qa_questions(id) on delete cascade,
  reporter_auth_user_id uuid references auth.users(id) on delete cascade,
  reporter_key text not null default '',
  reason text not null default 'Community report',
  created_at timestamptz not null default now(),
  unique (question_id, reporter_key)
);

alter table qa_question_reports add column if not exists question_id uuid not null references qa_questions(id) on delete cascade;
alter table qa_question_reports add column if not exists reporter_auth_user_id uuid references auth.users(id) on delete cascade;
alter table qa_question_reports add column if not exists reporter_key text not null default '';
alter table qa_question_reports add column if not exists reason text not null default 'Community report';

create table if not exists qa_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references qa_questions(id) on delete cascade,
  answer text not null,
  answered_by_name text not null,
  answered_by_auth_user_id uuid references auth.users(id) on delete set null,
  parent_answer_id uuid references qa_answers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  upvote_count integer not null default 0,
  downvote_count integer not null default 0,
  report_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table qa_answers add column if not exists answered_by_auth_user_id uuid references auth.users(id) on delete set null;
alter table qa_answers add column if not exists parent_answer_id uuid references qa_answers(id) on delete cascade;
alter table qa_answers add column if not exists rejection_reason text;
alter table qa_answers add column if not exists upvote_count integer not null default 0;
alter table qa_answers add column if not exists downvote_count integer not null default 0;
alter table qa_answers add column if not exists report_count integer not null default 0;

create table if not exists qa_answer_votes (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references qa_answers(id) on delete cascade,
  voter_auth_user_id uuid not null references auth.users(id) on delete cascade,
  value integer not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (answer_id, voter_auth_user_id)
);

alter table qa_answer_votes add column if not exists answer_id uuid not null references qa_answers(id) on delete cascade;
alter table qa_answer_votes add column if not exists voter_auth_user_id uuid not null references auth.users(id) on delete cascade;
alter table qa_answer_votes add column if not exists value integer not null check (value in (-1, 1));

create table if not exists qa_answer_reports (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references qa_answers(id) on delete cascade,
  reporter_auth_user_id uuid references auth.users(id) on delete cascade,
  reporter_key text not null default '',
  reason text not null default 'Community report',
  created_at timestamptz not null default now(),
  unique (answer_id, reporter_key)
);

alter table qa_answer_reports add column if not exists answer_id uuid not null references qa_answers(id) on delete cascade;
alter table qa_answer_reports alter column reporter_auth_user_id drop not null;
alter table qa_answer_reports add column if not exists reporter_key text not null default '';
alter table qa_answer_reports add column if not exists reason text not null default 'Community report';

update qa_question_reports
set reporter_key = coalesce(nullif(reporter_key, ''), reporter_auth_user_id::text, gen_random_uuid()::text)
where reporter_key = '' or reporter_key is null;

update qa_answer_reports
set reporter_key = coalesce(nullif(reporter_key, ''), reporter_auth_user_id::text, gen_random_uuid()::text)
where reporter_key = '' or reporter_key is null;

create unique index if not exists qa_question_reports_target_reporter_idx
  on qa_question_reports(question_id, reporter_key);
create unique index if not exists qa_answer_reports_target_reporter_idx
  on qa_answer_reports(answer_id, reporter_key);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table leadership_members enable row level security;
alter table leadership_history enable row level security;
alter table applications enable row level security;
alter table interview_slots enable row level security;
alter table qa_questions enable row level security;
alter table qa_question_votes enable row level security;
alter table qa_question_reports enable row level security;
alter table qa_answers enable row level security;
alter table qa_answer_votes enable row level security;
alter table qa_answer_reports enable row level security;
alter table upperclassmen enable row level security;
alter table student_profiles enable row level security;
alter table student_account_requests enable row level security;
alter table student_email_blocks enable row level security;
alter table teacher_profiles enable row level security;
alter table teacher_invites enable row level security;
alter table admins enable row level security;
alter table profile_change_requests enable row level security;
alter table website_announcements enable row level security;

-- Leadership: anyone can view the board; only admins can edit.
drop policy if exists "leadership_public_read" on leadership_members;
create policy "leadership_public_read" on leadership_members
  for select using (true);
drop policy if exists "leadership_admin_write" on leadership_members;
create policy "leadership_admin_write" on leadership_members
  for all using (is_staff()) with check (is_staff());

drop policy if exists "leadership_history_public_read" on leadership_history;
create policy "leadership_history_public_read" on leadership_history
  for select using (true);
drop policy if exists "leadership_history_staff_write" on leadership_history;
create policy "leadership_history_staff_write" on leadership_history
  for all using (is_staff()) with check (is_staff());

-- Applications: anyone can submit one; only admins can read/update.
-- (Public read is intentionally NOT allowed — applicant status and
-- interview details are only ever delivered through the token-based
-- RPC functions below, never a direct table read.)
drop policy if exists "applications_public_insert" on applications;
create policy "applications_public_insert" on applications
  for insert with check (
    now() < timestamptz '2026-09-05 07:00:00+00'
    and
    case
      when role in ('vice-president', 'secretary', 'treasurer') then graduating_class_year <= extract(year from now())::int + 2
      when role = 'publicist' then true
      when role = 'rep-10' then graduating_class_year = extract(year from now())::int + 3
      when role = 'rep-9' then graduating_class_year = extract(year from now())::int + 4
      else false
    end
  );
drop policy if exists "applications_admin_manage" on applications;
create policy "applications_admin_manage" on applications
  for select using (is_staff());
drop policy if exists "applications_self_read" on applications;
create policy "applications_self_read" on applications
  for select using (auth_user_id = auth.uid());
drop policy if exists "applications_admin_update" on applications;
create policy "applications_admin_update" on applications
  for update using (is_staff()) with check (is_staff());

drop policy if exists "student_profiles_self_read" on student_profiles;
create policy "student_profiles_self_read" on student_profiles
  for select using (auth_user_id = auth.uid() or is_staff());
drop policy if exists "student_profiles_self_update" on student_profiles;
create policy "student_profiles_self_update" on student_profiles
  for update using (auth_user_id = auth.uid() or is_staff()) with check (auth_user_id = auth.uid() or is_staff());
drop policy if exists "student_profiles_admin_write" on student_profiles;
create policy "student_profiles_admin_write" on student_profiles
  for all using (is_staff()) with check (is_staff());

drop policy if exists "student_account_requests_staff_read" on student_account_requests;
create policy "student_account_requests_staff_read" on student_account_requests
  for select using (is_staff());
drop policy if exists "student_account_requests_self_read" on student_account_requests;
create policy "student_account_requests_self_read" on student_account_requests
  for select using (lower(school_email) = lower(coalesce((auth.jwt() ->> 'email'), '')));
drop policy if exists "student_account_requests_staff_update" on student_account_requests;
create policy "student_account_requests_staff_update" on student_account_requests
  for update using (is_staff()) with check (is_staff());

drop policy if exists "student_email_blocks_staff_read" on student_email_blocks;
create policy "student_email_blocks_staff_read" on student_email_blocks
  for select using (is_staff());
drop policy if exists "student_email_blocks_staff_write" on student_email_blocks;
create policy "student_email_blocks_staff_write" on student_email_blocks
  for all using (is_staff()) with check (is_staff());

drop policy if exists "teacher_profiles_self_read" on teacher_profiles;
create policy "teacher_profiles_self_read" on teacher_profiles
  for select using (auth_user_id = auth.uid() or is_staff());
drop policy if exists "teacher_profiles_self_update" on teacher_profiles;
create policy "teacher_profiles_self_update" on teacher_profiles
  for update using (auth_user_id = auth.uid() or is_staff()) with check (auth_user_id = auth.uid() or is_staff());
drop policy if exists "teacher_profiles_admin_write" on teacher_profiles;
create policy "teacher_profiles_admin_write" on teacher_profiles
  for all using (is_staff()) with check (is_staff());

drop policy if exists "teacher_invites_admin_manage" on teacher_invites;
create policy "teacher_invites_admin_manage" on teacher_invites
  for all using (is_staff()) with check (is_staff());

drop policy if exists "profile_change_requests_self_insert" on profile_change_requests;
create policy "profile_change_requests_self_insert" on profile_change_requests
  for insert with check (auth_user_id = auth.uid());
drop policy if exists "profile_change_requests_self_read" on profile_change_requests;
create policy "profile_change_requests_self_read" on profile_change_requests
  for select using (auth_user_id = auth.uid() or is_staff());
drop policy if exists "profile_change_requests_admin_update" on profile_change_requests;
create policy "profile_change_requests_admin_update" on profile_change_requests
  for update using (is_staff()) with check (is_staff());

drop policy if exists "website_announcements_public_read" on website_announcements;
create policy "website_announcements_public_read" on website_announcements
  for select using (is_enabled = true or is_staff());
drop policy if exists "website_announcements_staff_write" on website_announcements;
create policy "website_announcements_staff_write" on website_announcements
  for all using (is_staff()) with check (is_staff());

create or replace function set_website_announcements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists website_announcements_set_updated_at on website_announcements;
create trigger website_announcements_set_updated_at
before update on website_announcements
for each row execute function set_website_announcements_updated_at();

-- Interview slots: anyone can see open times; only admins manage them.
drop policy if exists "slots_public_read" on interview_slots;
create policy "slots_public_read" on interview_slots
  for select using (true);
drop policy if exists "slots_admin_write" on interview_slots;
create policy "slots_admin_write" on interview_slots
  for all using (is_staff()) with check (is_staff());

-- Q&A questions: anyone can ask; anyone can read approved ones;
-- only admins can read pending ones or change status.
drop policy if exists "questions_public_insert" on qa_questions;
create policy "questions_public_insert" on qa_questions
  for insert with check (true);
drop policy if exists "questions_read_approved_or_admin" on qa_questions;
create policy "questions_read_approved_or_admin" on qa_questions
  for select using (status = 'approved' or asked_by_auth_user_id = auth.uid() or is_staff());
drop policy if exists "questions_admin_update" on qa_questions;
create policy "questions_admin_update" on qa_questions
  for update using (is_staff()) with check (is_staff());
drop policy if exists "questions_admin_delete" on qa_questions;
create policy "questions_admin_delete" on qa_questions
  for delete using (is_staff());

drop policy if exists "question_votes_auth_select" on qa_question_votes;
create policy "question_votes_auth_select" on qa_question_votes
  for select using (voter_auth_user_id = auth.uid() or is_staff());
drop policy if exists "question_votes_auth_insert" on qa_question_votes;
create policy "question_votes_auth_insert" on qa_question_votes
  for insert with check (auth.uid() is not null);
drop policy if exists "question_votes_auth_update" on qa_question_votes;
create policy "question_votes_auth_update" on qa_question_votes
  for update using (voter_auth_user_id = auth.uid() or is_staff()) with check (voter_auth_user_id = auth.uid() or is_staff());
drop policy if exists "question_votes_auth_delete" on qa_question_votes;
create policy "question_votes_auth_delete" on qa_question_votes
  for delete using (voter_auth_user_id = auth.uid() or is_staff());

drop policy if exists "question_reports_auth_select" on qa_question_reports;
create policy "question_reports_auth_select" on qa_question_reports
  for select using (reporter_auth_user_id = auth.uid() or is_staff());
drop policy if exists "question_reports_auth_insert" on qa_question_reports;
create policy "question_reports_auth_insert" on qa_question_reports
  for insert with check (auth.uid() is not null);
drop policy if exists "question_reports_auth_delete" on qa_question_reports;
create policy "question_reports_auth_delete" on qa_question_reports
  for delete using (reporter_auth_user_id = auth.uid() or is_staff());

-- Q&A answers: only signed-in upperclassmen can submit answers;
-- anyone can read approved ones; only admins moderate.
drop policy if exists "answers_upperclassman_insert" on qa_answers;
create policy "answers_upperclassman_insert" on qa_answers
  for insert with check (
    exists (select 1 from student_profiles s where s.auth_user_id = auth.uid())
    or exists (select 1 from teacher_profiles t where t.auth_user_id = auth.uid())
    or is_staff()
  );
drop policy if exists "answers_read_approved_or_admin" on qa_answers;
create policy "answers_read_approved_or_admin" on qa_answers
  for select using (status = 'approved' or answered_by_auth_user_id = auth.uid() or is_staff());
drop policy if exists "answers_admin_update" on qa_answers;
create policy "answers_admin_update" on qa_answers
  for update using (is_staff()) with check (is_staff());
drop policy if exists "answers_admin_delete" on qa_answers;
create policy "answers_admin_delete" on qa_answers
  for delete using (is_staff());

drop policy if exists "answer_votes_auth_select" on qa_answer_votes;
create policy "answer_votes_auth_select" on qa_answer_votes
  for select using (voter_auth_user_id = auth.uid() or is_staff());
drop policy if exists "answer_votes_auth_insert" on qa_answer_votes;
create policy "answer_votes_auth_insert" on qa_answer_votes
  for insert with check (auth.uid() is not null);
drop policy if exists "answer_votes_auth_update" on qa_answer_votes;
create policy "answer_votes_auth_update" on qa_answer_votes
  for update using (voter_auth_user_id = auth.uid() or is_staff()) with check (voter_auth_user_id = auth.uid() or is_staff());
drop policy if exists "answer_votes_auth_delete" on qa_answer_votes;
create policy "answer_votes_auth_delete" on qa_answer_votes
  for delete using (voter_auth_user_id = auth.uid() or is_staff());

drop policy if exists "answer_reports_auth_select" on qa_answer_reports;
create policy "answer_reports_auth_select" on qa_answer_reports
  for select using (reporter_auth_user_id = auth.uid() or is_staff());
drop policy if exists "answer_reports_auth_insert" on qa_answer_reports;
create policy "answer_reports_auth_insert" on qa_answer_reports
  for insert with check (auth.uid() is not null);
drop policy if exists "answer_reports_auth_delete" on qa_answer_reports;
create policy "answer_reports_auth_delete" on qa_answer_reports
  for delete using (reporter_auth_user_id = auth.uid() or is_staff());

-- Upperclassmen: a user can check their own row; admins manage all.
drop policy if exists "upperclassmen_self_read" on upperclassmen;
create policy "upperclassmen_self_read" on upperclassmen
  for select using (auth_user_id = auth.uid() or is_admin());
drop policy if exists "upperclassmen_admin_write" on upperclassmen;
create policy "upperclassmen_admin_write" on upperclassmen
  for all using (is_admin()) with check (is_admin());

-- Admins table: only admins can read/manage the admin list.
drop policy if exists "admins_admin_read" on admins;
create policy "admins_admin_read" on admins
  for select using (is_admin());

-- Keep student profile timestamps current whenever a row changes.
create or replace function set_student_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists student_profiles_set_updated_at on student_profiles;
create trigger student_profiles_set_updated_at
before update on student_profiles
for each row execute function set_student_profiles_updated_at();

create or replace function set_student_email_blocks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists student_email_blocks_set_updated_at on student_email_blocks;
create trigger student_email_blocks_set_updated_at
before update on student_email_blocks
for each row execute function set_student_email_blocks_updated_at();

create or replace function qa_text_is_flagged(p_text text)
returns boolean
language plpgsql
as $$
declare
  blocked_phrase text;
  blocked_phrases text[] := array[
    'buy now',
    'free money',
    'make money fast',
    'crypto pump',
    'casino',
    'onlyfans',
    'porn',
    'nude'
  ];
begin
  if p_text is null or btrim(p_text) = '' then
    return false;
  end if;

  if p_text ~* 'https?://|www\.' then
    return true;
  end if;

  foreach blocked_phrase in array blocked_phrases loop
    if position(lower(blocked_phrase) in lower(p_text)) > 0 then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function guard_qa_question_content()
returns trigger
language plpgsql
as $$
begin
  if qa_text_is_flagged(new.question) then
    raise exception 'This post looks like spam or unsafe content.';
  end if;

  return new;
end;
$$;

drop trigger if exists qa_questions_guard_content on qa_questions;
create trigger qa_questions_guard_content
before insert or update on qa_questions
for each row execute function guard_qa_question_content();

create or replace function sync_qa_question_vote_counts()
returns trigger
language plpgsql
as $$
declare
  affected_question_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_question_id := old.question_id;
  else
    affected_question_id := new.question_id;
  end if;

  update qa_questions
  set upvote_count = coalesce((select count(*) from qa_question_votes where question_id = affected_question_id and value = 1), 0),
      downvote_count = coalesce((select count(*) from qa_question_votes where question_id = affected_question_id and value = -1), 0)
  where id = affected_question_id;

  if tg_op = 'UPDATE' and old.question_id is distinct from new.question_id then
    update qa_questions
    set upvote_count = coalesce((select count(*) from qa_question_votes where question_id = old.question_id and value = 1), 0),
        downvote_count = coalesce((select count(*) from qa_question_votes where question_id = old.question_id and value = -1), 0)
    where id = old.question_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists qa_question_votes_sync_counts on qa_question_votes;
create trigger qa_question_votes_sync_counts
after insert or update or delete on qa_question_votes
for each row execute function sync_qa_question_vote_counts();

create or replace function guard_qa_answer_content()
returns trigger
language plpgsql
as $$
begin
  if qa_text_is_flagged(new.answer) then
    raise exception 'This comment looks like spam or unsafe content.';
  end if;

  return new;
end;
$$;

drop trigger if exists qa_answers_guard_content on qa_answers;
create trigger qa_answers_guard_content
before insert or update on qa_answers
for each row execute function guard_qa_answer_content();

create or replace function sync_qa_answer_vote_counts()
returns trigger
language plpgsql
as $$
declare
  affected_answer_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_answer_id := old.answer_id;
  else
    affected_answer_id := new.answer_id;
  end if;

  update qa_answers
  set upvote_count = coalesce((select count(*) from qa_answer_votes where answer_id = affected_answer_id and value = 1), 0),
      downvote_count = coalesce((select count(*) from qa_answer_votes where answer_id = affected_answer_id and value = -1), 0)
  where id = affected_answer_id;

  if tg_op = 'UPDATE' and old.answer_id is distinct from new.answer_id then
    update qa_answers
    set upvote_count = coalesce((select count(*) from qa_answer_votes where answer_id = old.answer_id and value = 1), 0),
        downvote_count = coalesce((select count(*) from qa_answer_votes where answer_id = old.answer_id and value = -1), 0)
    where id = old.answer_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists qa_answer_votes_sync_counts on qa_answer_votes;
create trigger qa_answer_votes_sync_counts
after insert or update or delete on qa_answer_votes
for each row execute function sync_qa_answer_vote_counts();

create or replace function sync_qa_answer_report_counts()
returns trigger
language plpgsql
as $$
declare
  affected_answer_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_answer_id := old.answer_id;
  else
    affected_answer_id := new.answer_id;
  end if;

  update qa_answers
  set report_count = coalesce((select count(*) from qa_answer_reports where answer_id = affected_answer_id), 0)
  where id = affected_answer_id;

  if tg_op = 'UPDATE' and old.answer_id is distinct from new.answer_id then
    update qa_answers
    set report_count = coalesce((select count(*) from qa_answer_reports where answer_id = old.answer_id), 0)
    where id = old.answer_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists qa_answer_reports_sync_counts on qa_answer_reports;
create trigger qa_answer_reports_sync_counts
after insert or update or delete on qa_answer_reports
for each row execute function sync_qa_answer_report_counts();

create or replace function sync_qa_question_report_counts()
returns trigger
language plpgsql
as $$
declare
  affected_question_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_question_id := old.question_id;
  else
    affected_question_id := new.question_id;
  end if;

  update qa_questions
  set report_count = coalesce((select count(*) from qa_question_reports where question_id = affected_question_id), 0)
  where id = affected_question_id;

  if tg_op = 'UPDATE' and old.question_id is distinct from new.question_id then
    update qa_questions
    set report_count = coalesce((select count(*) from qa_question_reports where question_id = old.question_id), 0)
    where id = old.question_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists qa_question_reports_sync_counts on qa_question_reports;
create trigger qa_question_reports_sync_counts
after insert or update or delete on qa_question_reports
for each row execute function sync_qa_question_report_counts();

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

-- Student login helpers: public lookup for username preview and sign-in resolution.
create or replace function search_student_profiles(p_query text)
returns table (
  auth_email text,
  full_name text,
  display_username text,
  graduating_class_year integer
)
language sql
security definer
set search_path = public
as $$
  select auth_email, full_name, display_username, graduating_class_year
  from student_profiles
  where p_query is not null
    and (
      lower(full_name) like lower(trim(p_query)) || '%'
      or lower(display_username) like lower(trim(p_query)) || '%'
      or lower(full_name) like '%' || lower(trim(p_query)) || '%'
      or lower(display_username) like '%' || lower(trim(p_query)) || '%'
    )
  order by
    case
      when lower(display_username) = lower(trim(p_query)) then 0
      when lower(full_name) = lower(trim(p_query)) then 1
      else 2
    end,
    created_at asc
  limit 5;
$$;

create or replace function resolve_student_login(p_handle text)
returns table (
  auth_email text,
  full_name text,
  display_username text,
  graduating_class_year integer
)
language sql
security definer
set search_path = public
as $$
  select auth_email, full_name, display_username, graduating_class_year
  from student_profiles
  where lower(display_username) = lower(trim(p_handle))
     or lower(full_name) = lower(trim(p_handle))
  order by
    case
      when lower(display_username) = lower(trim(p_handle)) then 0
      else 1
    end,
    created_at asc
  limit 1;
$$;

grant execute on function search_student_profiles(text) to anon, authenticated;
grant execute on function resolve_student_login(text) to anon, authenticated;

-- Run after schema.sql (and leadership_history.sql for older installations).
-- Removed roles remain available for historical labels and applications.
create table if not exists leadership_roles (
  slug text primary key,
  label text not null check (length(btrim(label)) between 1 and 100),
  open boolean not null default true,
  "requiresProof" boolean not null default false,
  display_order integer not null default 0,
  active boolean not null default true
);
create unique index if not exists leadership_roles_active_label_idx
  on leadership_roles (lower(btrim(label))) where active;

insert into leadership_roles (slug, label, open, "requiresProof", display_order) values
  ('president', 'President', false, false, 0),
  ('vice-president', 'Vice President', true, false, 1),
  ('secretary', 'Secretary', true, false, 2),
  ('publicist', 'Publicist', true, true, 3),
  ('treasurer', 'Treasurer', true, false, 4),
  ('rep-10', '10th Grade Representative', true, false, 5),
  ('rep-9', '9th Grade Representative', true, false, 6)
on conflict (slug) do nothing;

alter table leadership_members drop constraint if exists leadership_members_role_check;
alter table leadership_roles enable row level security;
drop policy if exists leadership_roles_public_read on leadership_roles;
create policy leadership_roles_public_read on leadership_roles for select using (true);
drop policy if exists leadership_roles_staff_insert on leadership_roles;
create policy leadership_roles_staff_insert on leadership_roles for insert with check (is_staff());
drop policy if exists leadership_roles_staff_update on leadership_roles;
create policy leadership_roles_staff_update on leadership_roles for update using (is_staff()) with check (is_staff());

-- Serialize role removal against filling a seat, so a filled role cannot disappear.
create or replace function check_leadership_role_removal() returns trigger
language plpgsql set search_path = public as $$
begin
  if not new.active and exists (select 1 from leadership_members where role = old.slug) then
    raise exception 'Vacate or retire the member before removing this role.';
  end if;
  return new;
end;
$$;
drop trigger if exists leadership_role_removal on leadership_roles;
create trigger leadership_role_removal before update on leadership_roles
  for each row execute function check_leadership_role_removal();

create or replace function check_leadership_member_role() returns trigger
language plpgsql set search_path = public as $$
begin
  perform 1 from leadership_roles where slug = new.role and active for update;
  if not found then raise exception 'Choose an active leadership role.'; end if;
  return new;
end;
$$;
drop trigger if exists leadership_member_active_role on leadership_members;
create trigger leadership_member_active_role before insert or update on leadership_members
  for each row execute function check_leadership_member_role();

-- Verified admin forum overrides (also available as an incremental migration).
-- Apply once to an existing project before deploying the admin override UI.
-- The server verifies the current admin's password before calling these RPCs.
create table if not exists public.forum_override_attempts (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists forum_override_attempts_admin_time
  on public.forum_override_attempts(admin_id, attempted_at);
alter table public.forum_override_attempts enable row level security;
revoke all on public.forum_override_attempts from anon, authenticated;

create table if not exists public.forum_override_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  admin_name text not null,
  target_kind text not null check (target_kind in ('question', 'answer')),
  target_id uuid not null,
  content text not null,
  reason text not null,
  verified_at timestamptz not null default now()
);
alter table public.forum_override_audit enable row level security;
revoke all on public.forum_override_audit from anon, authenticated;
grant select on public.forum_override_audit to authenticated;
drop policy if exists forum_override_audit_admin_read on public.forum_override_audit;
create policy forum_override_audit_admin_read on public.forum_override_audit
  for select to authenticated using (public.is_admin());

create or replace function public.claim_forum_override_attempt(p_admin_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Unauthorized'; end if;
  if not exists (select 1 from public.admins where auth_user_id = p_admin_id) then
    raise exception 'Admin access required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_admin_id::text, 0));
  delete from public.forum_override_attempts where admin_id = p_admin_id and attempted_at < now() - interval '15 minutes';
  if (select count(*) from public.forum_override_attempts where admin_id = p_admin_id) >= 5 then
    return false;
  end if;
  insert into public.forum_override_attempts(admin_id) values (p_admin_id);
  return true;
end;
$$;
revoke all on function public.claim_forum_override_attempt(uuid) from public, anon, authenticated;
grant execute on function public.claim_forum_override_attempt(uuid) to service_role;

create or replace function public.publish_verified_forum_override(
  p_admin_id uuid, p_kind text, p_text text, p_reason text,
  p_board text default null, p_question_id uuid default null, p_parent_answer_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Unauthorized'; end if;
  select name into v_name from public.admins where auth_user_id = p_admin_id for share;
  if not found then raise exception 'Admin access required'; end if;
  if p_text is null or length(btrim(p_text)) < 3 or length(p_text) > 20000 or
     p_reason is null or length(btrim(p_reason)) < 10 or length(p_reason) > 500 then
    raise exception 'Content and an override reason are required';
  end if;
  -- Transaction-local and usable only with the service-role JWT. No persistent bypass flag.
  perform set_config('app.verified_forum_override', 'true', true);
  if p_kind = 'question' then
    insert into public.qa_questions(question, asked_by_name, asked_by_auth_user_id, forum_board, status)
      values (btrim(p_text), v_name, p_admin_id, p_board, 'approved') returning id into v_id;
  elsif p_kind = 'answer' then
    if not exists (select 1 from public.qa_questions where id = p_question_id and status = 'approved') then
      raise exception 'Post unavailable';
    end if;
    if p_parent_answer_id is not null and not exists (
      select 1 from public.qa_answers where id = p_parent_answer_id and question_id = p_question_id and status = 'approved'
    ) then raise exception 'Invalid parent comment'; end if;
    insert into public.qa_answers(question_id, answer, answered_by_name, answered_by_auth_user_id, parent_answer_id, status)
      values (p_question_id, btrim(p_text), v_name, p_admin_id, p_parent_answer_id, 'approved') returning id into v_id;
  else raise exception 'Invalid target';
  end if;
  perform set_config('app.verified_forum_override', 'false', true);
  insert into public.forum_override_audit(admin_id, admin_name, target_kind, target_id, content, reason)
    values (p_admin_id, v_name, p_kind, v_id, btrim(p_text), btrim(p_reason));
  return v_id;
end;
$$;
revoke all on function public.publish_verified_forum_override(uuid, text, text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_verified_forum_override(uuid, text, text, text, text, uuid, uuid) to service_role;

create or replace function public.guard_qa_question_content()
returns trigger language plpgsql as $$
begin
  -- Votes, reports, and moderation must still work on verified content.
  if tg_op = 'UPDATE' and new.question is not distinct from old.question then
    return new;
  end if;
  if auth.role() = 'service_role' and current_setting('app.verified_forum_override', true) = 'true' then
    return new;
  end if;
  if public.qa_text_is_flagged(new.question) then
    raise exception 'This post looks like spam or unsafe content.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_qa_answer_content()
returns trigger language plpgsql as $$
begin
  -- Votes, reports, and moderation must still work on verified content.
  if tg_op = 'UPDATE' and new.answer is not distinct from old.answer then
    return new;
  end if;
  if auth.role() = 'service_role' and current_setting('app.verified_forum_override', true) = 'true' then
    return new;
  end if;
  if public.qa_text_is_flagged(new.answer) then
    raise exception 'This comment looks like spam or unsafe content.';
  end if;
  return new;
end;
$$;


-- GEA Builders: run after schema.sql for an existing installation.
-- Uses existing approved student_profiles and the server-checked admins allowlist.
begin;
create table if not exists public.builder_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  parent_id uuid unique references public.builder_submissions(id),
  title text not null check (length(btrim(title)) between 1 and 100),
  location text not null check (location in ('home', 'school', 'community')),
  problem text not null check (length(btrim(problem)) between 1 and 2000),
  build text not null check (length(btrim(build)) between 1 and 2000),
  skills text not null check (length(btrim(skills)) between 1 and 1000),
  team text not null check (length(btrim(team)) between 1 and 200),
  evidence_url text not null check (length(evidence_url) <= 2000 and evidence_url ~ '^https://drive[.]google[.]com/[^[:space:]]+$'),
  wall_opt_out boolean not null default false,
  wall_hidden boolean not null default true,
  wall_name text not null default '' check (length(wall_name) <= 80),
  wall_title text not null default '' check (length(wall_title) <= 100),
  wall_problem text not null default '' check (length(wall_problem) <= 2000),
  wall_build text not null default '' check (length(wall_build) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'needs_changes', 'approved')),
  solves_problem boolean not null default false,
  helps_others boolean not null default false,
  gea_skills boolean not null default false,
  clear_evidence boolean not null default false,
  points integer generated always as (case when status = 'approved' then
    (case when solves_problem then 10 else 0 end) + (case when helps_others then 5 else 0 end)
    + (case when gea_skills then 5 else 0 end) + (case when clear_evidence then 5 else 0 end)
    else 0 end) stored,
  officer_note text not null default '' check (length(officer_note) <= 2000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  check (status <> 'needs_changes' or length(btrim(officer_note)) > 0)
);
create index if not exists builder_submissions_student_idx on public.builder_submissions(student_id);
create index if not exists builder_submissions_status_idx on public.builder_submissions(status, created_at);
create table if not exists public.builder_recognitions (
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  threshold integer not null check (threshold in (10, 30, 60, 100)),
  certificate boolean not null default false,
  shoutout boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (student_id, threshold)
);
alter table public.builder_submissions enable row level security;
alter table public.builder_recognitions enable row level security;
drop policy if exists builders_read on public.builder_submissions;
create policy builders_read on public.builder_submissions for select to authenticated using (
  public.is_admin() or exists (select 1 from public.student_profiles p where p.id = student_id and p.auth_user_id = auth.uid())
);
drop policy if exists builder_recognitions_read on public.builder_recognitions;
create policy builder_recognitions_read on public.builder_recognitions for select to authenticated using (
  public.is_admin() or exists (select 1 from public.student_profiles p where p.id = student_id and p.auth_user_id = auth.uid())
);
-- Writes only through the following checked functions; browsers cannot forge points or ownership.
revoke all on public.builder_submissions, public.builder_recognitions from anon, authenticated;
grant select on public.builder_submissions, public.builder_recognitions to authenticated;

create or replace function public.submit_builder_project(
  p_title text, p_location text, p_problem text, p_build text, p_skills text, p_team text,
  p_evidence_url text, p_wall_opt_out boolean, p_parent_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_id uuid; v_parent public.builder_submissions;
begin
  select id into v_student from public.student_profiles where auth_user_id = auth.uid();
  if v_student is null then raise exception 'Sign in with an approved GEA student account to submit a build.'; end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 100
    or p_problem is null or length(btrim(p_problem)) not between 1 and 2000
    or p_build is null or length(btrim(p_build)) not between 1 and 2000
    or p_skills is null or length(btrim(p_skills)) not between 1 and 1000
    or p_team is null or length(btrim(p_team)) not between 1 and 200
    or p_location is null or p_location not in ('home','school','community')
    or p_evidence_url is null or length(p_evidence_url) > 2000
    or btrim(p_evidence_url) !~ '^https://drive[.]google[.]com/[^[:space:]]+$'
    or p_wall_opt_out is null then raise exception 'Complete every field and use a valid HTTPS Google Drive video link.'; end if;
  if p_parent_id is not null then
    select * into v_parent from public.builder_submissions where id = p_parent_id for update;
    if not found or v_parent.student_id <> v_student or v_parent.status <> 'needs_changes'
      or exists (select 1 from public.builder_submissions where parent_id = p_parent_id)
      then raise exception 'This project is not available for resubmission. Refresh your progress.'; end if;
  end if;
  insert into public.builder_submissions(student_id, parent_id, title, location, problem, build, skills, team, evidence_url, wall_opt_out)
    values(v_student, p_parent_id, btrim(p_title), p_location, btrim(p_problem), btrim(p_build), btrim(p_skills), btrim(p_team), btrim(p_evidence_url), p_wall_opt_out)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.review_builder_project(
  p_id uuid, p_status text, p_note text, p_solves_problem boolean, p_helps_others boolean,
  p_gea_skills boolean, p_clear_evidence boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Approved officer access is required.'; end if;
  if p_status is null or p_status not in ('approved','needs_changes') or p_note is null or length(p_note) > 2000
    or (p_status = 'needs_changes' and length(btrim(p_note)) = 0)
    then raise exception 'Choose a review decision and include feedback when requesting changes.'; end if;
  update public.builder_submissions set status = p_status, officer_note = btrim(p_note),
    solves_problem = coalesce(p_solves_problem, false), helps_others = coalesce(p_helps_others, false),
    gea_skills = coalesce(p_gea_skills, false), clear_evidence = coalesce(p_clear_evidence, false),
    reviewed_at = now(), reviewed_by = auth.uid()
    where id = p_id and status = 'pending';
  if not found then raise exception 'This project has already been reviewed or is unavailable. Refresh the queue.'; end if;
end $$;

create or replace function public.set_builder_privacy(p_id uuid, p_opt_out boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_opt_out is null then raise exception 'Choose a sharing preference.'; end if;
  update public.builder_submissions s set wall_opt_out = p_opt_out,
    wall_hidden = case when p_opt_out then true else wall_hidden end
    where s.id = p_id and exists (select 1 from public.student_profiles p where p.id = s.student_id and p.auth_user_id = auth.uid());
  if not found then raise exception 'This project is unavailable for your account.'; end if;
end $$;

create or replace function public.edit_builder_story(
  p_id uuid, p_name text, p_title text, p_problem text, p_build text, p_hidden boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Approved officer access is required.'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80
    or p_title is null or length(btrim(p_title)) not between 1 and 100
    or p_problem is null or length(btrim(p_problem)) not between 1 and 2000
    or p_build is null or length(btrim(p_build)) not between 1 and 2000 or p_hidden is null
    then raise exception 'Complete the public story before saving.'; end if;
  update public.builder_submissions set wall_name = btrim(p_name), wall_title = btrim(p_title),
    wall_problem = btrim(p_problem), wall_build = btrim(p_build), wall_hidden = p_hidden
    where id = p_id and status = 'approved' and (p_hidden or not wall_opt_out);
  if not found then raise exception 'Only approved projects whose students allow sharing can be published.'; end if;
end $$;

-- Explicit projection: no student IDs, emails, video links, private notes, or totals.
create or replace function public.get_builder_wall()
returns table(id uuid, first_name text, title text, location text, problem text, build text)
language sql stable security definer set search_path = public as $$
  select s.id, s.wall_name, s.wall_title, s.location, s.wall_problem, s.wall_build
  from public.builder_submissions s where s.status = 'approved' and not s.wall_opt_out and not s.wall_hidden
    and length(btrim(s.wall_name)) > 0 and length(btrim(s.wall_title)) > 0
    and length(btrim(s.wall_problem)) > 0 and length(btrim(s.wall_build)) > 0
  order by s.reviewed_at desc, s.id;
$$;

create or replace function public.set_builder_recognition(p_student_id uuid, p_threshold integer, p_certificate boolean, p_shoutout boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_total integer;
begin
  if not public.is_admin() then raise exception 'Approved officer access is required.'; end if;
  -- Serialize recognition changes for this student.
  perform 1 from public.student_profiles where id = p_student_id for update;
  if not found then raise exception 'Student not found.'; end if;
  select coalesce(sum(points), 0) into v_total from public.builder_submissions where student_id = p_student_id;
  if p_threshold is null or p_threshold not in (10,30,60,100) or v_total < p_threshold
    or p_certificate is null or p_shoutout is null then raise exception 'This milestone has not been earned.'; end if;
  insert into public.builder_recognitions(student_id, threshold, certificate, shoutout, updated_by)
    values(p_student_id, p_threshold, p_certificate, p_shoutout, auth.uid())
    on conflict(student_id, threshold) do update set certificate = excluded.certificate,
      shoutout = excluded.shoutout, updated_at = now(), updated_by = auth.uid();
end $$;

revoke all on function public.submit_builder_project(text,text,text,text,text,text,text,boolean,uuid) from public, anon;
revoke all on function public.review_builder_project(uuid,text,text,boolean,boolean,boolean,boolean) from public, anon;
revoke all on function public.set_builder_privacy(uuid,boolean) from public, anon;
revoke all on function public.edit_builder_story(uuid,text,text,text,text,boolean) from public, anon;
revoke all on function public.set_builder_recognition(uuid,integer,boolean,boolean) from public, anon;
revoke all on function public.get_builder_wall() from public;
grant execute on function public.submit_builder_project(text,text,text,text,text,text,text,boolean,uuid) to authenticated;
grant execute on function public.review_builder_project(uuid,text,text,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.set_builder_privacy(uuid,boolean) to authenticated;
grant execute on function public.edit_builder_story(uuid,text,text,text,text,boolean) to authenticated;
grant execute on function public.set_builder_recognition(uuid,integer,boolean,boolean) to authenticated;
grant execute on function public.get_builder_wall() to anon, authenticated;
commit;


-- PEET officer portal. Run in the existing Supabase project's SQL editor.
-- Uses existing auth.users; PEET roles are independent of the site admins list.
begin;

create table if not exists public.officer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  role text not null default 'officer' check (role in ('officer', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 10000),
  assigned_to uuid not null references public.officer_profiles(id),
  created_by uuid not null references public.officer_profiles(id),
  due_date date,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'completed')),
  final_product_url text check (final_product_url is null or
    (length(final_product_url) <= 2048 and final_product_url ~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  check (status = 'in_progress' or (final_product_url is not null and submitted_at is not null)),
  check ((status = 'completed') = (completed_at is not null))
);

create table if not exists public.peet_evaluations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  evaluated_by uuid not null references public.officer_profiles(id),
  efficiency numeric not null check (efficiency between 1.0 and 4.0),
  effectiveness numeric not null check (effectiveness between 1.0 and 4.0),
  time numeric not null check (time between 1.0 and 4.0),
  feedback_notes text not null default '' check (length(feedback_notes) <= 10000),
  evaluated_at timestamptz not null default now()
);
create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to, created_at desc);
create index if not exists tasks_status_idx on public.tasks(status);

create or replace function public.is_peet_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.officer_profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.officer_profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.peet_evaluations enable row level security;
drop policy if exists officer_profiles_read on public.officer_profiles;
create policy officer_profiles_read on public.officer_profiles for select to authenticated
  using (id = auth.uid() or public.is_peet_admin());
drop policy if exists officer_tasks_read on public.tasks;
create policy officer_tasks_read on public.tasks for select to authenticated
  using (public.is_peet_admin() or (assigned_to = auth.uid() and exists
    (select 1 from public.officer_profiles where id = auth.uid())));
drop policy if exists officer_evaluations_read on public.peet_evaluations;
create policy officer_evaluations_read on public.peet_evaluations for select to authenticated
  using (public.is_peet_admin() or exists
    (select 1 from public.tasks where tasks.id = task_id and assigned_to = auth.uid()));

-- Writes go through validated RPCs; browsers cannot change roles, identities,
-- timestamps, completion status, or scores directly, even on their own records.
revoke all on public.officer_profiles, public.tasks, public.peet_evaluations from public, anon, authenticated;
grant select on public.officer_profiles, public.tasks, public.peet_evaluations to authenticated;
grant all on public.officer_profiles, public.tasks, public.peet_evaluations to service_role;

create or replace function public.save_officer_task(
  p_title text, p_description text default '', p_due_date date default null,
  p_assigned_to uuid default null, p_task_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_admin boolean := public.is_peet_admin();
  v_assignee uuid := coalesce(p_assigned_to, auth.uid());
  v_task public.tasks;
  v_id uuid;
begin
  if v_actor is null or not exists (select 1 from public.officer_profiles where id = v_actor) then
    raise exception 'Officer access is required.';
  end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 200
    or p_description is null or length(p_description) > 10000 then
    raise exception 'Enter a title of 1–200 characters and a description of at most 10,000 characters.';
  end if;
  if not exists (select 1 from public.officer_profiles where id = v_assignee)
    or (not v_admin and v_assignee <> v_actor) then
    raise exception 'You can only assign tasks to yourself.';
  end if;
  if p_task_id is null then
    insert into public.tasks(title, description, due_date, assigned_to, created_by)
      values(btrim(p_title), p_description, p_due_date, v_assignee, v_actor) returning id into v_id;
    return v_id;
  end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or (not v_admin and v_task.assigned_to <> v_actor) then
    raise exception 'Task not available.';
  end if;
  if v_task.status = 'completed' or (not v_admin and v_task.status <> 'in_progress') then
    raise exception 'This task can no longer be edited.';
  end if;
  update public.tasks set title = btrim(p_title), description = p_description,
    due_date = p_due_date, assigned_to = v_assignee where id = p_task_id;
  return p_task_id;
end;
$$;

create or replace function public.submit_officer_task(p_task_id uuid, p_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks; v_url text := btrim(p_url);
begin
  if auth.uid() is null or not exists (select 1 from public.officer_profiles where id = auth.uid()) then
    raise exception 'Officer access is required.';
  end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or (v_task.assigned_to <> auth.uid() and not public.is_peet_admin()) then
    raise exception 'Task not available.';
  end if;
  if v_task.status <> 'in_progress' then raise exception 'This task has already been submitted.'; end if;
  if v_url is null or length(v_url) > 2048 or v_url !~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$' then
    raise exception 'Enter a valid HTTP or HTTPS link to your final product.';
  end if;
  update public.tasks set final_product_url = v_url, status = 'submitted', submitted_at = now()
    where id = p_task_id;
end;
$$;

create or replace function public.delete_officer_task(p_task_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks;
begin
  if auth.uid() is null or not exists (select 1 from public.officer_profiles where id = auth.uid()) then
    raise exception 'Officer access is required.';
  end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or (not public.is_peet_admin() and
    (v_task.assigned_to <> auth.uid() or v_task.status <> 'in_progress')) then
    raise exception 'Only your in-progress tasks can be deleted.';
  end if;
  delete from public.tasks where id = p_task_id;
end;
$$;

-- One evaluation per task prevents repeated reviews from changing its weight.
-- The task lock and transaction make evaluation + completion atomic.
create or replace function public.evaluate_officer_task(
  p_task_id uuid, p_efficiency numeric, p_effectiveness numeric, p_time numeric,
  p_feedback text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks;
begin
  if auth.uid() is null or not public.is_peet_admin() then raise exception 'PEET reviewer access is required.'; end if;
  if p_efficiency is null or p_efficiency not between 1 and 4
    or p_effectiveness is null or p_effectiveness not between 1 and 4
    or p_time is null or p_time not between 1 and 4 then
    raise exception 'Each PEET score must be between 1.0 and 4.0.';
  end if;
  if p_feedback is null or length(p_feedback) > 10000 then raise exception 'Feedback must be at most 10,000 characters.'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or v_task.status not in ('submitted', 'completed') then
    raise exception 'Only submitted or completed tasks can be evaluated.';
  end if;
  insert into public.peet_evaluations(task_id, evaluated_by, efficiency, effectiveness, time, feedback_notes)
    values(p_task_id, auth.uid(), p_efficiency, p_effectiveness, p_time, p_feedback)
    on conflict(task_id) do update set evaluated_by = excluded.evaluated_by,
      efficiency = excluded.efficiency, effectiveness = excluded.effectiveness,
      time = excluded.time, feedback_notes = excluded.feedback_notes, evaluated_at = now();
  update public.tasks set status = 'completed', completed_at = coalesce(completed_at, now()) where id = p_task_id;
end;
$$;

revoke all on function public.is_peet_admin() from public, anon, authenticated;
revoke all on function public.save_officer_task(text,text,date,uuid,uuid) from public, anon, authenticated;
revoke all on function public.submit_officer_task(uuid,text) from public, anon, authenticated;
revoke all on function public.delete_officer_task(uuid) from public, anon, authenticated;
revoke all on function public.evaluate_officer_task(uuid,numeric,numeric,numeric,text) from public, anon, authenticated;
grant execute on function public.is_peet_admin(), public.save_officer_task(text,text,date,uuid,uuid),
  public.submit_officer_task(uuid,text), public.delete_officer_task(uuid),
  public.evaluate_officer_task(uuid,numeric,numeric,numeric,text) to authenticated;
commit;

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
  if not found or v_event.kind<>'meeting' or v_event.cancelled then raise exception 'Select a scheduled leadership meeting.'; end if;
  if p_status is null or p_status not in ('unmarked','present','late','excused','unexcused') or p_notes is null or length(p_notes)>10000 then raise exception 'Check the attendance status and notes.'; end if;
  if not exists(select 1 from public.officer_profiles where id=p_officer_id) then raise exception 'Officer not available.'; end if;
  if p_status in ('present','late','unexcused') and v_event.starts_at>now() then raise exception 'Record actual attendance after the meeting begins.'; end if;
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

-- Run after officerboard.sql and officer-accountability.sql.
-- Super admins are a trusted allowlist, never a signup/profile metadata claim.
begin;
create table if not exists public.super_admins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.super_admins enable row level security;
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.super_admins where auth_user_id=auth.uid());
$$;
drop policy if exists super_admins_read on public.super_admins;
create policy super_admins_read on public.super_admins for select to authenticated
  using(auth_user_id=auth.uid() or public.is_super_admin());
revoke all on public.super_admins from public,anon,authenticated;
grant select on public.super_admins to authenticated;
grant all on public.super_admins to service_role;
revoke all on function public.is_super_admin() from public,anon,authenticated;
grant execute on function public.is_super_admin() to authenticated;

create table if not exists public.account_management_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  target_id uuid not null references auth.users(id),
  account_kind text not null,
  action text not null,
  before_record jsonb,
  after_record jsonb,
  recorded_at timestamptz not null default now()
);
alter table public.account_management_audit enable row level security;
drop policy if exists account_audit_read on public.account_management_audit;
create policy account_audit_read on public.account_management_audit for select to authenticated using(public.is_super_admin());
revoke all on public.account_management_audit from public,anon,authenticated;
grant select on public.account_management_audit to authenticated;
grant all on public.account_management_audit to service_role;

-- Account writes are called only by the server using the service role, after it
-- verifies the session. Recheck the supplied actor in the trusted allowlist here.
create or replace function public.superadmin_save_account(
  p_actor uuid,p_target uuid,p_kind text,p_name text,p_email text,
  p_username text default null,p_class_year integer default null,p_student_id text default null,
  p_portal_role text default 'officer',p_reviewer_kind text default null,p_position text default ''
) returns void language plpgsql security definer set search_path='' as $$
declare v_before jsonb; v_after jsonb; v_student_id text; begin
  perform 1 from public.super_admins where auth_user_id=p_actor for share;
  if not found then raise exception 'Super-admin access is required.'; end if;
  if p_kind is null or p_kind not in ('student','teacher','officer') or p_name is null or length(btrim(p_name)) not between 1 and 160
    or p_email is null or p_email !~* '^[^[:space:]@]+@lvjusd\.org$' then raise exception 'Enter a name and a valid @lvjusd.org email.'; end if;
  perform 1 from auth.users where id=p_target and lower(email)=lower(p_email) for share;
  if not found then raise exception 'The Auth account and profile email must match.'; end if;
  if p_kind='student' then
    if p_username is null or length(btrim(p_username)) not between 1 and 80 or p_class_year is null or p_class_year not between 2020 and 2100 then raise exception 'Enter a username and valid graduating class year.'; end if;
    select to_jsonb(s)-'student_id_number',student_id_number into v_before,v_student_id from public.student_profiles s where auth_user_id=p_target for update;
    v_student_id:=coalesce(nullif(btrim(p_student_id),''),v_student_id);
    if v_student_id is null or length(v_student_id) not between 1 and 64 then raise exception 'A student ID is required for a new student profile.'; end if;
    if exists(select 1 from public.student_email_blocks where school_email=lower(p_email) and is_active) then raise exception 'Unblock this student email in website administration before adding the account.'; end if;
    insert into public.student_profiles(auth_user_id,auth_email,full_name,display_username,graduating_class_year,student_id_number,school_email)
      values(p_target,lower(p_email),btrim(p_name),btrim(p_username),p_class_year,v_student_id,lower(p_email))
      on conflict(auth_user_id) do update set auth_email=excluded.auth_email,full_name=excluded.full_name,
        display_username=excluded.display_username,graduating_class_year=excluded.graduating_class_year,
        student_id_number=excluded.student_id_number,school_email=excluded.school_email;
    select to_jsonb(s)-'student_id_number' into v_after from public.student_profiles s where auth_user_id=p_target;
  elsif p_kind='teacher' then
    select to_jsonb(t) into v_before from public.teacher_profiles t where auth_user_id=p_target for update;
    insert into public.teacher_profiles(auth_user_id,auth_email,full_name,school_email) values(p_target,lower(p_email),btrim(p_name),lower(p_email))
      on conflict(auth_user_id) do update set auth_email=excluded.auth_email,full_name=excluded.full_name,school_email=excluded.school_email;
    select to_jsonb(t) into v_after from public.teacher_profiles t where auth_user_id=p_target;
  else
    if p_portal_role is null or p_portal_role not in ('officer','admin') or p_position is null or length(p_position)>160
      or (p_portal_role='admin' and (p_reviewer_kind is null or p_reviewer_kind not in ('president','advisor')))
      or (p_portal_role='officer' and p_reviewer_kind is not null) then raise exception 'Choose an officer or designated reviewer role.'; end if;
    if exists(select 1 from public.super_admins where auth_user_id=p_target) and (p_portal_role<>'admin' or p_reviewer_kind<>'president') then raise exception 'Super-admin portal membership cannot be downgraded here.'; end if;
    select to_jsonb(p) into v_before from public.officer_profiles p where id=p_target for update;
    insert into public.officer_profiles(id,name,role,position,reviewer_kind) values(p_target,btrim(p_name),p_portal_role,p_position,p_reviewer_kind)
      on conflict(id) do update set name=excluded.name,role=excluded.role,position=excluded.position,reviewer_kind=excluded.reviewer_kind;
    select to_jsonb(p) into v_after from public.officer_profiles p where id=p_target;
  end if;
  -- Keep login email references consistent when an existing Auth email is edited.
  update public.student_profiles set auth_email=lower(p_email),school_email=lower(p_email) where auth_user_id=p_target;
  update public.teacher_profiles set auth_email=lower(p_email),school_email=lower(p_email) where auth_user_id=p_target;
  insert into public.account_management_audit(actor_id,target_id,account_kind,action,before_record,after_record)
    values(p_actor,p_target,p_kind,case when v_before is null then 'add' else 'edit' end,v_before,v_after);
end $$;

create or replace function public.superadmin_remove_account(p_actor uuid,p_target uuid,p_kind text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$ declare v_before jsonb; begin
  perform 1 from public.super_admins where auth_user_id=p_actor for share;
  if not found then raise exception 'Super-admin access is required.'; end if;
  if p_actor=p_target then raise exception 'You cannot remove your own account access here.'; end if;
  if p_kind is null or p_kind not in ('student','teacher') or p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then raise exception 'Choose student or teacher access and provide a removal reason.'; end if;
  if p_kind='student' then
    select to_jsonb(s)-'student_id_number' into v_before from public.student_profiles s where auth_user_id=p_target for update;
    if v_before is null then raise exception 'Student profile not available.'; end if;
    delete from public.upperclassmen where auth_user_id=p_target;
    delete from public.student_profiles where auth_user_id=p_target;
  else
    select to_jsonb(t) into v_before from public.teacher_profiles t where auth_user_id=p_target for update;
    if v_before is null then raise exception 'Teacher profile not available.'; end if;
    -- Revoke outstanding invites so a removed teacher cannot reuse an old link.
    delete from public.teacher_invites where lower(teacher_email)=lower(v_before->>'school_email');
    delete from public.teacher_profiles where auth_user_id=p_target;
  end if;
  insert into public.account_management_audit(actor_id,target_id,account_kind,action,before_record,after_record)
    values(p_actor,p_target,p_kind,'remove',v_before,jsonb_build_object('reason',p_reason));
end $$;
revoke all on function public.superadmin_save_account(uuid,uuid,text,text,text,text,integer,text,text,text,text),
  public.superadmin_remove_account(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.superadmin_save_account(uuid,uuid,text,text,text,text,integer,text,text,text,text),
  public.superadmin_remove_account(uuid,uuid,text,text) to service_role;

-- Full site and portal access for explicitly designated super admins.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_super_admin() or exists(select 1 from public.admins where auth_user_id=auth.uid());
$$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or exists(select 1 from public.teacher_profiles where auth_user_id=auth.uid());
$$;
create or replace function public.is_peet_admin() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_super_admin() or exists(select 1 from public.officer_profiles where id=auth.uid() and role='admin');
$$;
create or replace function public.is_peet_advisor() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_super_admin() or exists(select 1 from public.officer_profiles where id=auth.uid() and role='admin' and reviewer_kind='advisor');
$$;
create or replace function public.check_peet_reviewer() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from public.super_admins where auth_user_id=new.evaluated_by) then return new; end if;
 if exists(select 1 from public.tasks t join public.officer_profiles p on p.id=t.assigned_to where t.id=new.task_id and p.reviewer_kind='president')
   and not exists(select 1 from public.officer_profiles where id=new.evaluated_by and role='admin' and reviewer_kind='advisor') then
   raise exception 'The President’s PEET performance must be evaluated by the Academy Advisor.';
 end if;
 return new;
end $$;
revoke all on function public.is_admin(),public.is_staff(),public.is_peet_admin(),public.is_peet_advisor() from public,anon,authenticated;
grant execute on function public.is_admin(),public.is_staff() to anon,authenticated,service_role;
grant execute on function public.is_peet_admin(),public.is_peet_advisor() to authenticated,service_role;

-- Explicitly requested promotion, matched to an existing Auth account by email.
-- No account is created and no password is changed by this migration.
insert into public.super_admins(auth_user_id)
 select id from auth.users where lower(email)='jaden.jir@lvjusd.org'
 on conflict(auth_user_id) do nothing;
insert into public.admins(auth_user_id,name)
 select id,'Jaden Jirasevijinda' from auth.users where lower(email)='jaden.jir@lvjusd.org'
 on conflict(auth_user_id) do nothing;
insert into public.officer_profiles(id,name,role,position,reviewer_kind)
 select id,'Jaden Jirasevijinda','admin','President','president' from auth.users where lower(email)='jaden.jir@lvjusd.org'
 on conflict(id) do update set role='admin',position='President',reviewer_kind='president';
commit;

-- This result confirms whether the requested existing account was promoted.
select auth_user_id as super_admin_user_id from public.super_admins
where auth_user_id in (select id from auth.users where lower(email)='jaden.jir@lvjusd.org');

-- Run after super-admin.sql. Existing and future teacher profiles receive
-- super-admin, site-admin, and Officer Board access on their existing Auth login.
begin;
alter table public.super_admins add column if not exists explicit_grant boolean not null default true;
alter table public.super_admins add column if not exists teacher_grant boolean not null default false;
alter table public.officer_profiles add column if not exists access_enabled boolean not null default true;
alter table public.officer_profiles add column if not exists teacher_managed boolean not null default false;
create table if not exists public.teacher_access_grants (
 auth_user_id uuid primary key references auth.users(id),
 admin_added boolean not null,
 officer_previous jsonb,
 created_at timestamptz not null default now()
);
alter table public.teacher_access_grants enable row level security;
revoke all on public.teacher_access_grants from public,anon,authenticated;
grant all on public.teacher_access_grants to service_role;

-- Creating teachers now grants full administration. Ordinary officer/site-admin
-- accounts must not self-promote by inserting a teacher profile or invite.
alter table public.teacher_profiles enable row level security;
drop policy if exists teacher_profiles_admin_write on public.teacher_profiles;
create policy teacher_profiles_admin_write on public.teacher_profiles for all to authenticated
 using(public.is_super_admin()) with check(public.is_super_admin());
alter table public.teacher_invites enable row level security;
drop policy if exists teacher_invites_admin_manage on public.teacher_invites;
create policy teacher_invites_admin_manage on public.teacher_invites for all to authenticated
 using(public.is_super_admin()) with check(public.is_super_admin());

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.super_admins s where s.auth_user_id=auth.uid()
   and (s.explicit_grant or (s.teacher_grant and exists(select 1 from public.teacher_profiles t where t.auth_user_id=s.auth_user_id))));
$$;
drop policy if exists super_admins_read on public.super_admins;
create policy super_admins_read on public.super_admins for select to authenticated using(
 (explicit_grant or (teacher_grant and exists(select 1 from public.teacher_profiles t where t.auth_user_id=super_admins.auth_user_id)))
 and (auth_user_id=auth.uid() or public.is_super_admin()));

create or replace function public.has_officer_access()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.officer_profiles where id=auth.uid() and access_enabled);
$$;
create or replace function public.is_peet_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select public.is_super_admin() or exists(select 1 from public.officer_profiles where id=auth.uid() and access_enabled and role='admin');
$$;
create or replace function public.is_peet_advisor()
returns boolean language sql stable security definer set search_path='' as $$
 select public.is_super_admin() or exists(select 1 from public.officer_profiles where id=auth.uid() and access_enabled and role='admin' and reviewer_kind='advisor');
$$;
drop policy if exists officer_profiles_read on public.officer_profiles;
create policy officer_profiles_read on public.officer_profiles for select to authenticated
 using(public.is_peet_admin() or (id=auth.uid() and access_enabled));

create or replace function public.provision_teacher_access(p_id uuid,p_name text)
returns void language plpgsql security definer set search_path='' as $$
declare v_previous jsonb; begin
 select to_jsonb(p) into v_previous from public.officer_profiles p where id=p_id;
 insert into public.teacher_access_grants(auth_user_id,admin_added,officer_previous)
   values(p_id,not exists(select 1 from public.admins where auth_user_id=p_id),v_previous)
   on conflict(auth_user_id) do nothing;
 insert into public.super_admins(auth_user_id,explicit_grant,teacher_grant) values(p_id,false,true)
   on conflict(auth_user_id) do update set teacher_grant=true;
 insert into public.admins(auth_user_id,name) values(p_id,p_name) on conflict(auth_user_id) do nothing;
 -- Preserve an existing independent President/officer assignment. New teacher
 -- memberships use advisor permissions and do not count as student officers.
 insert into public.officer_profiles(id,name,role,position,reviewer_kind,access_enabled,teacher_managed)
   values(p_id,p_name,'admin','Academy Advisor','advisor',true,true)
   on conflict(id) do update set name=case when public.officer_profiles.teacher_managed then excluded.name else public.officer_profiles.name end,
     teacher_managed=public.officer_profiles.teacher_managed or not public.officer_profiles.access_enabled,
     access_enabled=true;
end $$;

create or replace function public.revoke_teacher_access(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_grant public.teacher_access_grants; begin
 select * into v_grant from public.teacher_access_grants where auth_user_id=p_id for update;
 if not found then return; end if;
 update public.super_admins set teacher_grant=false where auth_user_id=p_id;
 delete from public.super_admins where auth_user_id=p_id and not explicit_grant;
 if v_grant.admin_added and not exists(select 1 from public.super_admins where auth_user_id=p_id and explicit_grant) then
   delete from public.admins where auth_user_id=p_id;
 end if;
 if exists(select 1 from public.officer_profiles where id=p_id and teacher_managed)
   and not exists(select 1 from public.super_admins where auth_user_id=p_id and explicit_grant) then
   -- Preserve task, service, strike, and evaluation history without retaining
   -- the automatically granted portal membership after teacher removal.
   if v_grant.officer_previous is null then
     update public.officer_profiles set access_enabled=false where id=p_id;
   else
     update public.officer_profiles set role=v_grant.officer_previous->>'role',
       reviewer_kind=v_grant.officer_previous->>'reviewer_kind',
       access_enabled=coalesce((v_grant.officer_previous->>'access_enabled')::boolean,true),
       teacher_managed=coalesce((v_grant.officer_previous->>'teacher_managed')::boolean,false)
       where id=p_id;
   end if;
 end if;
 delete from public.teacher_access_grants where auth_user_id=p_id;
end $$;

create or replace function public.sync_teacher_access()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='DELETE' then perform public.revoke_teacher_access(old.auth_user_id); return old; end if;
 if tg_op='UPDATE' and old.auth_user_id<>new.auth_user_id then
   raise exception 'Teacher accounts must keep their existing Auth user ID.';
 end if;
 perform public.provision_teacher_access(new.auth_user_id,new.full_name);
 return new;
end $$;
drop trigger if exists teacher_super_admin_access on public.teacher_profiles;
create trigger teacher_super_admin_access after insert or update or delete on public.teacher_profiles
 for each row execute function public.sync_teacher_access();
do $$ declare t record; begin
 for t in select auth_user_id,full_name from public.teacher_profiles loop
   perform public.provision_teacher_access(t.auth_user_id,t.full_name);
 end loop;
end $$;

-- Every existing portal RPC is guarded at the database write boundary as well
-- as by RLS. Disabled, former teacher memberships cannot mutate historical data.
create or replace function public.guard_officer_membership()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is not null and not public.has_officer_access() and not public.is_super_admin() then
   raise exception 'Active officer access is required.';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['tasks','peet_evaluations','officer_events','officer_attendance','officer_event_signups','officer_volunteer_logs','officer_strikes','officer_removal_reviews','officer_accountability_notes','officer_profiles'] loop
   execute format('drop trigger if exists officer_membership_guard on public.%I',t);
   execute format('create trigger officer_membership_guard before insert or update or delete on public.%I for each row execute function public.guard_officer_membership()',t);
 end loop;
end $$;
revoke all on function public.provision_teacher_access(uuid,text),public.revoke_teacher_access(uuid),
 public.sync_teacher_access(),public.guard_officer_membership() from public,anon,authenticated;
revoke all on function public.has_officer_access() from public,anon,authenticated;
grant execute on function public.has_officer_access() to authenticated,service_role;

create or replace function public.superadmin_save_account(
  p_actor uuid,p_target uuid,p_kind text,p_name text,p_email text,
  p_username text default null,p_class_year integer default null,p_student_id text default null,
  p_portal_role text default 'officer',p_reviewer_kind text default null,p_position text default ''
) returns void language plpgsql security definer set search_path='' as $$
declare v_before jsonb; v_after jsonb; v_student_id text; begin
  perform 1 from public.super_admins where auth_user_id=p_actor and (explicit_grant or (teacher_grant and exists(select 1 from public.teacher_profiles where auth_user_id=p_actor))) for share;
  if not found then raise exception 'Super-admin access is required.'; end if;
  if p_kind is null or p_kind not in ('student','teacher','officer') or p_name is null or length(btrim(p_name)) not between 1 and 160
    or p_email is null or p_email !~* '^[^[:space:]@]+@lvjusd\.org$' then raise exception 'Enter a name and a valid @lvjusd.org email.'; end if;
  perform 1 from auth.users where id=p_target and lower(email)=lower(p_email) for share;
  if not found then raise exception 'The Auth account and profile email must match.'; end if;
  if p_kind='student' then
    if p_username is null or length(btrim(p_username)) not between 1 and 80 or p_class_year is null or p_class_year not between 2020 and 2100 then raise exception 'Enter a username and valid graduating class year.'; end if;
    select to_jsonb(s)-'student_id_number',student_id_number into v_before,v_student_id from public.student_profiles s where auth_user_id=p_target for update;
    v_student_id:=coalesce(nullif(btrim(p_student_id),''),v_student_id);
    if v_student_id is null or length(v_student_id) not between 1 and 64 then raise exception 'A student ID is required for a new student profile.'; end if;
    if exists(select 1 from public.student_email_blocks where school_email=lower(p_email) and is_active) then raise exception 'Unblock this student email in website administration before adding the account.'; end if;
    insert into public.student_profiles(auth_user_id,auth_email,full_name,display_username,graduating_class_year,student_id_number,school_email)
      values(p_target,lower(p_email),btrim(p_name),btrim(p_username),p_class_year,v_student_id,lower(p_email))
      on conflict(auth_user_id) do update set auth_email=excluded.auth_email,full_name=excluded.full_name,
        display_username=excluded.display_username,graduating_class_year=excluded.graduating_class_year,
        student_id_number=excluded.student_id_number,school_email=excluded.school_email;
    select to_jsonb(s)-'student_id_number' into v_after from public.student_profiles s where auth_user_id=p_target;
  elsif p_kind='teacher' then
    select to_jsonb(t) into v_before from public.teacher_profiles t where auth_user_id=p_target for update;
    insert into public.teacher_profiles(auth_user_id,auth_email,full_name,school_email) values(p_target,lower(p_email),btrim(p_name),lower(p_email))
      on conflict(auth_user_id) do update set auth_email=excluded.auth_email,full_name=excluded.full_name,school_email=excluded.school_email;
    select to_jsonb(t) into v_after from public.teacher_profiles t where auth_user_id=p_target;
  else
    if p_portal_role is null or p_portal_role not in ('officer','admin') or p_position is null or length(p_position)>160
      or (p_portal_role='admin' and (p_reviewer_kind is null or p_reviewer_kind not in ('president','advisor')))
      or (p_portal_role='officer' and p_reviewer_kind is not null) then raise exception 'Choose an officer or designated reviewer role.'; end if;
    if exists(select 1 from public.super_admins where auth_user_id=p_target and explicit_grant) and (p_portal_role<>'admin' or p_reviewer_kind<>'president') then raise exception 'Super-admin portal membership cannot be downgraded here.'; end if;
    select to_jsonb(p) into v_before from public.officer_profiles p where id=p_target for update;
    insert into public.officer_profiles(id,name,role,position,reviewer_kind) values(p_target,btrim(p_name),p_portal_role,p_position,p_reviewer_kind)
      on conflict(id) do update set name=excluded.name,role=excluded.role,position=excluded.position,reviewer_kind=excluded.reviewer_kind,access_enabled=true,teacher_managed=false;
    select to_jsonb(p) into v_after from public.officer_profiles p where id=p_target;
  end if;
  -- Keep login email references consistent when an existing Auth email is edited.
  update public.student_profiles set auth_email=lower(p_email),school_email=lower(p_email) where auth_user_id=p_target;
  update public.teacher_profiles set auth_email=lower(p_email),school_email=lower(p_email) where auth_user_id=p_target;
  insert into public.account_management_audit(actor_id,target_id,account_kind,action,before_record,after_record)
    values(p_actor,p_target,p_kind,case when v_before is null then 'add' else 'edit' end,v_before,v_after);
end $$;

create or replace function public.superadmin_remove_account(p_actor uuid,p_target uuid,p_kind text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$ declare v_before jsonb; begin
  perform 1 from public.super_admins where auth_user_id=p_actor and (explicit_grant or (teacher_grant and exists(select 1 from public.teacher_profiles where auth_user_id=p_actor))) for share;
  if not found then raise exception 'Super-admin access is required.'; end if;
  if p_actor=p_target then raise exception 'You cannot remove your own account access here.'; end if;
  if p_kind is null or p_kind not in ('student','teacher') or p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then raise exception 'Choose student or teacher access and provide a removal reason.'; end if;
  if p_kind='student' then
    select to_jsonb(s)-'student_id_number' into v_before from public.student_profiles s where auth_user_id=p_target for update;
    if v_before is null then raise exception 'Student profile not available.'; end if;
    delete from public.upperclassmen where auth_user_id=p_target;
    delete from public.student_profiles where auth_user_id=p_target;
  else
    select to_jsonb(t) into v_before from public.teacher_profiles t where auth_user_id=p_target for update;
    if v_before is null then raise exception 'Teacher profile not available.'; end if;
    -- Revoke outstanding invites so a removed teacher cannot reuse an old link.
    delete from public.teacher_invites where lower(teacher_email)=lower(v_before->>'school_email');
    delete from public.teacher_profiles where auth_user_id=p_target;
  end if;
  insert into public.account_management_audit(actor_id,target_id,account_kind,action,before_record,after_record)
    values(p_actor,p_target,p_kind,'remove',v_before,jsonb_build_object('reason',p_reason));
end $$;

commit;

-- Officer task followthrough and batch assignment
-- Run after teacher-super-admin.sql. Keep task history and require followthrough.
begin;
alter table public.tasks add column if not exists cancelled_at timestamptz;
alter table public.tasks add column if not exists cancelled_by uuid references public.officer_profiles(id);
alter table public.tasks add column if not exists cancellation_reason text;
alter table public.tasks add column if not exists assignment_batch_id uuid;
create table if not exists public.officer_task_cancellation_requests (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id),
 requested_by uuid not null references public.officer_profiles(id),
 reason text not null check(length(btrim(reason)) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 review_notes text not null default '' check(length(review_notes)<=2000),
 reviewed_by uuid references public.officer_profiles(id),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz
);
create unique index if not exists officer_task_cancellation_pending on public.officer_task_cancellation_requests(task_id) where status='pending';
alter table public.officer_task_cancellation_requests enable row level security;
drop policy if exists cancellation_requests_read on public.officer_task_cancellation_requests;
create policy cancellation_requests_read on public.officer_task_cancellation_requests for select to authenticated
 using(public.is_peet_admin() or (requested_by=auth.uid() and public.has_officer_access()));
revoke all on public.officer_task_cancellation_requests from public,anon,authenticated;
grant select on public.officer_task_cancellation_requests to authenticated;
grant all on public.officer_task_cancellation_requests to service_role;

create or replace function public.is_task_officer(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.officer_profiles p where p.id=p_id and p.access_enabled and p.reviewer_kind is distinct from 'advisor')
 and not exists(select 1 from public.teacher_profiles where auth_user_id=p_id);
$$;
create or replace function public.officer_directory()
returns table(id uuid,name text,role text,"position" text,reviewer_kind text,peet_onboarding_seen_at timestamptz,access_enabled boolean,is_teacher boolean,email text)
language sql stable security definer set search_path='' as $$
 select p.id,p.name,p.role,p.position,p.reviewer_kind,p.peet_onboarding_seen_at,p.access_enabled,
   exists(select 1 from public.teacher_profiles t where t.auth_user_id=p.id),u.email::text
 from public.officer_profiles p join auth.users u on u.id=p.id
 where p.access_enabled and (public.is_peet_admin() or (p.id=auth.uid() and public.has_officer_access()));
$$;

-- Enforce assignee eligibility for every caller, including older clients and RPCs.
create or replace function public.guard_task_followthrough()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='DELETE' then raise exception 'Task deletion is disabled. Request cancellation so the task history is preserved.'; end if;
 if tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to then
   if not public.is_task_officer(new.assigned_to) then raise exception 'Assign tasks to active officers. Teachers and advisors cannot be assigned officer tasks.'; end if;
 end if;
 if tg_op='UPDATE' and old.cancelled_at is not null then raise exception 'Cancelled tasks are preserved and cannot be changed.'; end if;
 return new;
end $$;
drop trigger if exists task_followthrough_guard on public.tasks;
create trigger task_followthrough_guard before insert or update or delete on public.tasks for each row execute function public.guard_task_followthrough();
create or replace function public.delete_officer_task(p_task_id uuid)
returns void language plpgsql security definer set search_path='' as $$ begin
 raise exception 'Task deletion is disabled. Submit a cancellation request for independent review.';
end $$;

create or replace function public.assign_officer_tasks(p_assignees uuid[],p_title text,p_description text default '',p_due_date date default null)
returns uuid[] language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_ids uuid[]:='{}'; v_batch uuid:=gen_random_uuid(); v_person uuid; begin
 if not public.has_officer_access() then raise exception 'Officer access is required.'; end if;
 if p_assignees is null or cardinality(p_assignees) not between 1 and 100
   or exists(select 1 from unnest(p_assignees) i where i is null or not public.is_task_officer(i)) then raise exception 'Choose between 1 and 100 active officers. Teachers cannot receive these tasks.'; end if;
 if not public.is_peet_admin() and (cardinality(p_assignees)<>1 or p_assignees[1]<>auth.uid()) then raise exception 'Officers can only create their own tasks.'; end if;
 for v_person in select distinct i from unnest(p_assignees) i loop
   v_id:=public.save_officer_task(p_title,p_description,p_due_date,v_person);
   update public.tasks set assignment_batch_id=v_batch where id=v_id;
   v_ids:=array_append(v_ids,v_id);
 end loop;
 return v_ids;
end $$;

create or replace function public.request_officer_task_cancellation(p_task_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$ declare v_task public.tasks; begin
 if not public.has_officer_access() then raise exception 'Active officer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or v_task.assigned_to<>auth.uid() then raise exception 'You can only request cancellation of your own tasks.'; end if;
 if v_task.cancelled_at is not null or v_task.status='completed' then raise exception 'This task is already closed.'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then raise exception 'Explain why cancellation is needed in 10–2,000 characters.'; end if;
 if exists(select 1 from public.officer_task_cancellation_requests where task_id=p_task_id and status='pending') then raise exception 'A cancellation request is already awaiting review.'; end if;
 insert into public.officer_task_cancellation_requests(task_id,requested_by,reason) values(p_task_id,auth.uid(),btrim(p_reason));
end $$;

create or replace function public.review_officer_task_cancellation(p_request_id uuid,p_status text,p_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare v_request public.officer_task_cancellation_requests; v_task public.tasks; v_task_id uuid; begin
 if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 select task_id into v_task_id from public.officer_task_cancellation_requests where id=p_request_id;
 select * into v_task from public.tasks where id=v_task_id for update;
 if not found then raise exception 'Task not available.'; end if;
 select * into v_request from public.officer_task_cancellation_requests where id=p_request_id for update;
 if not found or v_request.status<>'pending' then raise exception 'This request has already been reviewed.'; end if;
 if v_request.requested_by=auth.uid() or v_task.assigned_to=auth.uid() then raise exception 'Someone else must review cancellation of your task.'; end if;
 if p_status is null or p_status not in ('approved','rejected') or p_notes is null or length(btrim(p_notes)) not between 10 and 2000 then raise exception 'Choose a decision and document the reasoning.'; end if;
 if p_status='approved' and (v_task.cancelled_at is not null or v_task.status='completed') then raise exception 'The task is already closed; reject this outdated request instead.'; end if;
 if p_status='approved' then
   update public.tasks set cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=p_notes where id=v_task.id;
 end if;
 update public.officer_task_cancellation_requests set status=p_status,review_notes=p_notes,reviewed_by=auth.uid(),reviewed_at=now() where id=p_request_id;
end $$;

create or replace function public.cancel_officer_task(p_task_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$ declare v_task public.tasks; begin
 if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or v_task.cancelled_at is not null then raise exception 'Task not available.'; end if;
 if v_task.assigned_to=auth.uid() then raise exception 'Submit a cancellation request. Someone else must review your own task.'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then raise exception 'Document why this task is being cancelled in 10–2,000 characters.'; end if;
 update public.tasks set cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=btrim(p_reason) where id=p_task_id;
 update public.officer_task_cancellation_requests set status='approved',review_notes=btrim(p_reason),reviewed_by=auth.uid(),reviewed_at=now() where task_id=p_task_id and status='pending';
end $$;

create or replace function public.guard_cancelled_evaluation()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 perform 1 from public.tasks where id=new.task_id and cancelled_at is null for update;
 if not found then raise exception 'Cancelled tasks cannot be evaluated.'; end if;
 return new;
end $$;
drop trigger if exists cancelled_evaluation_guard on public.peet_evaluations;
create trigger cancelled_evaluation_guard before insert or update on public.peet_evaluations for each row execute function public.guard_cancelled_evaluation();

-- Preserve audit records for cancellation requests as well as task changes.
create or replace function public.audit_task_followthrough()
returns trigger language plpgsql security definer set search_path='' as $$ declare v_old jsonb; v_new jsonb; v_owner uuid; begin
 if tg_op<>'INSERT' then v_old:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then v_new:=to_jsonb(new); end if;
 v_owner:=coalesce(v_new->>'assigned_to',v_old->>'assigned_to',v_new->>'requested_by',v_old->>'requested_by')::uuid;
 insert into public.officer_tracking_audit(officer_id,table_name,record_id,actor_id,action,before_record,after_record)
 values(v_owner,tg_table_name,coalesce(v_new->>'id',v_old->>'id')::uuid,auth.uid(),tg_op,v_old,v_new);
 if tg_op='DELETE' then return old; end if; return new;
end $$;
drop trigger if exists task_followthrough_audit on public.tasks;
create trigger task_followthrough_audit after insert or update on public.tasks for each row execute function public.audit_task_followthrough();
drop trigger if exists task_followthrough_audit on public.officer_task_cancellation_requests;
create trigger task_followthrough_audit after insert or update on public.officer_task_cancellation_requests for each row execute function public.audit_task_followthrough();

revoke all on function public.is_task_officer(uuid),public.officer_directory(),public.assign_officer_tasks(uuid[],text,text,date),
 public.request_officer_task_cancellation(uuid,text),public.review_officer_task_cancellation(uuid,text,text),public.cancel_officer_task(uuid,text),
 public.guard_task_followthrough(),public.guard_cancelled_evaluation(),public.audit_task_followthrough() from public,anon,authenticated;
grant execute on function public.officer_directory(),public.assign_officer_tasks(uuid[],text,text,date),
 public.request_officer_task_cancellation(uuid,text),public.review_officer_task_cancellation(uuid,text,text),public.cancel_officer_task(uuid,text) to authenticated;
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
      'peet_score',(select avg((e.efficiency+e.effectiveness+e.time)/3)/4*100 from public.peet_evaluations e join public.tasks t on t.id=e.task_id where t.assigned_to=v_strike.officer_id and t.status='completed' and t.cancelled_at is null)) into v_context;
    insert into public.officer_removal_reviews(officer_id,academic_year,category,context_snapshot)
      values(v_strike.officer_id,v_strike.academic_year,v_strike.category,v_context) on conflict(officer_id,academic_year,category)
      do update set status='pending',context_snapshot=excluded.context_snapshot,advisor_notes='',decided_by=null,decided_at=null;
  end if;
end $$;


commit;

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


-- Run after officer-task-followthrough.sql. Enforce task ownership and fixed deadline limits.
begin;
alter table public.tasks add column if not exists original_due_date date;
-- Capture the current deadline once for existing records, including an original NULL.
-- The trigger's presence distinguishes a first installation from a reapplication.
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.tasks'::regclass and tgname='task_editing_guard' and not tgisinternal) then
  update public.tasks set original_due_date=due_date where cancelled_at is null;
 end if;
end $$;

create or replace function public.guard_officer_task_editing()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); begin
 if tg_op='INSERT' then new.original_due_date:=new.due_date; return new; end if;
 if new.original_due_date is distinct from old.original_due_date or new.created_by is distinct from old.created_by then
  raise exception 'The original deadline and task creator cannot be changed.';
 end if;
 if new.title is distinct from old.title or new.description is distinct from old.description
  or new.due_date is distinct from old.due_date or new.assigned_to is distinct from old.assigned_to then
  if v_actor is null or not public.has_officer_access() or old.created_by<>v_actor then
   raise exception 'Only the person who assigned this task can edit it.';
  end if;
  if old.status='completed' or (old.created_by=old.assigned_to and old.status<>'in_progress') then
   raise exception 'This task can no longer be edited.';
  end if;
  if old.created_by=old.assigned_to then
   if new.title is distinct from old.title or new.assigned_to is distinct from old.assigned_to then
    raise exception 'For self-created tasks, only the description and deadline can be edited.';
   end if;
   if new.due_date is distinct from old.due_date and
    (old.original_due_date is null or new.due_date is null or abs(new.due_date-old.original_due_date)>3) then
    raise exception 'The deadline must stay within three days of its original date and cannot be added or removed.';
   end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists task_editing_guard on public.tasks;
create trigger task_editing_guard before insert or update on public.tasks for each row execute function public.guard_officer_task_editing();

create or replace function public.save_officer_task(
 p_title text,p_description text default '',p_due_date date default null,
 p_assigned_to uuid default null,p_task_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_assignee uuid; v_task public.tasks; v_id uuid; begin
 if not public.has_officer_access() then raise exception 'Officer access is required.'; end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 200 or p_description is null or length(p_description)>10000 then
  raise exception 'Enter a title of 1–200 characters and a description of at most 10,000 characters.';
 end if;
 if p_task_id is null then
  v_assignee:=coalesce(p_assigned_to,v_actor);
 else
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found or v_task.created_by<>v_actor then raise exception 'Only the person who assigned this task can edit it.'; end if;
  if v_task.cancelled_at is not null or v_task.status='completed' or (v_task.created_by=v_task.assigned_to and v_task.status<>'in_progress') then
   raise exception 'This task can no longer be edited.';
  end if;
  v_assignee:=coalesce(p_assigned_to,v_task.assigned_to);
 end if;
 if not public.is_task_officer(v_assignee) or (not public.is_peet_admin() and v_assignee<>v_actor) then
  raise exception 'Choose an active officer. Officers can only assign tasks to themselves.';
 end if;
 if p_task_id is null then
  insert into public.tasks(title,description,due_date,assigned_to,created_by)
   values(btrim(p_title),p_description,p_due_date,v_assignee,v_actor) returning id into v_id;
  return v_id;
 end if;
 update public.tasks set title=btrim(p_title),description=p_description,due_date=p_due_date,assigned_to=v_assignee where id=p_task_id;
 return p_task_id;
end $$;
revoke all on function public.guard_officer_task_editing(),public.save_officer_task(text,text,date,uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_officer_task(text,text,date,uuid,uuid) to authenticated;
commit;


-- Run after officer-task-editing.sql. Accept written work, a link, or both.
begin;
alter table public.tasks add column if not exists submission_description text not null default ''
 check(length(submission_description)<=10000);
-- Replace the original link-required submission constraint, preserving other checks.
do $$ declare v_constraint record; begin
 for v_constraint in select conname from pg_constraint
  where conrelid='public.tasks'::regclass and contype='c'
   and pg_get_constraintdef(oid) like '%final_product_url%'
   and pg_get_constraintdef(oid) like '%submitted_at%'
 loop
  execute format('alter table public.tasks drop constraint %I',v_constraint.conname);
 end loop;
end $$;
alter table public.tasks add constraint tasks_submission_evidence_check check(
 status='in_progress' or (submitted_at is not null and
 (final_product_url is not null or length(btrim(submission_description,E' \t\n\r'))>0))
);
create or replace function public.submit_officer_task(p_task_id uuid,p_url text,p_description text)
returns void language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; v_url text:=nullif(btrim(p_url),'');
 v_description text:=btrim(coalesce(p_description,''),E' \t\n\r'); begin
 if not public.has_officer_access() then raise exception 'Officer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or (v_task.assigned_to<>auth.uid() and not public.is_peet_admin()) then
  raise exception 'Task not available.';
 end if;
 if v_task.cancelled_at is not null or v_task.status<>'in_progress' then
  raise exception 'This task can no longer be submitted.';
 end if;
 if length(v_description)>10000 then raise exception 'Keep the work description within 10,000 characters.'; end if;
 if v_url is not null and (length(v_url)>2048 or v_url !~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$') then
  raise exception 'Enter a valid HTTP or HTTPS link, or leave the link blank.';
 end if;
 if v_url is null and v_description='' then raise exception 'Describe the completed work or add a link.'; end if;
 update public.tasks set final_product_url=v_url,submission_description=v_description,
  status='submitted',submitted_at=now() where id=p_task_id;
end $$;
-- Keep existing link-only clients compatible without ambiguous default arguments.
create or replace function public.submit_officer_task(p_task_id uuid,p_url text)
returns void language sql security definer set search_path='' as $$
 select public.submit_officer_task(p_task_id,p_url,'');
$$;
revoke all on function public.submit_officer_task(uuid,text,text),public.submit_officer_task(uuid,text) from public,anon,authenticated;
grant execute on function public.submit_officer_task(uuid,text,text),public.submit_officer_task(uuid,text) to authenticated;
commit;

-- Run after officer-task-submissions.sql. Existing overdue deadlines remain historical.
begin;
create or replace function public.guard_officer_task_due_date()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.due_date is not distinct from old.due_date then return new; end if;
 end if;
 if new.due_date < (statement_timestamp() at time zone 'America/Los_Angeles')::date then
  raise exception 'Choose today or a future date for the due date (Pacific time).';
 end if;
 return new;
end $$;
drop trigger if exists task_due_date_guard on public.tasks;
create trigger task_due_date_guard before insert or update on public.tasks
 for each row execute function public.guard_officer_task_due_date();
revoke all on function public.guard_officer_task_due_date() from public,anon,authenticated;
commit;

-- Run after officer-task-due-dates.sql. Reviewer management of other officers.
begin;
create or replace function public.guard_officer_task_editing()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); begin
 if tg_op='INSERT' then new.original_due_date:=new.due_date; return new; end if;
 if new.original_due_date is distinct from old.original_due_date or new.created_by is distinct from old.created_by then
  raise exception 'The original deadline and task creator cannot be changed.';
 end if;
 if new.title is distinct from old.title or new.description is distinct from old.description
  or new.due_date is distinct from old.due_date or new.assigned_to is distinct from old.assigned_to then
  if v_actor is null or not public.has_officer_access() or (old.created_by<>v_actor and not (public.is_peet_admin() and old.assigned_to<>v_actor)) then
   raise exception 'Only the assigner or a reviewer can edit this task.';
  end if;
  if old.status='completed' or (old.created_by=old.assigned_to and old.status<>'in_progress' and not (public.is_peet_admin() and old.assigned_to<>v_actor)) then
   raise exception 'This task can no longer be edited.';
  end if;
  if old.created_by=old.assigned_to and not (public.is_peet_admin() and old.assigned_to<>v_actor) then
   if new.title is distinct from old.title or new.assigned_to is distinct from old.assigned_to then
    raise exception 'For self-created tasks, only the description and deadline can be edited.';
   end if;
   if new.due_date is distinct from old.due_date and
    (old.original_due_date is null or new.due_date is null or abs(new.due_date-old.original_due_date)>3) then
    raise exception 'The deadline must stay within three days of its original date and cannot be added or removed.';
   end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists task_editing_guard on public.tasks;
create trigger task_editing_guard before insert or update on public.tasks for each row execute function public.guard_officer_task_editing();

create or replace function public.save_officer_task(
 p_title text,p_description text default '',p_due_date date default null,
 p_assigned_to uuid default null,p_task_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_assignee uuid; v_task public.tasks; v_id uuid; begin
 if not public.has_officer_access() then raise exception 'Officer access is required.'; end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 200 or p_description is null or length(p_description)>10000 then
  raise exception 'Enter a title of 1–200 characters and a description of at most 10,000 characters.';
 end if;
 if p_task_id is null then
  v_assignee:=coalesce(p_assigned_to,v_actor);
 else
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found or (v_task.created_by<>v_actor and not (public.is_peet_admin() and v_task.assigned_to<>v_actor)) then raise exception 'Only the assigner or a reviewer can edit this task.'; end if;
  if v_task.cancelled_at is not null or v_task.status='completed' or (v_task.created_by=v_task.assigned_to and v_task.status<>'in_progress' and not (public.is_peet_admin() and v_task.assigned_to<>v_actor)) then
   raise exception 'This task can no longer be edited.';
  end if;
  v_assignee:=coalesce(p_assigned_to,v_task.assigned_to);
 end if;
 if not public.is_task_officer(v_assignee) or (not public.is_peet_admin() and v_assignee<>v_actor) then
  raise exception 'Choose an active officer. Officers can only assign tasks to themselves.';
 end if;
 if p_task_id is null then
  insert into public.tasks(title,description,due_date,assigned_to,created_by)
   values(btrim(p_title),p_description,p_due_date,v_assignee,v_actor) returning id into v_id;
  return v_id;
 end if;
 update public.tasks set title=btrim(p_title),description=p_description,due_date=p_due_date,assigned_to=v_assignee where id=p_task_id;
 return p_task_id;
end $$;
revoke all on function public.guard_officer_task_editing(),public.save_officer_task(text,text,date,uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_officer_task(text,text,date,uuid,uuid) to authenticated;

alter table public.tasks add column if not exists ended_by uuid references public.officer_profiles(id);
alter table public.tasks add column if not exists end_notes text;
alter table public.tasks drop constraint if exists tasks_submission_evidence_check;
alter table public.tasks add constraint tasks_submission_evidence_check check(
 status='in_progress' or
 (status='completed' and ended_by is not null) or
 (submitted_at is not null and (final_product_url is not null or length(btrim(submission_description,E' \t\n\r'))>0))
);
alter table public.tasks drop constraint if exists tasks_reviewer_end_check;
alter table public.tasks add constraint tasks_reviewer_end_check check(
 (ended_by is null and end_notes is null) or
 (ended_by is not null and status='completed' and end_notes is not null and length(btrim(end_notes)) between 10 and 2000)
);

create or replace function public.guard_officer_task_end()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='INSERT' then
  if new.ended_by is not null or new.end_notes is not null then raise exception 'New tasks cannot already be ended.'; end if;
 elsif new.ended_by is distinct from old.ended_by or new.end_notes is distinct from old.end_notes then
  if old.ended_by is not null or old.status='completed' or old.cancelled_at is not null then
   raise exception 'This task is already closed.';
  end if;
  if not public.has_officer_access() or not public.is_peet_admin() or auth.uid() is null or old.assigned_to=auth.uid()
   or new.assigned_to is distinct from old.assigned_to or new.ended_by is distinct from auth.uid() or new.status<>'completed' then
   raise exception 'A different reviewer must end this task.';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists task_end_guard on public.tasks;
create trigger task_end_guard before insert or update on public.tasks for each row execute function public.guard_officer_task_end();

create or replace function public.end_officer_task(p_task_id uuid,p_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; begin
 if not public.has_officer_access() or not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or v_task.cancelled_at is not null or v_task.status='completed' then raise exception 'This task is already closed or unavailable.'; end if;
 if v_task.assigned_to=auth.uid() then raise exception 'A different reviewer must end your task.'; end if;
 if p_notes is null or length(btrim(p_notes)) not between 10 and 2000 then raise exception 'Explain why this task is being ended in 10–2,000 characters.'; end if;
 update public.tasks set status='completed',completed_at=now(),ended_by=auth.uid(),end_notes=btrim(p_notes) where id=p_task_id;
 update public.officer_task_cancellation_requests set status='rejected',review_notes=btrim(p_notes),
  reviewed_by=auth.uid(),reviewed_at=now() where task_id=p_task_id and status='pending';
end $$;
revoke all on function public.guard_officer_task_end(),public.end_officer_task(uuid,text) from public,anon,authenticated;
grant execute on function public.end_officer_task(uuid,text) to authenticated;
commit;

-- Run after officer-task-reviewer-management.sql.
begin;
-- Both operations run in one transaction: invalid scores or reviewer permissions
-- roll back the completion, audit entries, and cancellation-request resolution.
create or replace function public.end_officer_task_with_evaluation(
 p_task_id uuid,p_notes text,p_efficiency numeric,p_effectiveness numeric,p_time numeric
) returns void language plpgsql security definer set search_path='' as $$ begin
 perform public.end_officer_task(p_task_id,p_notes);
 perform public.evaluate_officer_task(p_task_id,p_efficiency,p_effectiveness,p_time,p_notes);
end $$;
revoke all on function public.end_officer_task_with_evaluation(uuid,text,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.end_officer_task_with_evaluation(uuid,text,numeric,numeric,numeric) to authenticated;
commit;

-- Run after officer-task-scored-ending.sql. One task, submission and evaluation per team.
begin;
create table if not exists public.officer_task_members (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id),
 officer_id uuid not null references public.officer_profiles(id),
 added_at timestamptz not null default now(),
 unique(task_id,officer_id)
);
create index if not exists officer_task_members_officer on public.officer_task_members(officer_id,task_id);
alter table public.officer_task_members enable row level security;
revoke all on public.officer_task_members from public,anon,authenticated;
grant select on public.officer_task_members to authenticated;
grant all on public.officer_task_members to service_role;

create or replace function public.is_officer_task_participant(p_task_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tasks t where t.id=p_task_id and
  (t.assigned_to=auth.uid() or exists(select 1 from public.officer_task_members m where m.task_id=t.id and m.officer_id=auth.uid())));
$$;
create or replace function public.can_read_officer_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.has_officer_access() and (public.is_peet_admin() or public.is_officer_task_participant(p_task_id));
$$;
drop policy if exists officer_tasks_read on public.tasks;
create policy officer_tasks_read on public.tasks for select to authenticated using(public.can_read_officer_task(id));
drop policy if exists officer_evaluations_read on public.peet_evaluations;
create policy officer_evaluations_read on public.peet_evaluations for select to authenticated using(public.can_read_officer_task(task_id));
drop policy if exists task_members_read on public.officer_task_members;
create policy task_members_read on public.officer_task_members for select to authenticated using(public.can_read_officer_task(task_id));
drop policy if exists cancellation_requests_read on public.officer_task_cancellation_requests;
create policy cancellation_requests_read on public.officer_task_cancellation_requests for select to authenticated using(public.can_read_officer_task(task_id));

-- A minimal picker directory; other officers' email addresses and records stay private.
create or replace function public.officer_task_teammates()
returns table(id uuid,name text,"position" text) language sql stable security definer set search_path='' as $$
 select p.id,p.name,p.position from public.officer_profiles p
 where public.has_officer_access() and public.is_task_officer(p.id);
$$;

create or replace function public.guard_officer_task_members()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; v_task_id uuid; begin
 if tg_op='UPDATE' then raise exception 'Remove and add a participant instead of changing membership identity.'; end if;
 if tg_op='DELETE' then v_task_id:=old.task_id; else v_task_id:=new.task_id; end if;
 select * into v_task from public.tasks where id=v_task_id for update;
 if not public.has_officer_access() or not found or v_task.created_by<>auth.uid() or v_task.assigned_to<>auth.uid()
  or v_task.status<>'in_progress' or v_task.cancelled_at is not null then
  raise exception 'Only the creator can change people on their own in-progress task.';
 end if;
 if tg_op='INSERT' then
  if new.officer_id=v_task.assigned_to or not public.is_task_officer(new.officer_id) then
   raise exception 'Choose another active officer. Teachers and advisors cannot join officer tasks.';
  end if;
  return new;
 end if;
 return old;
end $$;
drop trigger if exists task_members_guard on public.officer_task_members;
create trigger task_members_guard before insert or update or delete on public.officer_task_members for each row execute function public.guard_officer_task_members();
create or replace function public.audit_officer_task_members()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_old jsonb; v_new jsonb; begin
 if tg_op<>'INSERT' then v_old:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then v_new:=to_jsonb(new); end if;
 insert into public.officer_tracking_audit(officer_id,table_name,record_id,actor_id,action,before_record,after_record)
 values(coalesce(v_new->>'officer_id',v_old->>'officer_id')::uuid,tg_table_name,coalesce(v_new->>'id',v_old->>'id')::uuid,auth.uid(),tg_op,v_old,v_new);
 if tg_op='DELETE' then return old; end if; return new;
end $$;
drop trigger if exists task_members_audit on public.officer_task_members;
create trigger task_members_audit after insert or update or delete on public.officer_task_members for each row execute function public.audit_officer_task_members();

create or replace function public.save_officer_shared_task(
 p_title text,p_description text,p_due_date date,p_people uuid[],p_task_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; v_id uuid; begin
 if not public.has_officer_access() or not public.is_task_officer(auth.uid()) then raise exception 'Active officer access is required.'; end if;
 if p_people is null or cardinality(p_people) not between 1 and 100 or not (auth.uid()=any(p_people))
  or exists(select 1 from unnest(p_people) i where i is null or not public.is_task_officer(i)) then
  raise exception 'Keep yourself on the task and choose up to 99 other active officers.';
 end if;
 if p_task_id is not null then
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found or v_task.created_by<>auth.uid() or v_task.assigned_to<>auth.uid() or v_task.status<>'in_progress' or v_task.cancelled_at is not null then
   raise exception 'Only the creator can change people on their own in-progress task.';
  end if;
 end if;
 v_id:=public.save_officer_task(p_title,p_description,p_due_date,auth.uid(),p_task_id);
 delete from public.officer_task_members where task_id=v_id and not(officer_id=any(p_people));
 insert into public.officer_task_members(task_id,officer_id)
 select v_id,i from (select distinct i from unnest(p_people) i where i<>auth.uid()) people
 on conflict(task_id,officer_id) do nothing;
 return v_id;
end $$;

create or replace function public.guard_officer_task_editing()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); begin
 if tg_op='INSERT' then new.original_due_date:=new.due_date; return new; end if;
 if new.assigned_to is distinct from old.assigned_to and exists(select 1 from public.officer_task_members where task_id=old.id) then
  raise exception 'Shared tasks keep their creator as the primary officer.';
 end if;
 if new.original_due_date is distinct from old.original_due_date or new.created_by is distinct from old.created_by then
  raise exception 'The original deadline and task creator cannot be changed.';
 end if;
 if new.title is distinct from old.title or new.description is distinct from old.description
  or new.due_date is distinct from old.due_date or new.assigned_to is distinct from old.assigned_to then
  if v_actor is null or not public.has_officer_access() or (old.created_by<>v_actor and not (public.is_peet_admin() and not public.is_officer_task_participant(old.id))) then
   raise exception 'Only the assigner or a reviewer can edit this task.';
  end if;
  if old.status='completed' or (old.created_by=old.assigned_to and old.status<>'in_progress' and not (public.is_peet_admin() and not public.is_officer_task_participant(old.id))) then
   raise exception 'This task can no longer be edited.';
  end if;
  if old.created_by=old.assigned_to and not (public.is_peet_admin() and not public.is_officer_task_participant(old.id)) then
   if new.title is distinct from old.title or new.assigned_to is distinct from old.assigned_to then
    raise exception 'For self-created tasks, only the description and deadline can be edited.';
   end if;
   if new.due_date is distinct from old.due_date and
    (old.original_due_date is null or new.due_date is null or abs(new.due_date-old.original_due_date)>3) then
    raise exception 'The deadline must stay within three days of its original date and cannot be added or removed.';
   end if;
  end if;
 end if;
 return new;
end $$;

create or replace function public.save_officer_task(
 p_title text,p_description text default '',p_due_date date default null,
 p_assigned_to uuid default null,p_task_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_assignee uuid; v_task public.tasks; v_id uuid; begin
 if not public.has_officer_access() then raise exception 'Officer access is required.'; end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 200 or p_description is null or length(p_description)>10000 then
  raise exception 'Enter a title of 1–200 characters and a description of at most 10,000 characters.';
 end if;
 if p_task_id is null then
  v_assignee:=coalesce(p_assigned_to,v_actor);
 else
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found or (v_task.created_by<>v_actor and not (public.is_peet_admin() and not public.is_officer_task_participant(v_task.id))) then raise exception 'Only the assigner or a reviewer can edit this task.'; end if;
  if v_task.cancelled_at is not null or v_task.status='completed' or (v_task.created_by=v_task.assigned_to and v_task.status<>'in_progress' and not (public.is_peet_admin() and not public.is_officer_task_participant(v_task.id))) then
   raise exception 'This task can no longer be edited.';
  end if;
  v_assignee:=coalesce(p_assigned_to,v_task.assigned_to);
 end if;
 if not public.is_task_officer(v_assignee) or (not public.is_peet_admin() and v_assignee<>v_actor) then
  raise exception 'Choose an active officer. Officers can only assign tasks to themselves.';
 end if;
 if p_task_id is null then
  insert into public.tasks(title,description,due_date,assigned_to,created_by)
   values(btrim(p_title),p_description,p_due_date,v_assignee,v_actor) returning id into v_id;
  return v_id;
 end if;
 update public.tasks set title=btrim(p_title),description=p_description,due_date=p_due_date,assigned_to=v_assignee where id=p_task_id;
 return p_task_id;
end $$;

create or replace function public.submit_officer_task(p_task_id uuid,p_url text,p_description text)
returns void language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; v_url text:=nullif(btrim(p_url),'');
 v_description text:=btrim(coalesce(p_description,''),E' \t\n\r'); begin
 if not public.has_officer_access() then raise exception 'Officer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or (not public.is_officer_task_participant(v_task.id) and not public.is_peet_admin()) then
  raise exception 'Task not available.';
 end if;
 if v_task.cancelled_at is not null or v_task.status<>'in_progress' then
  raise exception 'This task can no longer be submitted.';
 end if;
 if length(v_description)>10000 then raise exception 'Keep the work description within 10,000 characters.'; end if;
 if v_url is not null and (length(v_url)>2048 or v_url !~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$') then
  raise exception 'Enter a valid HTTP or HTTPS link, or leave the link blank.';
 end if;
 if v_url is null and v_description='' then raise exception 'Describe the completed work or add a link.'; end if;
 update public.tasks set final_product_url=v_url,submission_description=v_description,
  status='submitted',submitted_at=now() where id=p_task_id;
end $$;

create or replace function public.request_officer_task_cancellation(p_task_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$ declare v_task public.tasks; begin
 if not public.has_officer_access() then raise exception 'Active officer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or not public.is_officer_task_participant(v_task.id) then raise exception 'You can only request cancellation of your own tasks.'; end if;
 if v_task.cancelled_at is not null or v_task.status='completed' then raise exception 'This task is already closed.'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then raise exception 'Explain why cancellation is needed in 10–2,000 characters.'; end if;
 if exists(select 1 from public.officer_task_cancellation_requests where task_id=p_task_id and status='pending') then raise exception 'A cancellation request is already awaiting review.'; end if;
 insert into public.officer_task_cancellation_requests(task_id,requested_by,reason) values(p_task_id,auth.uid(),btrim(p_reason));
end $$;

create or replace function public.review_officer_task_cancellation(p_request_id uuid,p_status text,p_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare v_request public.officer_task_cancellation_requests; v_task public.tasks; v_task_id uuid; begin
 if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 select task_id into v_task_id from public.officer_task_cancellation_requests where id=p_request_id;
 select * into v_task from public.tasks where id=v_task_id for update;
 if not found then raise exception 'Task not available.'; end if;
 select * into v_request from public.officer_task_cancellation_requests where id=p_request_id for update;
 if not found or v_request.status<>'pending' then raise exception 'This request has already been reviewed.'; end if;
 if v_request.requested_by=auth.uid() or public.is_officer_task_participant(v_task.id) then raise exception 'Someone else must review cancellation of your task.'; end if;
 if p_status is null or p_status not in ('approved','rejected') or p_notes is null or length(btrim(p_notes)) not between 10 and 2000 then raise exception 'Choose a decision and document the reasoning.'; end if;
 if p_status='approved' and (v_task.cancelled_at is not null or v_task.status='completed') then raise exception 'The task is already closed; reject this outdated request instead.'; end if;
 if p_status='approved' then
   update public.tasks set cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=p_notes where id=v_task.id;
 end if;
 update public.officer_task_cancellation_requests set status=p_status,review_notes=p_notes,reviewed_by=auth.uid(),reviewed_at=now() where id=p_request_id;
end $$;

create or replace function public.cancel_officer_task(p_task_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$ declare v_task public.tasks; begin
 if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or v_task.cancelled_at is not null then raise exception 'Task not available.'; end if;
 if public.is_officer_task_participant(v_task.id) then raise exception 'Submit a cancellation request. Someone else must review your own task.'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then raise exception 'Document why this task is being cancelled in 10–2,000 characters.'; end if;
 update public.tasks set cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=btrim(p_reason) where id=p_task_id;
 update public.officer_task_cancellation_requests set status='approved',review_notes=btrim(p_reason),reviewed_by=auth.uid(),reviewed_at=now() where task_id=p_task_id and status='pending';
end $$;

create or replace function public.guard_officer_task_end()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='INSERT' then
  if new.ended_by is not null or new.end_notes is not null then raise exception 'New tasks cannot already be ended.'; end if;
 elsif new.ended_by is distinct from old.ended_by or new.end_notes is distinct from old.end_notes then
  if old.ended_by is not null or old.status='completed' or old.cancelled_at is not null then
   raise exception 'This task is already closed.';
  end if;
  if not public.has_officer_access() or not public.is_peet_admin() or auth.uid() is null or public.is_officer_task_participant(old.id)
   or new.assigned_to is distinct from old.assigned_to or new.ended_by is distinct from auth.uid() or new.status<>'completed' then
   raise exception 'A different reviewer must end this task.';
  end if;
 end if;
 return new;
end $$;

create or replace function public.end_officer_task(p_task_id uuid,p_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; begin
 if not public.has_officer_access() or not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or v_task.cancelled_at is not null or v_task.status='completed' then raise exception 'This task is already closed or unavailable.'; end if;
 if public.is_officer_task_participant(v_task.id) then raise exception 'A different reviewer must end your task.'; end if;
 if p_notes is null or length(btrim(p_notes)) not between 10 and 2000 then raise exception 'Explain why this task is being ended in 10–2,000 characters.'; end if;
 update public.tasks set status='completed',completed_at=now(),ended_by=auth.uid(),end_notes=btrim(p_notes) where id=p_task_id;
 update public.officer_task_cancellation_requests set status='rejected',review_notes=btrim(p_notes),
  reviewed_by=auth.uid(),reviewed_at=now() where task_id=p_task_id and status='pending';
end $$;

create or replace function public.check_peet_reviewer()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from public.officer_task_members where task_id=new.task_id) and
  exists(select 1 from public.tasks t where t.id=new.task_id and
   (t.assigned_to=new.evaluated_by or exists(select 1 from public.officer_task_members m where m.task_id=t.id and m.officer_id=new.evaluated_by))) then
  raise exception 'A reviewer who is not on this shared task must evaluate it.';
 end if;
 if exists(select 1 from public.super_admins where auth_user_id=new.evaluated_by) then return new; end if;
 if exists(select 1 from public.officer_profiles p where p.reviewer_kind='president' and
  (exists(select 1 from public.tasks t where t.id=new.task_id and t.assigned_to=p.id) or
   exists(select 1 from public.officer_task_members m where m.task_id=new.task_id and m.officer_id=p.id))) and
  not exists(select 1 from public.officer_profiles where id=new.evaluated_by and role='admin' and reviewer_kind='advisor') then
  raise exception 'The President’s PEET performance must be evaluated by the Academy Advisor.';
 end if;
 return new;
end $$;
revoke all on function public.is_officer_task_participant(uuid),public.can_read_officer_task(uuid),public.officer_task_teammates(),
 public.guard_officer_task_members(),public.audit_officer_task_members(),public.save_officer_shared_task(text,text,date,uuid[],uuid),
 public.guard_officer_task_editing(),public.save_officer_task(text,text,date,uuid,uuid),public.submit_officer_task(uuid,text,text),
 public.request_officer_task_cancellation(uuid,text),public.review_officer_task_cancellation(uuid,text,text),public.cancel_officer_task(uuid,text),
 public.guard_officer_task_end(),public.end_officer_task(uuid,text),public.check_peet_reviewer() from public,anon,authenticated;
grant execute on function public.is_officer_task_participant(uuid),public.can_read_officer_task(uuid),public.officer_task_teammates(),
 public.save_officer_shared_task(text,text,date,uuid[],uuid),public.save_officer_task(text,text,date,uuid,uuid),public.submit_officer_task(uuid,text,text),
 public.request_officer_task_cancellation(uuid,text),public.review_officer_task_cancellation(uuid,text,text),public.cancel_officer_task(uuid,text),
 public.end_officer_task(uuid,text) to authenticated;
commit;


-- GEA One planning, secretary meetings, inbox, and reports.
-- Apply after officer-shared-tasks.sql. Additive; preserves existing officer permissions.
begin;
create or replace function public.can_manage_meetings()
returns boolean language sql stable security definer set search_path='' as $$
 select public.has_officer_access() and (public.is_peet_admin() or exists(
 select 1 from public.officer_profiles where id=auth.uid() and lower(btrim(position))='secretary' and access_enabled));
$$;
create or replace function public.has_gea_workspace()
returns boolean language sql stable security definer set search_path='' as $$
 select public.has_officer_access() or public.is_super_admin() or exists(select 1 from public.admins where auth_user_id=auth.uid())
 or exists(select 1 from public.teacher_profiles where auth_user_id=auth.uid());
$$;
create table if not exists public.gea_meeting_notes (
 id uuid primary key default gen_random_uuid(), event_id uuid not null unique references public.officer_events(id),
 minutes text not null default '' check(length(minutes)<=20000), decisions text not null default '' check(length(decisions)<=10000),
 version integer not null default 1, updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.gea_agenda_items (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.officer_events(id),
 author_id uuid not null references auth.users(id), title text not null check(length(btrim(title)) between 1 and 200),
 details text not null default '' check(length(details)<=5000), task_id uuid references public.tasks(id), created_at timestamptz not null default now()
);
create table if not exists public.gea_event_plans (
 id uuid primary key default gen_random_uuid(), event_id uuid not null unique references public.officer_events(id),
 organizer_id uuid references public.officer_profiles(id), staffing text not null default '' check(length(staffing)<=5000),
 supplies text not null default '' check(length(supplies)<=5000), recap text not null default '' check(length(recap)<=10000),
 version integer not null default 1, updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.gea_event_checklist (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.officer_events(id),
 title text not null check(length(btrim(title)) between 1 and 200), done boolean not null default false,
 created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.gea_task_blockers (
 id uuid primary key default gen_random_uuid(), task_id uuid not null unique references public.tasks(id),
 officer_id uuid not null references public.officer_profiles(id), helper_id uuid references public.officer_profiles(id),
 reason text not null check(length(btrim(reason)) between 1 and 5000), resolved_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.gea_notification_reads (
 user_id uuid not null references auth.users(id) on delete cascade, notification_key text not null check(length(notification_key) between 1 and 300),
 read_at timestamptz not null default now(), primary key(user_id,notification_key)
);
create table if not exists public.gea_digest_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade, enabled boolean not null default false
);
create table if not exists public.gea_weekly_digests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 week_of date not null, items jsonb not null, created_at timestamptz not null default now(), unique(user_id,week_of)
);
-- Shared operational records contain no personal accountability details.
do $$ declare t text; begin
 foreach t in array array['gea_meeting_notes','gea_agenda_items','gea_event_plans','gea_event_checklist'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists gea_workspace_read on public.%I',t);
  execute format('create policy gea_workspace_read on public.%I for select to authenticated using(public.has_officer_access())',t);
 end loop;
 foreach t in array array['gea_notification_reads','gea_digest_preferences','gea_weekly_digests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists gea_self_read on public.%I',t);
  execute format('create policy gea_self_read on public.%I for select to authenticated using(user_id=auth.uid() and public.has_gea_workspace())',t);
 end loop;
 foreach t in array array['gea_meeting_notes','gea_agenda_items','gea_event_plans','gea_event_checklist','gea_task_blockers','gea_notification_reads','gea_digest_preferences','gea_weekly_digests'] loop
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
alter table public.gea_task_blockers enable row level security;
create or replace function public.is_open_gea_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.has_officer_access() and exists(select 1 from public.tasks where id=p_task_id and status='in_progress' and cancelled_at is null);
$$;
drop policy if exists blocker_read on public.gea_task_blockers;
create policy blocker_read on public.gea_task_blockers for select to authenticated using(public.can_read_officer_task(task_id) or (public.is_open_gea_task(task_id) and helper_id=auth.uid()));
-- Safe secretary roll call: names and statuses only, no absence explanations or reviewer notes.
create or replace function public.meeting_roll_call(p_event_id uuid)
returns table(officer_id uuid,name text,"position" text,status text) language plpgsql stable security definer set search_path='' as $$ begin
 if not public.can_manage_meetings() then raise exception 'Secretary or reviewer access is required.'; end if;
 if not exists(select 1 from public.officer_events where id=p_event_id and kind='meeting') then raise exception 'Meeting unavailable.'; end if;
 return query select p.id,p.name,p.position,coalesce(a.status,'unmarked') from public.officer_profiles p
 left join public.officer_attendance a on a.officer_id=p.id and a.event_id=p_event_id
 where public.is_task_officer(p.id) order by p.name,p.id;
end $$;
create or replace function public.save_meeting_attendance(p_event_id uuid,p_rows jsonb)
returns void language plpgsql security definer set search_path='' as $$ declare r jsonb; s text; who uuid; ev public.officer_events; begin
 if not public.can_manage_meetings() then raise exception 'Secretary or reviewer access is required.'; end if;
 select * into ev from public.officer_events where id=p_event_id for update;
 if not found or ev.kind<>'meeting' or ev.cancelled then raise exception 'Select an active meeting.'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>200 then raise exception 'Invalid attendance list.'; end if;
 for r in select * from jsonb_array_elements(p_rows) loop
  who:=(r->>'officer_id')::uuid; s:=r->>'status';
  if not public.is_task_officer(who) or s is null or s not in ('unmarked','present','late','excused','unexcused') then raise exception 'Invalid officer or attendance status.'; end if;
  if s in ('present','late','unexcused') and ev.starts_at>now() then raise exception 'Record actual attendance after the meeting begins.'; end if;
  if s<>'unexcused' and exists(select 1 from public.officer_strikes st join public.officer_attendance a on a.id=st.attendance_id
   where a.officer_id=who and a.event_id=p_event_id and st.status='confirmed') then raise exception 'A reviewer must revoke the linked strike before correcting this absence.'; end if;
  if exists(select 1 from public.officer_attendance a where a.officer_id=who and a.event_id=p_event_id and a.status is distinct from r->>'original_status')
   or (not exists(select 1 from public.officer_attendance a where a.officer_id=who and a.event_id=p_event_id) and r->>'original_status' is distinct from 'unmarked') then
   raise exception 'Attendance changed in another session. Reload the meeting before saving.';
  end if;
  insert into public.officer_attendance(event_id,officer_id,status,recorded_by) values(p_event_id,who,s,auth.uid())
  on conflict(event_id,officer_id) do update set status=excluded.status,recorded_by=auth.uid(),updated_at=now();
 end loop;
end $$;
create or replace function public.save_meeting_notes(p_event_id uuid,p_minutes text,p_decisions text,p_version integer)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.can_manage_meetings() then raise exception 'Secretary or reviewer access is required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind='meeting' and not cancelled for update;
 if not found then raise exception 'Select an active meeting.'; end if;
 if coalesce((select version from public.gea_meeting_notes where event_id=p_event_id),0)<>p_version or p_version is null then raise exception 'Notes changed in another session. Reload before saving.'; end if;
 insert into public.gea_meeting_notes(event_id,minutes,decisions,updated_by) values(p_event_id,p_minutes,p_decisions,auth.uid())
 on conflict(event_id) do update set minutes=excluded.minutes,decisions=excluded.decisions,updated_by=auth.uid(),updated_at=now(),version=public.gea_meeting_notes.version+1;
end $$;
create or replace function public.add_meeting_agenda(p_event_id uuid,p_title text,p_details text)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_officer_access() then raise exception 'Officer access required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind='meeting' and not cancelled for update;
 if not found then raise exception 'Select an active meeting.'; end if;
 insert into public.gea_agenda_items(event_id,author_id,title,details) values(p_event_id,auth.uid(),btrim(p_title),p_details);
end $$;
create or replace function public.assign_agenda_action(p_agenda_id uuid,p_assignee uuid,p_due_date date)
returns uuid language plpgsql security definer set search_path='' as $$ declare a public.gea_agenda_items; v_id uuid; begin
 if not public.can_manage_meetings() then raise exception 'Secretary or reviewer access required.'; end if;
 select * into a from public.gea_agenda_items where id=p_agenda_id for update;
 if not found or a.task_id is not null then raise exception 'This item is unavailable or already assigned.'; end if;
 if not public.is_task_officer(p_assignee) or (p_due_date is not null and p_due_date<(now() at time zone 'America/Los_Angeles')::date) then raise exception 'Choose an active officer and a future deadline.'; end if;
 if exists(select 1 from public.officer_events where id=a.event_id and cancelled) then raise exception 'Meeting cancelled.'; end if;
 -- Secretary may create an action item, but gains no task review/evaluation rights.
 insert into public.tasks(title,description,assigned_to,created_by,due_date,original_due_date)
 values(a.title,a.details,p_assignee,auth.uid(),p_due_date,p_due_date) returning id into v_id;
 update public.gea_agenda_items set task_id=v_id where id=a.id;
 return v_id;
end $$;
create or replace function public.save_event_plan(p_event_id uuid,p_organizer uuid,p_staffing text,p_supplies text,p_recap text,p_version integer)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_officer_access() then raise exception 'Officer access required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind<>'meeting' and not cancelled for update;
 if not found then raise exception 'Select an active service event.'; end if;
 if not public.is_peet_admin() and not exists(select 1 from public.gea_event_plans where event_id=p_event_id and organizer_id=auth.uid()) then raise exception 'Only the organizer or a reviewer can edit this plan.'; end if;
 if p_organizer is not null and not public.is_task_officer(p_organizer) then raise exception 'Choose an active officer as organizer.'; end if;
 if coalesce((select version from public.gea_event_plans where event_id=p_event_id),0)<>p_version or p_version is null then raise exception 'Plan changed in another session. Reload before saving.'; end if;
 if not public.is_peet_admin() and p_organizer is distinct from auth.uid() then raise exception 'A reviewer must reassign the organizer.'; end if;
 insert into public.gea_event_plans(event_id,organizer_id,staffing,supplies,recap,updated_by) values(p_event_id,p_organizer,p_staffing,p_supplies,p_recap,auth.uid())
 on conflict(event_id) do update set organizer_id=excluded.organizer_id,staffing=excluded.staffing,supplies=excluded.supplies,recap=excluded.recap,version=public.gea_event_plans.version+1,updated_by=auth.uid(),updated_at=now();
end $$;
create or replace function public.save_event_checklist(p_event_id uuid,p_title text,p_done boolean default false,p_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_officer_access() or not (public.is_peet_admin() or exists(select 1 from public.gea_event_plans where event_id=p_event_id and organizer_id=auth.uid())) then raise exception 'Organizer or reviewer access required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind<>'meeting' and not cancelled for update;
 if not found then raise exception 'Select an active service event.'; end if;
 if p_id is null then insert into public.gea_event_checklist(event_id,title,done,created_by,updated_by) values(p_event_id,btrim(p_title),p_done,auth.uid(),auth.uid());
 else update public.gea_event_checklist set title=btrim(p_title),done=p_done,updated_by=auth.uid(),updated_at=now() where id=p_id and event_id=p_event_id;
 if not found then raise exception 'Checklist item unavailable.'; end if; end if;
end $$;
create or replace function public.save_task_blocker(p_task_id uuid,p_reason text,p_helper uuid default null,p_resolved boolean default false)
returns void language plpgsql security definer set search_path='' as $$ declare t public.tasks; begin
 if not public.has_officer_access() then raise exception 'Officer access required.'; end if;
 select * into t from public.tasks where id=p_task_id for update;
 if not found or not public.is_officer_task_participant(p_task_id) or t.status<>'in_progress' or t.cancelled_at is not null then raise exception 'Only participants can flag their active task.'; end if;
 if p_helper is not null and not exists(select 1 from public.officer_profiles where id=p_helper and access_enabled) then raise exception 'Helper unavailable.'; end if;
 insert into public.gea_task_blockers(task_id,officer_id,reason,helper_id,resolved_at) values(p_task_id,auth.uid(),btrim(p_reason),p_helper,case when p_resolved then now() end)
 on conflict(task_id) do update set reason=excluded.reason,helper_id=excluded.helper_id,officer_id=auth.uid(),resolved_at=excluded.resolved_at,updated_at=now();
end $$;
create or replace function public.mark_gea_notifications(p_keys text[])
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_gea_workspace() then raise exception 'Workspace access required.'; end if;
 if p_keys is null or cardinality(p_keys)>10000 then raise exception 'Invalid notification list.'; end if;
 insert into public.gea_notification_reads(user_id,notification_key) select auth.uid(),k from unnest(p_keys) k on conflict do nothing;
end $$;
create or replace function public.set_gea_digest(p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_gea_workspace() then raise exception 'Workspace access required.'; end if;
 insert into public.gea_digest_preferences(user_id,enabled) values(auth.uid(),p_enabled) on conflict(user_id) do update set enabled=excluded.enabled;
end $$;
-- Atomic weekly snapshots are generated by the server from permission-filtered attention items.
create or replace function public.save_gea_digest(p_items jsonb)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_gea_workspace() then raise exception 'Workspace access required.'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or pg_column_size(p_items)>500000 then raise exception 'Invalid digest.'; end if;
 if exists(select 1 from public.gea_digest_preferences where user_id=auth.uid() and enabled) then
 insert into public.gea_weekly_digests(user_id,week_of,items) values(auth.uid(),date_trunc('week',now() at time zone 'America/Los_Angeles')::date,p_items) on conflict do nothing;
 end if;
end $$;
-- Keep operational edits auditable without opening the audit log to secretaries.
do $$ declare t text; begin
 foreach t in array array['gea_meeting_notes','gea_agenda_items','gea_event_plans','gea_event_checklist','gea_task_blockers'] loop
 execute format('drop trigger if exists operations_audit on public.%I',t);
 execute format('create trigger operations_audit after insert or update or delete on public.%I for each row execute function public.audit_officer_tracking()',t);
 end loop;
end $$;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array[
 'can_manage_meetings','is_open_gea_task','has_gea_workspace','meeting_roll_call','save_meeting_attendance','save_meeting_notes','add_meeting_agenda','assign_agenda_action','save_event_plan','save_event_checklist','save_task_blocker','mark_gea_notifications','set_gea_digest','save_gea_digest']) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;

-- Digests are delivered in the portal; no external messages are sent.
alter table public.gea_weekly_digests add column if not exists scope text not null default 'officer';
drop policy if exists gea_self_read on public.gea_weekly_digests;
create policy gea_self_read on public.gea_weekly_digests for select to authenticated using(user_id=auth.uid() and public.has_gea_workspace()
 and (scope='officer' and public.has_officer_access() or scope='reviewer' and public.has_officer_access() and public.is_peet_admin()
 or scope='staff' and (public.is_super_admin() or exists(select 1 from public.admins where auth_user_id=auth.uid()) or exists(select 1 from public.teacher_profiles where auth_user_id=auth.uid()))));
create or replace function public.save_gea_digest(p_items jsonb)
returns void language plpgsql security definer set search_path='' as $$ declare v_scope text; begin
 if not public.has_gea_workspace() then raise exception 'Workspace access required.'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or pg_column_size(p_items)>500000 then raise exception 'Invalid digest.'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) i where jsonb_typeof(i)<>'object' or coalesce(i->>'href','') !~ '^/(operations|officerboard|admin-portal-x7k9)([/?#]|$)' or length(coalesce(i->>'title',''))>1000) then raise exception 'Invalid digest item.'; end if;
 v_scope:=case when public.has_officer_access() and public.is_peet_admin() then 'reviewer' when public.has_officer_access() then 'officer' else 'staff' end;
 if exists(select 1 from public.gea_digest_preferences where user_id=auth.uid() and enabled) then
 insert into public.gea_weekly_digests(user_id,week_of,items,scope) values(auth.uid(),date_trunc('week',now() at time zone 'America/Los_Angeles')::date,p_items,v_scope) on conflict do nothing;
 end if;
end $$;
-- A scheduler may call this service-only function weekly, even when nobody visits.
create or replace function public.refresh_gea_weekly_digests()
returns integer language plpgsql security definer set search_path='' as $$
declare person record; v_items jsonb; v_reviewer boolean; v_staff boolean; v_member boolean; v_scope text; v_count integer:=0; v_added integer; v_week date:=date_trunc('week',now() at time zone 'America/Los_Angeles')::date; begin
 for person in select user_id from public.gea_digest_preferences where enabled loop
  v_member:=exists(select 1 from public.officer_profiles where id=person.user_id and access_enabled);
  v_staff:=exists(select 1 from public.admins where auth_user_id=person.user_id) or exists(select 1 from public.teacher_profiles where auth_user_id=person.user_id) or exists(select 1 from public.super_admins where auth_user_id=person.user_id and explicit_grant);
  v_reviewer:=exists(select 1 from public.officer_profiles where id=person.user_id and access_enabled and role='admin') or exists(select 1 from public.super_admins where auth_user_id=person.user_id and explicit_grant) or exists(select 1 from public.teacher_profiles where auth_user_id=person.user_id);
  if not v_member and not v_staff then continue; end if;
  v_scope:=case when v_member and v_reviewer then 'reviewer' when v_member then 'officer' else 'staff' end;
  select coalesce(jsonb_agg(item),'[]'::jsonb) into v_items from (
   select jsonb_build_object('key','task:'||t.id,'title',t.title,'detail',case when t.status='submitted' then 'Submission awaiting review' else 'Upcoming or overdue task' end,'href',case when v_staff then '/admin-portal-x7k9/officers' else '/officerboard' end,'category','Tasks') item
   from public.tasks t where v_member and t.cancelled_at is null and t.status<>'completed'
    and (v_reviewer or t.assigned_to=person.user_id or exists(select 1 from public.officer_task_members m where m.task_id=t.id and m.officer_id=person.user_id))
    and (v_reviewer and t.status='submitted' or t.status='in_progress' and t.due_date<=(now() at time zone 'America/Los_Angeles')::date+7)
   union all select jsonb_build_object('key','event:'||e.id,'title',e.title,'detail','Upcoming '||e.kind,'href','/operations?view='||case when e.kind='meeting' then 'meetings' else 'events' end||'&event='||e.id,'category','Calendar')
   from public.officer_events e where v_member and not e.cancelled and e.ends_at>=now() and e.starts_at<now()+interval '7 days'
   union all select jsonb_build_object('key','service:'||l.id,'title',e.title,'detail','Service hours awaiting verification','href','/admin-portal-x7k9/officers','category','Review')
   from public.officer_volunteer_logs l join public.officer_events e on e.id=l.event_id where v_member and v_reviewer and l.status='pending' and not e.cancelled
   union all select jsonb_build_object('key','application:'||a.id,'title','Leadership application','detail','Application awaiting review','href','/admin-portal-x7k9/applications','category','Administration')
   from public.applications a where v_staff and a.status='pending'
   union all select jsonb_build_object('key','profile:'||r.id,'title','Profile change · '||r.requested_by_name,'detail','Profile change awaiting review','href','/admin-portal-x7k9/profile-changes','category','Administration')
   from public.profile_change_requests r where v_staff and r.status='pending'
   union all select jsonb_build_object('key','builder:'||b.id,'title',b.title,'detail','Builder submission awaiting review','href','/admin-portal-x7k9/builders','category','Administration')
   from public.builder_submissions b where v_staff and b.status='pending'
   union all select jsonb_build_object('key','forum-question:'||q.id,'title','Forum question','detail','Forum question awaiting review','href','/admin-portal-x7k9/forum','category','Administration')
   from public.qa_questions q where v_staff and q.status='pending'
   union all select jsonb_build_object('key','forum-answer:'||a.id,'title','Forum answer','detail','Forum answer awaiting review','href','/admin-portal-x7k9/forum','category','Administration')
   from public.qa_answers a where v_staff and a.status='pending'
   union all select jsonb_build_object('key','help:'||b.task_id,'title',case when v_reviewer or t.assigned_to=person.user_id or exists(select 1 from public.officer_task_members m where m.task_id=t.id and m.officer_id=person.user_id) then t.title else 'Help requested on a task' end,'detail',b.reason,'href','/operations?view=blockers','category','Help')
   from public.gea_task_blockers b join public.tasks t on t.id=b.task_id where v_member and b.resolved_at is null and t.status='in_progress' and t.cancelled_at is null
    and (v_reviewer or t.assigned_to=person.user_id or b.helper_id=person.user_id or exists(select 1 from public.officer_task_members m where m.task_id=t.id and m.officer_id=person.user_id))
   union all select jsonb_build_object('key','cancellation:'||c.id,'title',t.title,'detail','Cancellation request awaiting review','href',case when v_staff then '/admin-portal-x7k9/officers?task=' else '/officerboard?task=' end||t.id,'category','Review')
   from public.officer_task_cancellation_requests c join public.tasks t on t.id=c.task_id where v_member and v_reviewer and c.status='pending'
   union all select jsonb_build_object('key','concern:'||s.id,'title','Accountability notice','detail','Review the notice and explain your circumstances','href',case when v_staff then '/admin-portal-x7k9/officers?topic=accountability' else '/officerboard?topic=accountability' end,'category','Response')
   from public.officer_strikes s where v_member and s.officer_id=person.user_id and s.status='notified'

  ) entries;
  insert into public.gea_weekly_digests(user_id,week_of,items,scope) values(person.user_id,v_week,v_items,v_scope) on conflict do nothing;
  get diagnostics v_added=row_count;v_count:=v_count+v_added;
 end loop;
 return v_count;
end $$;
revoke all on function public.refresh_gea_weekly_digests() from public,anon,authenticated;
grant execute on function public.refresh_gea_weekly_digests() to service_role;
commit;


-- Google Docs agenda and meeting notes.
-- Apply after gea-operations.sql. Keeps all existing meeting notes and agenda history.
begin;
create or replace function public.is_google_doc_url(p_url text)
returns boolean language sql immutable set search_path='' as $$
 select p_url is null or (length(p_url)<=2048 and strpos(p_url,chr(92))=0 and
 p_url ~ '^https://docs[.]google[.]com/document/(u/[0-9]+/)?d/(e/)?[A-Za-z0-9_-]+(/(edit|view|preview|pub|mobilebasic))?/?([?#][^[:space:]]*)?$');
$$;
alter table public.gea_meeting_notes add column if not exists agenda_doc_url text check(public.is_google_doc_url(agenda_doc_url));
alter table public.gea_meeting_notes add column if not exists notes_doc_url text check(public.is_google_doc_url(notes_doc_url));
create or replace function public.save_meeting_documents(p_event_id uuid,p_agenda_url text,p_notes_url text,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_agenda text:=nullif(btrim(p_agenda_url),''); v_notes text:=nullif(btrim(p_notes_url),''); begin
 if not public.can_manage_meetings() then raise exception 'Secretary or reviewer access is required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind='meeting' and not cancelled for update;
 if not found then raise exception 'Select an active meeting.'; end if;
 if not public.is_google_doc_url(v_agenda) or not public.is_google_doc_url(v_notes) then raise exception 'Use a valid HTTPS Google Docs document link.'; end if;
 if p_version is null or coalesce((select version from public.gea_meeting_notes where event_id=p_event_id),0)<>p_version then
 raise exception 'Meeting documents changed in another session. Reload before saving.'; end if;
 insert into public.gea_meeting_notes(event_id,agenda_doc_url,notes_doc_url,updated_by)
 values(p_event_id,v_agenda,v_notes,auth.uid()) on conflict(event_id) do update
 set agenda_doc_url=excluded.agenda_doc_url,notes_doc_url=excluded.notes_doc_url,
 updated_by=auth.uid(),updated_at=now(),version=public.gea_meeting_notes.version+1;
end $$;
revoke all on function public.is_google_doc_url(text),public.save_meeting_documents(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.is_google_doc_url(text),public.save_meeting_documents(uuid,text,text,integer) to authenticated;
commit;


-- Google Doc event and volunteer planning sheets.
-- Apply after gea-operations.sql and meeting-document-links.sql.
-- Retains existing staffing, supplies, recap, checklist, and audit records.
begin;
alter table public.gea_event_plans add column if not exists planning_doc_url text
 check(public.is_google_doc_url(planning_doc_url));

create or replace function public.save_event_planning_document(p_event_id uuid,p_organizer uuid,p_document_url text,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_url text:=nullif(btrim(p_document_url),''); begin
 if not public.has_officer_access() then raise exception 'Officer access required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind<>'meeting' and not cancelled for update;
 if not found then raise exception 'Select an active event or volunteer activity.'; end if;
 if not public.is_peet_admin() and not exists(select 1 from public.gea_event_plans where event_id=p_event_id and organizer_id=auth.uid()) then
 raise exception 'Only the organizer or a reviewer can edit this plan.'; end if;
 if p_organizer is not null and not public.is_task_officer(p_organizer) then raise exception 'Choose an active officer as organizer.'; end if;
 if not public.is_peet_admin() and p_organizer is distinct from auth.uid() then raise exception 'A reviewer must reassign the organizer.'; end if;
 if not public.is_google_doc_url(v_url) then raise exception 'Use a valid HTTPS Google Docs document link.'; end if;
 if p_version is null or coalesce((select version from public.gea_event_plans where event_id=p_event_id),0)<>p_version then
 raise exception 'Plan changed in another session. Reload before saving.'; end if;
 insert into public.gea_event_plans(event_id,organizer_id,planning_doc_url,updated_by)
 values(p_event_id,p_organizer,v_url,auth.uid()) on conflict(event_id) do update
 set organizer_id=excluded.organizer_id,planning_doc_url=excluded.planning_doc_url,
 version=public.gea_event_plans.version+1,updated_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.save_event_planning_document(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.save_event_planning_document(uuid,uuid,text,integer) to authenticated;
commit;


-- Event participation requests and reviewer assignments.
-- Apply after officer-shared-tasks.sql. Requests and reviewer assignments are independent.
begin;
alter table public.officer_event_signups add column if not exists assigned boolean not null default false;
alter table public.officer_event_signups add column if not exists participation_role text not null default '' check(length(participation_role)<=200);
alter table public.officer_event_signups add column if not exists participation_notes text not null default '' check(length(participation_notes)<=5000);
alter table public.officer_event_signups add column if not exists version integer not null default 1;

create or replace function public.set_officer_event_signup(p_event_id uuid,p_committed boolean)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_officer_access() or not public.is_task_officer(auth.uid()) then raise exception 'Active officer access is required.'; end if;
 if p_committed is null then raise exception 'Choose your participation request status.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind in ('volunteer','outreach') and not cancelled for update;
 if not found then raise exception 'Event not available.'; end if;
 insert into public.officer_event_signups(event_id,officer_id,committed) values(p_event_id,auth.uid(),p_committed)
 on conflict(event_id,officer_id) do update set committed=excluded.committed,
 version=public.officer_event_signups.version+1,updated_at=now();
end $$;

create or replace function public.save_officer_event_assignment(p_event_id uuid,p_officer_id uuid,p_assigned boolean,p_role text,p_notes text,p_version integer)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.has_officer_access() or not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind in ('volunteer','outreach') and not cancelled for update;
 if not found then raise exception 'Select an active volunteer or outreach event.'; end if;
 if not public.is_task_officer(p_officer_id) then raise exception 'Choose an active officer.'; end if;
 if p_assigned is null then raise exception 'Choose an assignment status.'; end if;
 if p_version is null or coalesce((select version from public.officer_event_signups where event_id=p_event_id and officer_id=p_officer_id),0)<>p_version then
 raise exception 'Participation changed in another session. Reload before saving.'; end if;
 insert into public.officer_event_signups(event_id,officer_id,committed,assigned,participation_role,participation_notes)
 values(p_event_id,p_officer_id,false,p_assigned,btrim(coalesce(p_role,'')),btrim(coalesce(p_notes,'')))
 on conflict(event_id,officer_id) do update set assigned=excluded.assigned,
 participation_role=excluded.participation_role,participation_notes=excluded.participation_notes,
 version=public.officer_event_signups.version+1,updated_at=now();
end $$;
revoke all on function public.set_officer_event_signup(uuid,boolean),public.save_officer_event_assignment(uuid,uuid,boolean,text,text,integer) from public,anon,authenticated;
grant execute on function public.set_officer_event_signup(uuid,boolean),public.save_officer_event_assignment(uuid,uuid,boolean,text,text,integer) to authenticated;
commit;

-- Run after officer-shared-tasks.sql and teacher-super-admin.sql.
-- Reserve the future Auth ID so every officer record keeps its identity at signup.
begin;
alter table public.officer_profiles add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;
alter table public.officer_profiles add column if not exists pending_email text;
update public.officer_profiles p set auth_user_id=p.id where auth_user_id is null and exists(select 1 from auth.users u where u.id=p.id);
alter table public.officer_profiles drop constraint if exists officer_profiles_id_fkey;
create unique index if not exists officer_profiles_pending_email on public.officer_profiles(lower(pending_email)) where pending_email is not null;
alter table public.officer_profiles drop constraint if exists officer_profiles_account_identity;
alter table public.officer_profiles add constraint officer_profiles_account_identity check(
 (auth_user_id is not null and auth_user_id=id and pending_email is null) or
 (auth_user_id is null and pending_email is not null and pending_email=lower(btrim(pending_email))
  and length(pending_email)<=254 and pending_email ~ '^[^[:space:]@]+@lvjusd\.org$')
);

-- Existing account-management and teacher-provisioning inserts keep working.
create or replace function public.link_officer_identity()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.auth_user_id is null and new.pending_email is null and exists(select 1 from auth.users where id=new.id) then
  new.auth_user_id:=new.id;
 end if;
 return new;
end $$;
drop trigger if exists officer_identity_link on public.officer_profiles;
create trigger officer_identity_link before insert or update on public.officer_profiles for each row execute function public.link_officer_identity();

-- All server signup paths use the reserved ID, never an email supplied as user metadata.
create or replace function public.activate_preregistered_officer()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 perform pg_advisory_xact_lock(hashtextextended(lower(new.email),0));
 if exists(select 1 from public.officer_profiles where auth_user_id is null and
   ((id=new.id and pending_email is distinct from lower(new.email)) or (pending_email=lower(new.email) and id<>new.id))) then
  raise exception 'Officer signup reservation changed. Please retry signup.';
 end if;
 update public.officer_profiles set auth_user_id=new.id,pending_email=null
 where id=new.id and auth_user_id is null and pending_email=lower(new.email);
 return new;
end $$;
drop trigger if exists officer_signup_link on auth.users;
create trigger officer_signup_link after insert on auth.users for each row execute function public.activate_preregistered_officer();

create or replace function public.save_preregistered_officer(
 p_name text,p_email text,p_position text default '',p_id uuid default null,
 p_role text default 'officer',p_reviewer_kind text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_existing public.officer_profiles; v_email text:=lower(btrim(p_email)); begin
 if not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 160 or v_email is null
  or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@lvjusd\.org$'
  or p_position is null or length(p_position)>160 then raise exception 'Enter a name and a valid @lvjusd.org email.'; end if;
 if p_role is null or p_role not in ('officer','admin') or (p_role='officer' and p_reviewer_kind is not null)
  or (p_role='admin' and (p_reviewer_kind is null or p_reviewer_kind not in ('president','advisor'))) then raise exception 'Choose a valid officer role.'; end if;
 if p_role<>'officer' and not public.is_super_admin() then raise exception 'Super-admin access is required to grant reviewer permissions.'; end if;
 -- Serialize edits with signup lookup by email, and reject duplicate roster entries.
 perform pg_advisory_xact_lock(hashtextextended(v_email,0));
 if p_id is not null then
  select * into v_existing from public.officer_profiles where id=p_id for update;
  if not found or v_existing.auth_user_id is not null then raise exception 'Choose an officer who has not signed up yet.'; end if;
  if v_existing.role='admin' and not public.is_super_admin() then raise exception 'Super-admin access is required to edit reviewer permissions.'; end if;
 end if;
 select id into v_id from auth.users where lower(email)=v_email;
 if v_id is not null then
  if p_id is not null then raise exception 'That email already has an account. Choose their original signup email.'; end if;
  if exists(select 1 from public.officer_profiles where id=v_id) then raise exception 'This account already has officer access.'; end if;
  insert into public.officer_profiles(id,name,role,position,reviewer_kind) values(v_id,btrim(p_name),p_role,btrim(p_position),p_reviewer_kind);
 else
  v_id:=coalesce(p_id,gen_random_uuid());
  if p_id is null then
   insert into public.officer_profiles(id,name,role,position,reviewer_kind,pending_email) values(v_id,btrim(p_name),p_role,btrim(p_position),p_reviewer_kind,v_email);
  else
   update public.officer_profiles set name=btrim(p_name),role=p_role,position=btrim(p_position),reviewer_kind=p_reviewer_kind,pending_email=v_email where id=v_id;
  end if;
 end if;
 return v_id;
end $$;

create or replace function public.officer_directory()
returns table(id uuid,name text,role text,"position" text,reviewer_kind text,peet_onboarding_seen_at timestamptz,access_enabled boolean,is_teacher boolean,email text)
language sql stable security definer set search_path='' as $$
 select p.id,p.name,p.role,p.position,p.reviewer_kind,p.peet_onboarding_seen_at,p.access_enabled,
  exists(select 1 from public.teacher_profiles t where t.auth_user_id=p.id),coalesce(u.email::text,p.pending_email)
 from public.officer_profiles p left join auth.users u on u.id=p.id
 where p.access_enabled and (public.is_peet_admin() or (p.id=auth.uid() and public.has_officer_access()));
$$;
revoke all on function public.link_officer_identity(),public.activate_preregistered_officer(),public.save_preregistered_officer(text,text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.save_preregistered_officer(text,text,text,uuid,text,text) to authenticated;
commit;

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


-- AI-assisted PEET clarification and evaluation (gea-peet-ai.sql).
-- DEPLOYMENT MIGRATION: paste this entire file into the Supabase SQL editor.
-- Apply after officer-shared-tasks.sql and officer-task-submissions.sql.
-- AI clarification and scoring use the existing 1–4 PEET evaluation records.
begin;
create or replace function public.gea_peet_access()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('student',public.has_officer_access() and public.is_task_officer(auth.uid()),
 'reviewer',public.has_officer_access() and public.is_peet_admin());
$$;
create or replace function public.gea_peet_can_review(p_task_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.has_officer_access() and public.is_peet_admin()
 and not public.is_officer_task_participant(p_task_id)
 and (public.is_super_admin() or not exists(
  select 1 from public.officer_profiles p where p.reviewer_kind='president' and
   (exists(select 1 from public.tasks t where t.id=p_task_id and t.assigned_to=p.id)
    or exists(select 1 from public.officer_task_members m where m.task_id=p_task_id and m.officer_id=p.id)))
  or public.is_peet_advisor());
$$;
create or replace function public.gea_peet_source_task(p_task_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_task public.tasks; begin
 if not public.has_officer_access() or not (public.is_officer_task_participant(p_task_id) or public.is_peet_admin()) then raise exception 'Task access required.'; end if;
 select * into v_task from public.tasks where id=p_task_id;
 if not found then raise exception 'Task unavailable.'; end if;
 return jsonb_build_object('id',v_task.id,'title',v_task.title,'description',v_task.description,
 'due_date',v_task.due_date,'original_due_date',v_task.original_due_date,'status',v_task.status,
 'assigned_to',v_task.assigned_to,'final_product_url',v_task.final_product_url,
 'submission_description',v_task.submission_description,'submitted_at',v_task.submitted_at,'cancelled_at',v_task.cancelled_at);
end $$;
create table if not exists public.gea_peet_tasks (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null unique references public.tasks(id),
 student_id uuid not null references auth.users(id), student_name text not null,
 title text not null, description text not null check(length(btrim(description)) between 1 and 5000),
 category text not null check(category in ('Logistics','Outreach','Web Dev','Media','Event Support')),
 source_context jsonb not null,
 status text not null default 'clarification' check(status in ('clarification','pending','approved')),
 assessment jsonb not null,
 answers jsonb not null default '[]'::jsonb,
 reviewer_notes text not null default '' check(length(reviewer_notes)<=3000),
 reviewer_assessment jsonb, reviewer_answers jsonb not null default '[]'::jsonb,
 review_history jsonb not null default '[]'::jsonb,
 questions_by uuid references auth.users(id),
 recommendation jsonb, approved_scores jsonb,
 assessed_model text not null, reviewer_questions_model text, reviewed_model text,
 reviewed_by uuid references auth.users(id), approved_by uuid references auth.users(id),
 override_reason text not null default '' check(length(override_reason)<=2000),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), approved_at timestamptz,
 check(jsonb_typeof(assessment->'studentQuestions')='array' and jsonb_array_length(assessment->'studentQuestions') between 1 and 3),
 check(jsonb_typeof(answers)='array' and jsonb_typeof(reviewer_answers)='array'),
 check((status='approved')=(approved_scores is not null and approved_at is not null))
);
-- Additive when an earlier version of this feature is already installed.
alter table public.gea_peet_tasks add column if not exists submission_url text
 check(submission_url is null or (length(submission_url)<=2048 and submission_url ~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$'));
create or replace function public.gea_peet_my_open_tasks()
returns table(id uuid,title text) language sql stable security definer set search_path='' as $$
 select t.id,t.title from public.tasks t where public.has_officer_access()
 and public.is_officer_task_participant(t.id) and t.status in ('in_progress','submitted') and t.cancelled_at is null
 and not exists(select 1 from public.gea_peet_tasks a where a.task_id=t.id)
 order by t.created_at desc,t.id;
$$;
create or replace function public.gea_peet_my_reviews()
returns setof public.gea_peet_tasks language sql stable security definer set search_path='' as $$
 select a.* from public.gea_peet_tasks a where public.has_officer_access() and public.is_officer_task_participant(a.task_id);
$$;
create index if not exists gea_peet_tasks_student_idx on public.gea_peet_tasks(student_id,created_at desc);
create index if not exists gea_peet_tasks_status_idx on public.gea_peet_tasks(status,created_at desc);
create table if not exists public.gea_peet_ai_requests (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index if not exists gea_peet_ai_requests_user_idx on public.gea_peet_ai_requests(user_id,created_at);
alter table public.gea_peet_tasks enable row level security;
alter table public.gea_peet_ai_requests enable row level security;
drop policy if exists gea_peet_tasks_read on public.gea_peet_tasks;
create policy gea_peet_tasks_read on public.gea_peet_tasks for select to authenticated using(
 public.has_officer_access() and (public.is_officer_task_participant(task_id) or (public.is_peet_admin() and (status<>'clarification' or exists(select 1 from public.tasks t where t.id=gea_peet_tasks.task_id and t.status='submitted'))))
);
revoke all on public.gea_peet_tasks,public.gea_peet_ai_requests from public,anon,authenticated;
grant select on public.gea_peet_tasks to authenticated;
grant all on public.gea_peet_tasks,public.gea_peet_ai_requests to service_role;
grant usage,select on sequence public.gea_peet_ai_requests_id_seq to service_role;
create or replace function public.reserve_gea_peet_ai_request(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$ begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gea-peet-ai-'||p_user_id::text,0));
 delete from public.gea_peet_ai_requests where user_id=p_user_id and created_at<now()-interval '10 minutes';
 if (select count(*) from public.gea_peet_ai_requests where user_id=p_user_id)>=12 then return false; end if;
 insert into public.gea_peet_ai_requests(user_id) values(p_user_id); return true;
end $$;
-- Model-produced assessments are saved by the server after cookie authorization.
-- The service-only function checks participation and the original task snapshot.
create or replace function public.save_gea_peet_assessment(
 p_task_id uuid,p_student_id uuid,p_description text,p_category text,p_source_context jsonb,p_assessment jsonb,p_model text,p_submission_url text
) returns public.gea_peet_tasks language plpgsql security definer set search_path='' as $$
declare v_source public.tasks; v_result public.gea_peet_tasks; v_name text; begin
 select * into v_source from public.tasks where id=p_task_id for update;
 if not found or v_source.cancelled_at is not null or v_source.status not in ('in_progress','submitted') then raise exception 'Task is closed or unavailable.'; end if;
 if not public.is_task_officer(p_student_id) or not (v_source.assigned_to=p_student_id or exists(select 1 from public.officer_task_members where task_id=p_task_id and officer_id=p_student_id)) then raise exception 'Only a task participant may submit.'; end if;
 -- Compare relevant source fields to avoid saving against concurrently edited goals.
 if v_source.title is distinct from p_source_context->>'title' or v_source.description is distinct from p_source_context->>'description'
 or to_jsonb(v_source.due_date) is distinct from nullif(p_source_context->'due_date','null'::jsonb)
 or v_source.status is distinct from p_source_context->>'status'
 or v_source.submission_description is distinct from p_source_context->>'submission_description' then raise exception 'Task changed. Refresh.'; end if;
 select name into v_name from public.officer_profiles where id=p_student_id;
 insert into public.gea_peet_tasks(task_id,student_id,student_name,title,description,category,source_context,assessment,assessed_model,submission_url)
 values(p_task_id,p_student_id,v_name,v_source.title,p_description,p_category,p_source_context,p_assessment,p_model,nullif(btrim(p_submission_url),''))
 on conflict(task_id) do nothing returning * into v_result;
 if v_result.id is null then
  select * into v_result from public.gea_peet_tasks where task_id=p_task_id;
  if v_result.student_id<>p_student_id then raise exception 'A teammate already started clarification.'; end if;
 end if;
 return v_result;
end $$;
-- Keep callers of the earlier seven-argument server RPC compatible.
create or replace function public.save_gea_peet_assessment(
 p_task_id uuid,p_student_id uuid,p_description text,p_category text,p_source_context jsonb,p_assessment jsonb,p_model text
) returns public.gea_peet_tasks language sql security definer set search_path='' as $$
 select public.save_gea_peet_assessment(p_task_id,p_student_id,p_description,p_category,p_source_context,p_assessment,p_model,null::text);
$$;
create or replace function public.finalize_gea_peet_task(p_task_id uuid,p_version integer,p_answers jsonb)
returns public.gea_peet_tasks language plpgsql security definer set search_path='' as $$
declare v_task public.gea_peet_tasks; v_source public.tasks; v_source_id uuid; begin
 select task_id into v_source_id from public.gea_peet_tasks where id=p_task_id;
 select * into v_source from public.tasks where id=v_source_id for update;
 select * into v_task from public.gea_peet_tasks where id=p_task_id for update;
 if not found or not public.has_officer_access() or v_task.student_id<>auth.uid() or not public.is_officer_task_participant(v_source_id) then raise exception 'Task unavailable.'; end if;
 if v_task.status<>'clarification' or v_task.version is distinct from p_version or v_source.cancelled_at is not null or v_source.status not in ('in_progress','submitted') then raise exception 'Task changed. Refresh.'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'array' then raise exception 'Answer each saved question.'; end if;
 if jsonb_array_length(p_answers)<>jsonb_array_length(v_task.assessment->'studentQuestions') or exists(
  select 1 from jsonb_array_elements(p_answers) a where jsonb_typeof(a)<>'string' or length(btrim(a#>>'{}')) not between 1 and 2000)
 then raise exception 'Answer each saved question.'; end if;
 -- Existing submission RPC preserves participant permissions, timestamps and evidence.
 if v_source.status='in_progress' then perform public.submit_officer_task(v_source_id,coalesce(v_task.submission_url,v_source.final_product_url),v_task.description); end if;
 update public.gea_peet_tasks set answers=p_answers,status='pending',source_context=public.gea_peet_source_task(v_source_id),version=version+1
 where id=p_task_id returning * into v_task;
 return v_task;
end $$;
-- Persist model-produced reviewer stages only if the original task and AI version
-- still match. Called solely by the trusted server after cookie authorization.
create or replace function public.save_gea_peet_review(
 p_task_id uuid,p_version integer,p_actor uuid,p_source_context jsonb,p_stage text,p_result jsonb,p_notes text,p_answers jsonb,p_model text
) returns public.gea_peet_tasks language plpgsql security definer set search_path='' as $$
declare v_task public.gea_peet_tasks; v_source public.tasks; v_source_id uuid; begin
 select task_id into v_source_id from public.gea_peet_tasks where id=p_task_id;
 select * into v_source from public.tasks where id=v_source_id for update;
 select * into v_task from public.gea_peet_tasks where id=p_task_id for update;
 if not found or v_task.status<>'pending' or v_task.version is distinct from p_version or v_source.cancelled_at is not null or v_source.status<>'submitted' then raise exception 'Task changed. Refresh.'; end if;
 -- Source task fields and participants cannot change unnoticed during generation.
 if v_source.title is distinct from p_source_context->>'title' or v_source.description is distinct from p_source_context->>'description'
 or to_jsonb(v_source.due_date) is distinct from nullif(p_source_context->'due_date','null'::jsonb)
 or v_source.submission_description is distinct from p_source_context->>'submission_description'
 or v_source.final_product_url is distinct from p_source_context->>'final_product_url' then raise exception 'Task changed. Refresh.'; end if;
 if not exists(select 1 from public.officer_profiles where id=p_actor and access_enabled)
 or not (exists(select 1 from public.officer_profiles where id=p_actor and access_enabled and role='admin')
 or exists(select 1 from public.super_admins where auth_user_id=p_actor))
 or v_source.assigned_to=p_actor or exists(select 1 from public.officer_task_members where task_id=v_source_id and officer_id=p_actor) then raise exception 'Reviewer access changed.'; end if;
 if p_stage='questions' then
  update public.gea_peet_tasks set review_history=review_history || case when reviewer_assessment is null then '[]'::jsonb else
   jsonb_build_array(jsonb_build_object('assessment',reviewer_assessment,'answers',reviewer_answers,'notes',reviewer_notes,
   'questions_by',questions_by,'recommendation',recommendation,'reviewed_by',reviewed_by,'source_context',source_context,'saved_at',now())) end,
   reviewer_assessment=p_result,reviewer_notes=p_notes,reviewer_answers='[]',recommendation=null,
   questions_by=p_actor,reviewed_by=null,reviewed_model=null,reviewer_questions_model=p_model,source_context=p_source_context,version=version+1 where id=p_task_id returning * into v_task;
 elsif p_stage='score' then
  if p_source_context is distinct from v_task.source_context then raise exception 'Goals changed. Generate new reviewer questions.'; end if;
  if v_task.questions_by is distinct from p_actor or v_task.reviewer_assessment is null then raise exception 'Answer your own reviewer questions first.'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'array' then raise exception 'Answer each reviewer question.'; end if;
  if jsonb_array_length(p_answers)<>jsonb_array_length(v_task.reviewer_assessment->'reviewerQuestions') then raise exception 'Answer each reviewer question.'; end if;
  update public.gea_peet_tasks set reviewer_answers=p_answers,recommendation=p_result,reviewed_by=p_actor,reviewed_model=p_model,
   source_context=p_source_context,version=version+1 where id=p_task_id returning * into v_task;
 else raise exception 'Invalid review stage.'; end if;
 return v_task;
end $$;
create or replace function public.approve_gea_peet_task(
 p_task_id uuid,p_version integer,p_scores jsonb,p_override_reason text default ''
) returns public.gea_peet_tasks language plpgsql security definer set search_path='' as $$
declare v_task public.gea_peet_tasks; v_source public.tasks; v_source_id uuid; v_eff numeric; v_effect numeric; v_time numeric; v_changed boolean; begin
 select task_id into v_source_id from public.gea_peet_tasks where id=p_task_id;
 select * into v_source from public.tasks where id=v_source_id for update;
 select * into v_task from public.gea_peet_tasks where id=p_task_id for update;
 if not found or not public.gea_peet_can_review(v_source_id) then raise exception 'An independent authorized reviewer is required.'; end if;
 if v_task.status='approved' then return v_task; end if;
 if v_task.status<>'pending' or v_task.version is distinct from p_version or v_task.recommendation is null
 or v_task.reviewed_by is distinct from auth.uid() or v_task.questions_by is distinct from auth.uid()
 or v_source.status<>'submitted' or v_source.cancelled_at is not null then raise exception 'Complete the reviewer questions and AI scoring before approval.'; end if;
 if public.gea_peet_source_task(v_source_id) is distinct from v_task.source_context then raise exception 'Task changed. Generate fresh reviewer questions.'; end if;
 if p_scores is null or jsonb_typeof(p_scores)<>'object' or (p_scores-'efficiency'-'effectiveness'-'time')<>'{}'::jsonb
 or jsonb_typeof(p_scores->'efficiency') is distinct from 'number' or jsonb_typeof(p_scores->'effectiveness') is distinct from 'number' or jsonb_typeof(p_scores->'time') is distinct from 'number'
 then raise exception 'Enter all three PEET scores.'; end if;
 v_eff:=(p_scores->>'efficiency')::numeric; v_effect:=(p_scores->>'effectiveness')::numeric; v_time:=(p_scores->>'time')::numeric;
 if v_eff not between 1 and 4 or v_effect not between 1 and 4 or v_time not between 1 and 4 or round(v_eff,1)<>v_eff or round(v_effect,1)<>v_effect or round(v_time,1)<>v_time then raise exception 'Scores must be 1.0–4.0 in increments of 0.1.'; end if;
 v_changed:=p_scores is distinct from (v_task.recommendation-'justification');
 if p_override_reason is null or length(p_override_reason)>2000 or (v_changed and length(btrim(p_override_reason))=0) then raise exception 'Explain changed scores.'; end if;
 -- Use the SAME evaluation function and table as manual PEET scoring.
 perform public.evaluate_officer_task(v_source_id,v_eff,v_effect,v_time,
  (v_task.recommendation->>'justification')||case when v_changed then E'\nReviewer adjustment: '||btrim(p_override_reason) else '' end);
 update public.gea_peet_tasks set status='approved',approved_scores=p_scores,approved_by=auth.uid(),approved_at=now(),
 override_reason=case when v_changed then btrim(p_override_reason) else '' end,version=version+1 where id=p_task_id returning * into v_task;
 return v_task;
end $$;
revoke all on function public.gea_peet_access(),public.gea_peet_my_open_tasks(),public.gea_peet_my_reviews(),public.gea_peet_can_review(uuid),public.gea_peet_source_task(uuid),
 public.finalize_gea_peet_task(uuid,integer,jsonb),public.approve_gea_peet_task(uuid,integer,jsonb,text),
 public.reserve_gea_peet_ai_request(uuid),public.save_gea_peet_assessment(uuid,uuid,text,text,jsonb,jsonb,text),
 public.save_gea_peet_assessment(uuid,uuid,text,text,jsonb,jsonb,text,text),
 public.save_gea_peet_review(uuid,integer,uuid,jsonb,text,jsonb,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.gea_peet_access(),public.gea_peet_my_open_tasks(),public.gea_peet_my_reviews(),public.gea_peet_can_review(uuid),public.gea_peet_source_task(uuid),
 public.finalize_gea_peet_task(uuid,integer,jsonb),public.approve_gea_peet_task(uuid,integer,jsonb,text) to authenticated;
grant execute on function public.reserve_gea_peet_ai_request(uuid),public.save_gea_peet_assessment(uuid,uuid,text,text,jsonb,jsonb,text),
 public.save_gea_peet_assessment(uuid,uuid,text,text,jsonb,jsonb,text,text),
 public.save_gea_peet_review(uuid,integer,uuid,jsonb,text,jsonb,text,jsonb,text) to service_role;
commit;

-- GEAI durable summary cache and bounded background generation.
-- Run AFTER schema.sql (or existing officer/operations/account migrations).
-- Paste this entire file into the Supabase SQL editor. Safe to rerun.
begin;
create table if not exists public.gea_geai_briefs (
 user_id uuid primary key references auth.users(id) on delete cascade,
 fingerprint text not null,
 snapshot jsonb not null,
 brief jsonb,
 brief_fingerprint text,
 generated_at timestamptz,
 last_seen_at timestamptz not null default now(),
 last_attempt_at timestamptz,
 lease_token uuid,
 lease_until timestamptz
);
create table if not exists public.gea_geai_daily_usage (
 usage_day date primary key,
 requests integer not null default 0 check(requests between 0 and 24)
);
alter table public.gea_geai_briefs enable row level security;
alter table public.gea_geai_daily_usage enable row level security;
-- Access is through server-only RPCs; no direct browser reads or writes.
revoke all on public.gea_geai_briefs, public.gea_geai_daily_usage from public, anon, authenticated;
grant all on public.gea_geai_briefs, public.gea_geai_daily_usage to service_role;

create or replace function public.queue_gea_geai_brief(p_user_id uuid, p_fingerprint text, p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.gea_geai_briefs;
begin
 if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$'
  or p_snapshot is null or jsonb_typeof(p_snapshot)<>'object'
  or jsonb_typeof(p_snapshot->'sources') is distinct from 'array'
  or jsonb_array_length(p_snapshot->'sources')>40 or octet_length(p_snapshot::text)>60000 then
  raise exception 'Invalid GEAI snapshot.';
 end if;
 insert into public.gea_geai_briefs(user_id,fingerprint,snapshot)
 values(p_user_id,p_fingerprint,p_snapshot)
 on conflict(user_id) do update set fingerprint=excluded.fingerprint,
  snapshot=excluded.snapshot,last_seen_at=now()
 returning * into v_row;
 if v_row.brief_fingerprint=p_fingerprint and v_row.generated_at>now()-interval '24 hours' then
  return v_row.brief;
 end if;
 return null;
end $$;

create or replace function public.claim_gea_geai_brief()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.gea_geai_briefs; v_day date:=(now() at time zone 'UTC')::date; v_token uuid;
begin
 -- One lock serializes the daily budget across all workers/instances.
 perform pg_advisory_xact_lock(hashtextextended('gea-geai-daily-budget',0));
 insert into public.gea_geai_daily_usage(usage_day) values(v_day) on conflict do nothing;
 if (select requests from public.gea_geai_daily_usage where usage_day=v_day)>=24 then return null; end if;
 select b.* into v_row from public.gea_geai_briefs b
 where b.last_seen_at>now()-interval '48 hours'
  and jsonb_array_length(b.snapshot->'sources')>0
  and (b.brief_fingerprint is distinct from b.fingerprint or b.generated_at<now()-interval '24 hours')
  and (b.last_attempt_at is null or b.last_attempt_at<=now()-interval '6 hours')
  and (b.lease_until is null or b.lease_until<=now())
  and (exists(select 1 from public.admins where auth_user_id=b.user_id)
   or exists(select 1 from public.super_admins where auth_user_id=b.user_id)
   or exists(select 1 from public.teacher_profiles where auth_user_id=b.user_id)
   or exists(select 1 from public.officer_profiles where id=b.user_id and access_enabled))
 order by b.last_attempt_at nulls first,b.last_seen_at desc,b.user_id
 for update skip locked limit 1;
 if not found then return null; end if;
 v_token:=gen_random_uuid();
 update public.gea_geai_briefs set lease_token=v_token,lease_until=now()+interval '2 minutes',last_attempt_at=now()
 where user_id=v_row.user_id;
 update public.gea_geai_daily_usage set requests=requests+1 where usage_day=v_day;
 delete from public.gea_geai_daily_usage where usage_day<v_day-30;
 return jsonb_build_object('user_id',v_row.user_id,'fingerprint',v_row.fingerprint,'snapshot',v_row.snapshot,'lease_token',v_token);
end $$;

create or replace function public.finish_gea_geai_brief(p_user_id uuid,p_lease_token uuid,p_fingerprint text,p_brief jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_row public.gea_geai_briefs; v_saved boolean:=false;
begin
 select * into v_row from public.gea_geai_briefs where user_id=p_user_id for update;
 if not found or p_lease_token is null or v_row.lease_token is distinct from p_lease_token
  or v_row.lease_until is null or v_row.lease_until<now() then return false; end if;
 if p_brief is not null and v_row.fingerprint=p_fingerprint then
  update public.gea_geai_briefs set brief=p_brief,brief_fingerprint=p_fingerprint,generated_at=now() where user_id=p_user_id;
  v_saved:=true;
 end if;
 update public.gea_geai_briefs set lease_token=null,lease_until=null where user_id=p_user_id;
 return v_saved;
end $$;
revoke all on function public.queue_gea_geai_brief(uuid,text,jsonb),public.claim_gea_geai_brief(),public.finish_gea_geai_brief(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.queue_gea_geai_brief(uuid,text,jsonb),public.claim_gea_geai_brief(),public.finish_gea_geai_brief(uuid,uuid,text,jsonb) to service_role;
commit;


-- CAGE storage only: no weights, score scale, or calculation are assumed.
-- Run in the Supabase SQL editor after the existing officer/account migrations.
begin;

create table if not exists public.officer_cage_scores (
  officer_id uuid not null references public.officer_profiles(id) on delete cascade,
  academic_year text not null check (academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
  score numeric,
  formula_version text check (formula_version is null or length(btrim(formula_version)) between 1 and 100),
  input_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(input_snapshot) = 'object'),
  calculated_at timestamptz,
  primary key (officer_id, academic_year),
  check (score is null or score not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  check (
    (score is null and formula_version is null and calculated_at is null)
    or (score is not null and formula_version is not null and calculated_at is not null)
  )
);

comment on table public.officer_cage_scores is
  'CAGE: Competency Analysis of the Green Engineering Academy. Formula pending; no automatic calculation yet.';
comment on column public.officer_cage_scores.input_snapshot is
  'Inputs actually used by the eventual versioned formula: PEET, attendance, and strikes. Do not populate speculative scores.';

alter table public.officer_cage_scores enable row level security;
drop policy if exists officer_cage_scores_read on public.officer_cage_scores;
create policy officer_cage_scores_read on public.officer_cage_scores
  for select to authenticated
  using (public.is_peet_admin() or (officer_id = auth.uid() and public.has_officer_access()));

-- Scores are derived server-side. Officers and reviewers cannot write arbitrary
-- results from a browser; add the validated calculator once the formula exists.
revoke all on public.officer_cage_scores from public, anon, authenticated;
grant select on public.officer_cage_scores to authenticated;
grant all on public.officer_cage_scores to service_role;
commit;


-- Shared deliverables with individual reflection and PEET evaluations.
-- Run after gea-peet-ai.sql and the existing officer shared-task migrations.
begin;
alter table public.tasks add column if not exists individual_peet boolean not null default false;
alter table public.peet_evaluations add column if not exists officer_id uuid references public.officer_profiles(id);
alter table public.peet_evaluations drop constraint if exists peet_evaluations_task_id_key;
create unique index if not exists peet_evaluations_legacy_task_idx on public.peet_evaluations(task_id) where officer_id is null;
create unique index if not exists peet_evaluations_person_idx on public.peet_evaluations(task_id,officer_id);
alter table public.gea_peet_tasks drop constraint if exists gea_peet_tasks_task_id_key;
create unique index if not exists gea_peet_tasks_person_idx on public.gea_peet_tasks(task_id,student_id);
alter table public.gea_peet_tasks add column if not exists reflected_at timestamptz;
alter table public.gea_peet_tasks add column if not exists deliverable_description text not null default '' check(length(deliverable_description)<=5000);
-- Preserve already awarded group scores. Only unscored, open collaborations upgrade.
update public.tasks t set individual_peet=true where t.status<>'completed' and t.cancelled_at is null
 and exists(select 1 from public.officer_task_members m where m.task_id=t.id)
 and not exists(select 1 from public.peet_evaluations e where e.task_id=t.id and e.officer_id is null);
create or replace function public.mark_individual_shared_task()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 update public.tasks set individual_peet=true where id=new.task_id and status='in_progress'; return new;
end $$;
drop trigger if exists task_members_individual_peet on public.officer_task_members;
create trigger task_members_individual_peet after insert on public.officer_task_members for each row execute function public.mark_individual_shared_task();
-- One contribution record belongs to its author, not all task participants.
drop policy if exists gea_peet_tasks_read on public.gea_peet_tasks;
create policy gea_peet_tasks_read on public.gea_peet_tasks for select to authenticated using(
 public.has_officer_access() and (student_id=auth.uid() or public.gea_peet_can_review(task_id))
);
drop policy if exists officer_evaluations_read on public.peet_evaluations;
create policy officer_evaluations_read on public.peet_evaluations for select to authenticated using(
 (officer_id is null and public.can_read_officer_task(task_id)) or
 (public.has_officer_access() and (officer_id=auth.uid() or public.gea_peet_can_review(task_id)))
);


create or replace function public.gea_peet_source_task(p_task_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_task public.tasks; begin
 if not public.has_officer_access() or not (public.is_officer_task_participant(p_task_id) or public.is_peet_admin()) then raise exception 'Task access required.'; end if;
 select * into v_task from public.tasks where id=p_task_id;
 if not found then raise exception 'Task unavailable.'; end if;
 return jsonb_build_object('id',v_task.id,'title',v_task.title,'description',v_task.description,
 'due_date',v_task.due_date,'original_due_date',v_task.original_due_date,'status',v_task.status,
 'assigned_to',v_task.assigned_to,'final_product_url',v_task.final_product_url,
 'submission_description',v_task.submission_description,'submitted_at',v_task.submitted_at,'cancelled_at',v_task.cancelled_at,'individual_peet',v_task.individual_peet,'participant_ids',
 (select jsonb_agg(i order by i) from (select v_task.assigned_to i union select officer_id from public.officer_task_members where task_id=v_task.id) people));
end $$;

create or replace function public.save_gea_peet_assessment(
 p_task_id uuid,p_student_id uuid,p_description text,p_category text,p_source_context jsonb,p_assessment jsonb,p_model text,p_submission_url text
) returns public.gea_peet_tasks language plpgsql security definer set search_path='' as $$
declare v_source public.tasks; v_result public.gea_peet_tasks; v_name text; begin
 select * into v_source from public.tasks where id=p_task_id for update;
 if not found or v_source.cancelled_at is not null or v_source.status not in ('in_progress','submitted') then raise exception 'Task is closed or unavailable.'; end if;
 if not public.is_task_officer(p_student_id) or not (v_source.assigned_to=p_student_id or exists(select 1 from public.officer_task_members where task_id=p_task_id and officer_id=p_student_id)) then raise exception 'Only a task participant may submit.'; end if;
 -- Compare relevant source fields to avoid saving against concurrently edited goals.
 if v_source.title is distinct from p_source_context->>'title' or v_source.description is distinct from p_source_context->>'description'
 or to_jsonb(v_source.due_date) is distinct from nullif(p_source_context->'due_date','null'::jsonb)
 or v_source.status is distinct from p_source_context->>'status'
 or v_source.submission_description is distinct from p_source_context->>'submission_description' then raise exception 'Task changed. Refresh.'; end if;
 if not v_source.individual_peet and exists(select 1 from public.gea_peet_tasks where task_id=p_task_id and student_id<>p_student_id) then raise exception 'A submitter already started clarification.'; end if;
 select name into v_name from public.officer_profiles where id=p_student_id;
 insert into public.gea_peet_tasks(task_id,student_id,student_name,title,description,category,source_context,assessment,assessed_model,submission_url)
 values(p_task_id,p_student_id,v_name,v_source.title,p_description,p_category,p_source_context,p_assessment,p_model,nullif(btrim(p_submission_url),''))
 on conflict(task_id,student_id) do nothing returning * into v_result;
 if v_result.id is null then
  select * into v_result from public.gea_peet_tasks where task_id=p_task_id and student_id=p_student_id;

 end if;
 return v_result;
end $$;


create or replace function public.save_gea_peet_contribution_assessment(
 p_task_id uuid,p_student_id uuid,p_description text,p_category text,p_source_context jsonb,p_assessment jsonb,p_model text,p_submission_url text,p_deliverable_description text
) returns public.gea_peet_tasks language plpgsql security definer set search_path='' as $$
declare v_result public.gea_peet_tasks; begin
 if p_deliverable_description is null or length(p_deliverable_description)>5000 then raise exception 'Describe the shared deliverable within 5000 characters.'; end if;
 v_result:=public.save_gea_peet_assessment(p_task_id,p_student_id,p_description,p_category,p_source_context,p_assessment,p_model,p_submission_url);
 if v_result.deliverable_description='' then
  update public.gea_peet_tasks set deliverable_description=p_deliverable_description where id=v_result.id and status='clarification' returning * into v_result;
 end if;
 return v_result;
end $$;


create or replace function public.finalize_gea_peet_task(p_task_id uuid,p_version integer,p_answers jsonb)
returns public.gea_peet_tasks language plpgsql security definer set search_path='' as $$
declare v_task public.gea_peet_tasks; v_source public.tasks; v_source_id uuid; begin
 select task_id into v_source_id from public.gea_peet_tasks where id=p_task_id;
 select * into v_source from public.tasks where id=v_source_id for update;
 select * into v_task from public.gea_peet_tasks where id=p_task_id for update;
 if not found or not public.has_officer_access() or v_task.student_id<>auth.uid() or not public.is_officer_task_participant(v_source_id) then raise exception 'Task unavailable.'; end if;
 if v_task.status<>'clarification' or v_task.version is distinct from p_version or v_source.cancelled_at is not null or v_source.status not in ('in_progress','submitted') then raise exception 'Task changed. Refresh.'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'array' then raise exception 'Answer each saved question.'; end if;
 if jsonb_array_length(p_answers)<>jsonb_array_length(v_task.assessment->'studentQuestions') or exists(
  select 1 from jsonb_array_elements(p_answers) a where jsonb_typeof(a)<>'string' or length(btrim(a#>>'{}')) not between 1 and 2000)
 then raise exception 'Answer each saved question.'; end if;
 if v_source.title is distinct from v_task.source_context->>'title' or v_source.description is distinct from v_task.source_context->>'description'
 or to_jsonb(v_source.due_date) is distinct from nullif(v_task.source_context->'due_date','null'::jsonb) then raise exception 'Task goals changed. Restart clarification.'; end if;
 -- Existing submission RPC preserves participant permissions, timestamps and evidence.
 if v_source.status='in_progress' then perform public.submit_officer_task(v_source_id,coalesce(v_task.submission_url,v_source.final_product_url),case when v_source.individual_peet and v_task.deliverable_description<>'' then v_task.deliverable_description else v_task.description end); end if;
 update public.gea_peet_tasks set answers=p_answers,status='pending',reflected_at=now(),source_context=public.gea_peet_source_task(v_source_id),version=version+1
 where id=p_task_id returning * into v_task;
 return v_task;
end $$;

create or replace function public.evaluate_officer_task(
  p_task_id uuid, p_efficiency numeric, p_effectiveness numeric, p_time numeric,
  p_feedback text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks;
begin
  if auth.uid() is null or not public.is_peet_admin() then raise exception 'PEET reviewer access is required.'; end if;
  if p_efficiency is null or p_efficiency not between 1 and 4
    or p_effectiveness is null or p_effectiveness not between 1 and 4
    or p_time is null or p_time not between 1 and 4 then
    raise exception 'Each PEET score must be between 1.0 and 4.0.';
  end if;
  if p_feedback is null or length(p_feedback) > 10000 then raise exception 'Feedback must be at most 10,000 characters.'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or v_task.status not in ('submitted', 'completed') then
    raise exception 'Only submitted or completed tasks can be evaluated.';
  end if;
  if v_task.individual_peet then raise exception 'Evaluate each participant contribution separately.'; end if;
  insert into public.peet_evaluations(task_id, evaluated_by, efficiency, effectiveness, time, feedback_notes)
    values(p_task_id, auth.uid(), p_efficiency, p_effectiveness, p_time, p_feedback)
    on conflict(task_id) where officer_id is null do update set evaluated_by = excluded.evaluated_by,
      efficiency = excluded.efficiency, effectiveness = excluded.effectiveness,
      time = excluded.time, feedback_notes = excluded.feedback_notes, evaluated_at = now();
  update public.tasks set status = 'completed', completed_at = coalesce(completed_at, now()) where id = p_task_id;
end;
$$;


create or replace function public.evaluate_officer_contribution(
 p_task_id uuid,p_officer_id uuid,p_version integer,p_efficiency numeric,p_effectiveness numeric,p_time numeric,p_feedback text default ''
) returns void language plpgsql security definer set search_path='' as $$
declare v_source public.tasks; v_contribution public.gea_peet_tasks; begin
 select * into v_source from public.tasks where id=p_task_id for update;
 if not found or not v_source.individual_peet or not public.gea_peet_can_review(p_task_id) or v_source.cancelled_at is not null
 or v_source.status not in ('submitted','completed') then raise exception 'Independent contribution review required.'; end if;
 if p_officer_id<>v_source.assigned_to and not exists(select 1 from public.officer_task_members where task_id=p_task_id and officer_id=p_officer_id) then raise exception 'This officer is not on the task.'; end if;
 select * into v_contribution from public.gea_peet_tasks where task_id=p_task_id and student_id=p_officer_id for update;
 if not found or v_contribution.status not in ('pending','approved') or v_contribution.version is distinct from p_version then raise exception 'The officer must submit their own reflection before evaluation.'; end if;
 if p_efficiency is null or p_efficiency not between 1 and 4 or round(p_efficiency,1)<>p_efficiency
 or p_effectiveness is null or p_effectiveness not between 1 and 4 or round(p_effectiveness,1)<>p_effectiveness
 or p_time is null or p_time not between 1 and 4 or round(p_time,1)<>p_time
 or p_feedback is null or length(p_feedback)>10000 then raise exception 'Enter valid PEET scores and feedback.'; end if;
 insert into public.peet_evaluations(task_id,officer_id,evaluated_by,efficiency,effectiveness,time,feedback_notes)
 values(p_task_id,p_officer_id,auth.uid(),p_efficiency,p_effectiveness,p_time,p_feedback)
 on conflict(task_id,officer_id) do update set evaluated_by=excluded.evaluated_by,efficiency=excluded.efficiency,
 effectiveness=excluded.effectiveness,time=excluded.time,feedback_notes=excluded.feedback_notes,evaluated_at=now();
 update public.gea_peet_tasks set status='approved',approved_scores=jsonb_build_object('efficiency',p_efficiency,'effectiveness',p_effectiveness,'time',p_time),
 approved_by=auth.uid(),approved_at=now(),version=version+1 where id=v_contribution.id;
 if not exists(select 1 from (select v_source.assigned_to officer_id union select officer_id from public.officer_task_members where task_id=p_task_id) people
 where not exists(select 1 from public.peet_evaluations e where e.task_id=p_task_id and e.officer_id=people.officer_id)) then
  update public.tasks set status='completed',completed_at=coalesce(completed_at,now()) where id=p_task_id;
 end if;
end $$;
-- Prevent old/manual group writes from silently awarding every collaborator.
create or replace function public.guard_individual_peet_evaluation()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.officer_id is null and exists(select 1 from public.tasks where id=new.task_id and individual_peet) then
  raise exception 'This collaboration requires individual contribution evaluations.';
 end if;
 if tg_op='UPDATE' and (new.officer_id is distinct from old.officer_id or new.task_id is distinct from old.task_id) then raise exception 'Evaluation identity cannot change.'; end if;
 return new;
end $$;
drop trigger if exists individual_peet_evaluation_guard on public.peet_evaluations;
create trigger individual_peet_evaluation_guard before insert or update on public.peet_evaluations for each row execute function public.guard_individual_peet_evaluation();


create or replace function public.approve_gea_peet_task(
 p_task_id uuid,p_version integer,p_scores jsonb,p_override_reason text default ''
) returns public.gea_peet_tasks language plpgsql security definer set search_path='' as $$
declare v_task public.gea_peet_tasks; v_source public.tasks; v_source_id uuid; v_eff numeric; v_effect numeric; v_time numeric; v_changed boolean; begin
 select task_id into v_source_id from public.gea_peet_tasks where id=p_task_id;
 select * into v_source from public.tasks where id=v_source_id for update;
 select * into v_task from public.gea_peet_tasks where id=p_task_id for update;
 if not found or not public.gea_peet_can_review(v_source_id) then raise exception 'An independent authorized reviewer is required.'; end if;
 if v_task.status='approved' then return v_task; end if;
 if v_task.status<>'pending' or v_task.version is distinct from p_version or v_task.recommendation is null
 or v_task.reviewed_by is distinct from auth.uid() or v_task.questions_by is distinct from auth.uid()
 or v_source.status<>'submitted' or v_source.cancelled_at is not null then raise exception 'Complete the reviewer questions and AI scoring before approval.'; end if;
 if public.gea_peet_source_task(v_source_id) is distinct from v_task.source_context then raise exception 'Task changed. Generate fresh reviewer questions.'; end if;
 if p_scores is null or jsonb_typeof(p_scores)<>'object' or (p_scores-'efficiency'-'effectiveness'-'time')<>'{}'::jsonb
 or jsonb_typeof(p_scores->'efficiency') is distinct from 'number' or jsonb_typeof(p_scores->'effectiveness') is distinct from 'number' or jsonb_typeof(p_scores->'time') is distinct from 'number'
 then raise exception 'Enter all three PEET scores.'; end if;
 v_eff:=(p_scores->>'efficiency')::numeric; v_effect:=(p_scores->>'effectiveness')::numeric; v_time:=(p_scores->>'time')::numeric;
 if v_eff not between 1 and 4 or v_effect not between 1 and 4 or v_time not between 1 and 4 or round(v_eff,1)<>v_eff or round(v_effect,1)<>v_effect or round(v_time,1)<>v_time then raise exception 'Scores must be 1.0–4.0 in increments of 0.1.'; end if;
 v_changed:=p_scores is distinct from (v_task.recommendation-'justification');
 if p_override_reason is null or length(p_override_reason)>2000 or (v_changed and length(btrim(p_override_reason))=0) then raise exception 'Explain changed scores.'; end if;
 -- Use the SAME evaluation function and table as manual PEET scoring.
 if v_source.individual_peet then
 perform public.evaluate_officer_contribution(v_source_id,v_task.student_id,v_task.version,v_eff,v_effect,v_time,
  (v_task.recommendation->>'justification')||case when v_changed then E'\nReviewer adjustment: '||btrim(p_override_reason) else '' end);
 else
 perform public.evaluate_officer_task(v_source_id,v_eff,v_effect,v_time,(v_task.recommendation->>'justification')||case when v_changed then E'\nReviewer adjustment: '||btrim(p_override_reason) else '' end);
 end if;
 update public.gea_peet_tasks set status='approved',approved_scores=p_scores,approved_by=auth.uid(),approved_at=now(),
 override_reason=case when v_changed then btrim(p_override_reason) else '' end,version=version+1 where id=p_task_id returning * into v_task;
 return v_task;
end $$;


create or replace function public.gea_peet_my_open_tasks()
returns table(id uuid,title text) language sql stable security definer set search_path='' as $$
 select t.id,t.title from public.tasks t where public.has_officer_access() and public.is_officer_task_participant(t.id)
 and t.cancelled_at is null and t.status in ('in_progress','submitted')
 and not exists(select 1 from public.gea_peet_tasks a where a.task_id=t.id and a.student_id=auth.uid());
$$;
create or replace function public.gea_peet_my_reviews()
returns setof public.gea_peet_tasks language sql stable security definer set search_path='' as $$
 select a.* from public.gea_peet_tasks a where public.has_officer_access() and a.student_id=auth.uid();
$$;
revoke all on function public.mark_individual_shared_task(),public.guard_individual_peet_evaluation(),
 public.evaluate_officer_contribution(uuid,uuid,integer,numeric,numeric,numeric,text),
 public.save_gea_peet_contribution_assessment(uuid,uuid,text,text,jsonb,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.evaluate_officer_contribution(uuid,uuid,integer,numeric,numeric,numeric,text) to authenticated;
grant execute on function public.save_gea_peet_contribution_assessment(uuid,uuid,text,text,jsonb,jsonb,text,text,text) to service_role;
create or replace function public.guard_officer_task_members()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; v_task_id uuid; begin
 if tg_op='UPDATE' then raise exception 'Remove and add a participant instead of changing membership identity.'; end if;
 if tg_op='DELETE' then v_task_id:=old.task_id; else v_task_id:=new.task_id; end if;
 select * into v_task from public.tasks where id=v_task_id for update;
 if not public.has_officer_access() or not found or v_task.created_by<>auth.uid() or (v_task.assigned_to<>auth.uid() and not public.is_peet_admin())
  or v_task.status<>'in_progress' or v_task.cancelled_at is not null then
  raise exception 'Only the creator can change people on their own in-progress task.';
 end if;
 if tg_op='INSERT' then
  if new.officer_id=v_task.assigned_to or not public.is_task_officer(new.officer_id) then
   raise exception 'Choose another active officer. Teachers and advisors cannot join officer tasks.';
  end if;
  return new;
 end if;
 return old;
end $$;

create or replace function public.assign_officer_collaboration(p_title text,p_description text,p_due_date date,p_people uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_people uuid[]; begin
 if not public.has_officer_access() or not public.is_peet_admin() then raise exception 'Reviewer access is required.'; end if;
 select array_agg(i order by i) into v_people from (select distinct i from unnest(p_people) i) people;
 if v_people is null or cardinality(v_people) not between 2 and 100 or exists(select 1 from unnest(v_people) i where i is null or not public.is_task_officer(i)) then raise exception 'Choose two or more active officers for this collaboration.'; end if;
 v_id:=public.save_officer_task(p_title,p_description,p_due_date,v_people[1],null);
 insert into public.officer_task_members(task_id,officer_id) select v_id,i from unnest(v_people) i where i<>v_people[1];
 update public.tasks set individual_peet=true where id=v_id;
 return v_id;
end $$;
revoke all on function public.assign_officer_collaboration(text,text,date,uuid[]) from public,anon,authenticated;
grant execute on function public.assign_officer_collaboration(text,text,date,uuid[]) to authenticated;

-- Keep removal-review snapshots scoped to the officer whose work was scored.
do $upgrade$ begin
 if to_regprocedure('public.decide_officer_strike(uuid,text,text)') is not null then
 execute $definition$create or replace function public.decide_officer_strike(p_strike_id uuid,p_status text,p_notes text)
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
      'peet_score',(select avg((e.efficiency+e.effectiveness+e.time)/3)/4*100 from public.peet_evaluations e join public.tasks t on t.id=e.task_id where (e.officer_id=v_strike.officer_id or (e.officer_id is null and (t.assigned_to=v_strike.officer_id or exists(select 1 from public.officer_task_members m where m.task_id=t.id and m.officer_id=v_strike.officer_id)))) and (e.officer_id is not null or t.status='completed') and t.cancelled_at is null)) into v_context;
    insert into public.officer_removal_reviews(officer_id,academic_year,category,context_snapshot)
      values(v_strike.officer_id,v_strike.academic_year,v_strike.category,v_context) on conflict(officer_id,academic_year,category)
      do update set status='pending',context_snapshot=excluded.context_snapshot,advisor_notes='',decided_by=null,decided_at=null;
  end if;
end $$;$definition$;
 end if;
end $upgrade$;

commit;
