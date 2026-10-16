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
