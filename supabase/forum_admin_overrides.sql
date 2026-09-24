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
