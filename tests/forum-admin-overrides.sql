-- Run only in a disposable empty PostgreSQL database:
-- psql -v ON_ERROR_STOP=1 -f tests/forum-admin-overrides.sql
begin;
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role', true) $$;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.users(id uuid primary key);
create table public.admins(auth_user_id uuid primary key references auth.users, name text);
create function public.is_admin() returns boolean language sql security definer as $$
  select exists(select 1 from public.admins where auth_user_id = auth.uid())
$$;
create table public.qa_questions (
  id uuid primary key default gen_random_uuid(), question text, asked_by_name text,
  asked_by_auth_user_id uuid, forum_board text not null check (forum_board in ('general', 'academics')),
  status text
);
create table public.qa_answers (
  id uuid primary key default gen_random_uuid(), question_id uuid references public.qa_questions,
  answer text, answered_by_name text, answered_by_auth_user_id uuid,
  parent_answer_id uuid references public.qa_answers, status text
);
create function public.qa_text_is_flagged(value text) returns boolean language sql as $$ select value ~* 'https?://|www\.' $$;
\ir ../supabase/forum_admin_overrides.sql
create trigger qa_questions_guard_content before insert or update on public.qa_questions
  for each row execute function public.guard_qa_question_content();
create trigger qa_answers_guard_content before insert or update on public.qa_answers
  for each row execute function public.guard_qa_answer_content();
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
insert into public.admins values ('11111111-1111-1111-1111-111111111111', 'Test Admin');

do $$
declare
  admin_id uuid := '11111111-1111-1111-1111-111111111111';
  post_id uuid;
  comment_id uuid;
  attempt integer;
begin
  if has_function_privilege('authenticated', 'public.publish_verified_forum_override(uuid,text,text,text,text,uuid,uuid)', 'execute') or
     has_function_privilege('anon', 'public.publish_verified_forum_override(uuid,text,text,text,text,uuid,uuid)', 'execute') or
     has_function_privilege('authenticated', 'public.claim_forum_override_attempt(uuid)', 'execute') then
    raise exception 'Browser roles can invoke privileged functions';
  end if;
  if has_table_privilege('authenticated', 'public.forum_override_audit', 'insert') or
     has_table_privilege('authenticated', 'public.forum_override_audit', 'update') or
     has_table_privilege('authenticated', 'public.forum_override_audit', 'delete') then
    raise exception 'Browser roles can tamper with audit';
  end if;
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('app.verified_forum_override', 'true', true);
  begin
    insert into public.qa_questions(question, forum_board) values ('www.example.com', 'general');
    raise exception 'FAIL: forged bypass flag accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.publish_verified_forum_override(admin_id, 'question', 'www.example.com', 'Approved announcement', 'general');
    raise exception 'FAIL: authenticated JWT accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('app.verified_forum_override', 'false', true);
  begin
    insert into public.qa_questions(question, forum_board) values ('www.example.com', 'general');
    raise exception 'FAIL: service role has blanket bypass';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.publish_verified_forum_override('22222222-2222-2222-2222-222222222222', 'question', 'www.example.com', 'Approved announcement', 'general');
    raise exception 'FAIL: non-admin accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  for attempt in 1..5 loop
    if not public.claim_forum_override_attempt(admin_id) then raise exception 'Valid attempt refused'; end if;
  end loop;
  if public.claim_forum_override_attempt(admin_id) then raise exception 'Rate limit not enforced'; end if;
  update public.forum_override_attempts set attempted_at = now() - interval '16 minutes';
  if not public.claim_forum_override_attempt(admin_id) then raise exception 'Rate limit did not expire'; end if;
  post_id := public.publish_verified_forum_override(admin_id, 'question', 'www.example.com', 'Approved announcement', 'general');
  comment_id := public.publish_verified_forum_override(admin_id, 'answer', 'www.example.com', 'Approved comment link', null, post_id);
  if (select count(*) from public.forum_override_audit) <> 2 then raise exception 'Missing audit'; end if;
  update public.qa_questions set status = 'approved' where id = post_id;
  update public.qa_answers set status = 'approved' where id = comment_id;
  if current_setting('app.verified_forum_override') <> 'false' then raise exception 'Bypass persisted'; end if;
  if not exists(select 1 from public.qa_questions where id = post_id and asked_by_auth_user_id = admin_id and asked_by_name = 'Test Admin' and status = 'approved') then
    raise exception 'Incorrect author or status';
  end if;
  begin
    perform public.publish_verified_forum_override(admin_id, 'answer', 'www.example.com', 'Approved comment link', null, post_id, gen_random_uuid());
    raise exception 'FAIL: invalid reply parent accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  if (select count(*) from public.forum_override_audit) <> 2 then raise exception 'Failed submission was audited as published'; end if;
  raise notice 'Database permission, rate-limit, publication, parent validation, and audit tests passed';
end;
$$;
rollback;
