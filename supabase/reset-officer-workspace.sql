-- DESTRUCTIVE, ONE-TIME RESET. Run manually in the project's Supabase SQL editor.
-- Clears ALL officer workspace activity, including attendance/absence notices,
-- tasks, submissions, evaluations, volunteer records, and Discord queue/drafts.
-- No backup is made. Does not delete Discord messages or change accounts,
-- officer profiles, roles, Discord links, digest preferences, or unrelated
-- website content. Published volunteer events in this workspace are cleared.
-- Do not add this file to schema.sql or a deployment/migration runner.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  v_profiles_before bigint;
  v_users_before bigint;
  v_tables text;
  v_name text;
  v_remaining bigint;
  v_targets text[] := array[
    'discord_jobs', 'discord_actions', 'discord_form_drafts',
    'discord_submission_drafts', 'discord_roll_calls',
    'gea_peet_tasks', 'peet_evaluations', 'gea_peet_ai_requests',
    'officer_task_members', 'officer_task_cancellation_requests',
    'gea_task_blockers', 'gea_agenda_items', 'tasks',
    'public_volunteer_signups', 'officer_event_signups',
    'officer_volunteer_logs', 'officer_strikes', 'officer_removal_reviews',
    'officer_accountability_notes', 'officer_attendance', 'officer_cage_scores',
    'gea_meeting_notes', 'gea_event_plans', 'gea_event_checklist',
    'officer_events', 'public_volunteer_events', 'public_volunteer_events_legacy',
    'gea_notification_reads', 'gea_weekly_digests',
    'gea_geai_briefs', 'gea_geai_daily_usage', 'officer_tracking_audit'
  ];
begin
  if to_regclass('public.tasks') is null or to_regclass('public.officer_events') is null then
    raise exception 'Expected officer workspace tables are missing. Check the selected project.';
  end if;
  select count(*) into v_profiles_before from public.officer_profiles;
  select count(*) into v_users_before from auth.users;
  if to_regclass('public.discord_jobs') is not null then
    if exists(select 1 from public.discord_jobs where finished_at is null and not failed and leased_until > now()) then
      raise exception 'A Discord worker is active. Wait for its lease to finish, then rerun this reset.';
    end if;
  end if;

  -- Include only the named activity tables that are installed. A single
  -- TRUNCATE handles their mutual foreign keys atomically. No CASCADE: an
  -- unexpected external dependency causes a rollback, never a broader wipe.
  select string_agg(format('public.%I', target), ', ' order by target)
    into v_tables
    from unnest(v_targets) target
    where exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=target and c.relkind in ('r','p'));
  execute 'truncate table ' || v_tables || ' restart identity';

  foreach v_name in array v_targets loop
    if exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_name and c.relkind in ('r','p')) then
      execute format('select count(*) from public.%I', v_name) into v_remaining;
      if v_remaining <> 0 then raise exception 'Reset verification failed for %.', v_name; end if;
    end if;
  end loop;
  if (select count(*) from public.officer_profiles) <> v_profiles_before
    or (select count(*) from auth.users) <> v_users_before then
    raise exception 'Account preservation verification failed; resetting nothing.';
  end if;
end $$;

select 'tasks' as record_type, count(*) as remaining from public.tasks
union all select 'events', count(*) from public.officer_events
union all select 'attendance and absence notices', count(*) from public.officer_attendance
union all select 'volunteer logs', count(*) from public.officer_volunteer_logs
union all select 'PEET evaluations', count(*) from public.peet_evaluations
union all select 'officer profiles (preserved)', count(*) from public.officer_profiles;
commit;
