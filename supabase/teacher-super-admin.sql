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
