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
