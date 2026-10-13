-- Run only against a disposable empty PostgreSQL database (NOT your Supabase project):
-- psql -v ON_ERROR_STOP=1 -f tests/builders.sql
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create table auth.users(id uuid primary key);
create table public.admins(auth_user_id uuid primary key references auth.users, name text);
create function public.is_admin() returns boolean language sql security definer set search_path = public as $$ select exists(select 1 from public.admins where auth_user_id = auth.uid()) $$;
create table public.student_profiles(id uuid primary key, auth_user_id uuid references auth.users, full_name text);
alter table public.student_profiles enable row level security;
create policy profile_read on public.student_profiles for select to authenticated using (auth_user_id = auth.uid() or public.is_admin());
grant select on public.student_profiles to authenticated;
\ir ../supabase/builders.sql
-- Reapplying must preserve records and permissions.
\ir ../supabase/builders.sql
begin;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'), ('33333333-3333-3333-3333-333333333333'), ('44444444-4444-4444-4444-444444444444');
insert into public.admins values ('11111111-1111-1111-1111-111111111111', 'Officer');
insert into public.student_profiles values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','Student A'), ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','33333333-3333-3333-3333-333333333333','Student B');
create function public.test_assert(p_ok boolean, p_message text) returns void language plpgsql as $$ begin if p_ok is distinct from true then raise exception 'FAIL: %', p_message; end if; end $$;
create function public.test_denied(p_sql text) returns void language plpgsql as $$ begin
  begin execute p_sql; raise exception 'FAIL: unauthorized operation succeeded: %', p_sql;
  exception when insufficient_privilege or raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
end $$;

do $$
declare project uuid; revision uuid; private_project uuid; further uuid; wall jsonb;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
  project := public.submit_builder_project('Organizer','school','Messy supplies','Reused box','Measurement','Solo','https://drive.google.com/file/d/test/view',false);
  perform public.test_assert((select count(*) = 1 from public.builder_submissions), 'Student sees own project');
  perform public.test_assert((select points = 0 and wall_hidden from public.builder_submissions where id = project), 'Starts with zero points and hidden story');
  perform public.test_denied(format('update public.builder_submissions set status = %L where id = %L', 'approved', project));
  perform public.test_denied(format('insert into public.builder_recognitions(student_id,threshold) values (%L,10)','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
  perform public.test_denied(format('select public.review_builder_project(%L,%L,%L,true,true,true,true)', project,'approved','Forged'));
  perform public.test_denied('select public.submit_builder_project(''Bad'', ''home'', ''p'', ''b'', ''s'', ''Solo'', ''https://drive.google.com.evil.test/video'', false)');
  perform public.test_denied('select public.submit_builder_project('' '', ''home'', ''p'', ''b'', ''s'', ''Solo'', ''https://drive.google.com/file/d/test/view'', false)');

  perform set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
  perform public.test_assert((select count(*) = 0 from public.builder_submissions), 'Student B cannot read Student A');
  perform public.test_denied(format('select public.set_builder_privacy(%L,true)',project));
  perform public.test_denied(format('select public.submit_builder_project(''Hijack'',''home'',''p'',''b'',''s'',''Solo'',''https://drive.google.com/file/d/test/view'',false,%L)',project));

  perform set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
  perform public.test_assert((select count(*) = 0 from public.builder_submissions), 'Unapproved account cannot read');
  perform public.test_denied('select public.submit_builder_project(''Test'',''home'',''p'',''b'',''s'',''Solo'',''https://drive.google.com/file/d/test/view'',false)');
  perform public.test_denied(format('select public.review_builder_project(%L,%L,%L,true,true,true,true)', project,'approved','Forged'));

  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
  perform public.test_assert((select count(*) = 1 from public.builder_submissions), 'Officer can read all');
  perform public.test_denied(format('select public.review_builder_project(%L,%L,%L,false,false,false,false)',project,'needs_changes',' '));
  perform public.review_builder_project(project,'needs_changes','Please test it.',false,false,false,false);
  perform public.test_denied(format('select public.review_builder_project(%L,%L,%L,true,true,true,true)', project,'approved','Second review'));

  perform set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
  perform public.test_denied(format('select public.submit_builder_project(''Hijack'',''home'',''p'',''b'',''s'',''Solo'',''https://drive.google.com/file/d/test/view'',false,%L)',project));
  perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
  revision := public.submit_builder_project('Tested organizer','school','Messy supplies','Reused and tested box','Measurement','Solo','https://drive.google.com/file/d/test/view',false,project);
  perform public.test_assert((select count(*) = 2 from public.builder_submissions), 'Revision preserves earlier submission');
  perform public.test_assert((select officer_note = 'Please test it.' and status = 'needs_changes' from public.builder_submissions where id = project), 'Earlier feedback preserved');
  perform public.test_denied(format('select public.submit_builder_project(''Duplicate'',''home'',''p'',''b'',''s'',''Solo'',''https://drive.google.com/file/d/test/view'',false,%L)',project));

  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
  perform public.review_builder_project(revision,'approved','Private feedback',true,true,true,true);
  perform public.test_assert((select sum(points) = 25 from public.builder_submissions), 'Rubric totals exactly 25, revisions not double-counted');
  perform public.test_assert((select count(*) = 0 from public.get_builder_wall()), 'Approval does not publish unedited content');
  perform public.edit_builder_story(revision,'Alex','Organizer','Messy supplies','Reused box',false);
  perform public.set_builder_recognition('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',10,true,false);
  perform public.test_assert((select certificate and not shoutout from public.builder_recognitions), 'Recognition recorded');
  perform public.test_denied('select public.set_builder_recognition(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'',30,true,true)');
  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub','',true);
  perform public.test_denied('select * from public.builder_submissions');
  perform public.test_denied('select * from public.builder_recognitions');
  perform public.test_denied('select public.submit_builder_project(''Test'',''home'',''p'',''b'',''s'',''Solo'',''https://drive.google.com/file/d/test/view'',false)');
  select to_jsonb(w) into wall from public.get_builder_wall() w;
  perform public.test_assert(wall is not null and wall->>'first_name' = 'Alex', 'Public story readable');
  perform public.test_assert((select array_agg(k order by k) = array['build','first_name','id','location','problem','title'] from jsonb_object_keys(wall) k), 'Public projection has no email, points, video, feedback, or student ID');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
  perform public.set_builder_privacy(revision,true);
  perform public.test_assert((select count(*) = 0 from public.get_builder_wall()), 'Opt-out removes public story');
  perform public.test_assert((select sum(points) = 25 from public.builder_submissions), 'Privacy does not affect points');
  perform public.set_builder_privacy(revision,false);
  perform public.test_assert((select count(*) = 0 from public.get_builder_wall()), 'Opt-in does not automatically republish');
  private_project := public.submit_builder_project('Private build','home','p','b','s','Solo','https://drive.google.com/file/d/test/view',true);
  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
  perform public.review_builder_project(private_project,'approved','Nice work',true,true,false,false);
  perform public.test_assert((select points = 15 from public.builder_submissions where id = private_project), 'Partial rubric score');
  perform public.test_denied(format('select public.edit_builder_story(%L,''Alex'',''Private build'',''p'',''b'',false)',private_project));
  perform public.edit_builder_story(revision,'Alex','Organizer','Messy supplies','Reused box',false);
  perform public.edit_builder_story(revision,'Alex','Organizer','Messy supplies','Reused box',true);
  perform public.test_assert((select count(*) = 0 from public.get_builder_wall()), 'Officer hide removes story');
  perform public.set_builder_recognition('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',30,true,true);
  execute 'reset role';
  delete from public.admins where auth_user_id = '11111111-1111-1111-1111-111111111111';
  execute 'set local role authenticated';
  perform public.test_assert((select count(*) = 0 from public.builder_submissions), 'Removed officer loses private access');
  perform public.test_denied(format('select public.edit_builder_story(%L,''Alex'',''Organizer'',''p'',''b'',false)',revision));
  perform public.test_denied('select public.set_builder_recognition(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'',10,true,true)');
  execute 'reset role';
  raise notice 'Builders tests passed: identity, RLS, forged writes, revisions, rubric points, public privacy, wall moderation, recognition, and officer removal.';
end $$;
rollback;
