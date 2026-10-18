-- ONE-TIME RESET: permanently deletes ALL officer tasks and PEET evaluations,
-- including AI clarification history, shared-task membership, cancellation
-- requests, and task help requests. Keeps accounts, meetings, agenda text,
-- attendance, service records, and the existing audit trail.
-- Run the ENTIRE file in the Supabase SQL editor as the postgres role.
-- This is maintenance SQL, not a migration; do not append it to schema.sql.

begin;
set local lock_timeout = '10s';

-- Prevent new assignments or concurrent submissions during the reset.
lock table public.tasks in access exclusive mode;

do $$
declare
  v_trigger record;
  v_table text;
  v_disabled jsonb := '[]'::jsonb;
begin
  -- Temporarily bypass only the two guards that prohibit this requested reset.
  -- Keep FK checks, other triggers, RLS, and their configuration intact.
  for v_trigger in
    select c.relname as table_name, t.tgname as trigger_name, t.tgenabled::text as mode
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal and t.tgenabled <> 'D'
      and ((c.relname = 'tasks' and t.tgname = 'task_followthrough_guard')
        or (c.relname = 'officer_task_members' and t.tgname = 'task_members_guard'))
  loop
    v_disabled := v_disabled || jsonb_build_array(to_jsonb(v_trigger));
    execute format('alter table public.%I disable trigger %I', v_trigger.table_name, v_trigger.trigger_name);
  end loop;

  -- Retain meeting agenda items; detach only their links to deleted tasks.
  if to_regclass('public.gea_agenda_items') is not null then
    update public.gea_agenda_items set task_id = null where task_id is not null;
  end if;

  -- Optional tables are skipped when their feature migration is not installed.
  foreach v_table in array array[
    'gea_peet_tasks',
    'gea_task_blockers',
    'officer_task_cancellation_requests',
    'officer_task_members',
    'peet_evaluations'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('delete from public.%I', v_table);
    end if;
  end loop;

  delete from public.tasks;

  -- Restore each guard's original enabled mode before committing.
  for v_trigger in
    select * from jsonb_to_recordset(v_disabled)
      as restored(table_name text, trigger_name text, mode text)
  loop
    execute format('alter table public.%I %s trigger %I',
      v_trigger.table_name,
      case v_trigger.mode when 'A' then 'enable always' when 'R' then 'enable replica' else 'enable' end,
      v_trigger.trigger_name);
  end loop;
end $$;

-- The reset and guard changes roll back together if any statement fails.
commit;

select
  (select count(*) from public.tasks) as tasks_remaining,
  (select count(*) from public.peet_evaluations) as evaluations_remaining;
