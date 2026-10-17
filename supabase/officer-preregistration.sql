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
