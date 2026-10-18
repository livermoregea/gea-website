-- ONE-TIME cleanup of the account whose exact display name is GEA TEST.
-- Run reset-test-tasks.sql FIRST, then run this ENTIRE file in the Supabase
-- SQL editor as postgres. Removes the Auth login, profiles, access grants,
-- and personal attendance/service/accountability records for this test user.
-- Also removes account-management audit entries targeting or made by this user.
-- Shared events, meeting content, and other users' records are preserved.
-- If shared records still require this account, everything rolls back and
-- the error identifies the dependency that needs reassignment first.
-- This is maintenance SQL, not a migration.

begin;
set local lock_timeout = '10s';

do $$
declare
  v_ids uuid[] := '{}'::uuid[];
  v_matches uuid[];
  v_id uuid;
  v_table text;
  v_column text;
  v_ref record;
  v_constraint text;
begin
  -- Match display names exactly (case-insensitive), never a partial name.
  -- Officers can have a reserved ID without an Auth account yet.
  foreach v_table in array array[
    'officer_profiles', 'student_profiles', 'teacher_profiles', 'admins'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      v_column := case when v_table = 'officer_profiles' then 'id' else 'auth_user_id' end;
      execute format(
        'select array_agg(%I) from public.%I p where lower(btrim(coalesce(to_jsonb(p)->>''full_name'', to_jsonb(p)->>''name'', ''''))) = ''gea test''',
        v_column, v_table
      ) into v_matches;
      v_ids := v_ids || coalesce(v_matches, '{}'::uuid[]);
    end if;
  end loop;

  select array_agg(id) into v_matches from auth.users
  where lower(btrim(coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''))) = 'gea test';
  v_ids := v_ids || coalesce(v_matches, '{}'::uuid[]);
  select array_agg(distinct candidate) into v_ids
  from unnest(v_ids) candidate where candidate is not null;
  if coalesce(cardinality(v_ids), 0) <> 1 then
    raise exception 'Expected exactly one GEA TEST account; found %. Nothing was deleted.', coalesce(cardinality(v_ids), 0);
  end if;
  v_id := v_ids[1];
  perform 1 from auth.users where id = v_id for update;
  perform 1 from public.officer_profiles where id = v_id for update;

  -- Delete only this officer's personal records, in dependency order.
  foreach v_table in array array[
    'officer_accountability_notes', 'officer_removal_reviews', 'officer_strikes',
    'officer_volunteer_logs', 'officer_event_signups', 'officer_attendance'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('delete from public.%I where officer_id = $1', v_table) using v_id;
    end if;
  end loop;
  if to_regclass('public.teacher_access_grants') is not null then
    delete from public.teacher_access_grants where auth_user_id = v_id;
  end if;
  -- Personal-record deletion triggers write audit entries; clear them afterward.
  if to_regclass('public.officer_tracking_audit') is not null then
    delete from public.officer_tracking_audit where officer_id = v_id or actor_id = v_id;
  end if;
  -- These references are NOT NULL and do not cascade on Auth deletion.
  -- Remove test-account audit entries without affecting unrelated entries.
  if to_regclass('public.account_management_audit') is not null then
    delete from public.account_management_audit where target_id = v_id or actor_id = v_id;
  end if;

  -- Clear optional attribution to this user on retained shared records.
  -- Never delete a shared row simply because this account created/reviewed it.
  for v_ref in
    select n.nspname as schema_name, t.relname as table_name, a.attname as column_name
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = t.oid and a.attnum = c.conkey[1]
    where c.contype = 'f' and n.nspname = 'public'
      and c.confrelid in ('auth.users'::regclass, 'public.officer_profiles'::regclass)
      and cardinality(c.conkey) = 1 and not a.attnotnull
      and c.confdeltype <> 'c'
  loop
    execute format('update %I.%I set %I = null where %I = $1',
      v_ref.schema_name, v_ref.table_name, v_ref.column_name, v_ref.column_name) using v_id;
  end loop;

  -- Auth cascades remove identities, sessions, and Auth-linked profiles/access.
  delete from auth.users where id = v_id;
  -- Also removes preregistered officers, who do not yet have an Auth login.
  delete from public.officer_profiles where id = v_id;
  if exists(select 1 from auth.users where id = v_id)
    or exists(select 1 from public.officer_profiles where id = v_id) then
    raise exception 'Account deletion did not complete.';
  end if;
  raise notice 'Removed GEA TEST account (%) and its sign-in access.', v_id;
exception when foreign_key_violation then
  get stacked diagnostics v_constraint = constraint_name;
  raise exception 'Nothing was deleted. GEA TEST still has dependent records (%). Run reset-test-tasks.sql first; reassign any remaining shared records before retrying.', v_constraint;
end $$;

commit;
