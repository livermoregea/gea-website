-- Run after officer-task-editing.sql. Accept written work, a link, or both.
begin;
alter table public.tasks add column if not exists submission_description text not null default ''
 check(length(submission_description)<=10000);
-- Replace the original link-required submission constraint, preserving other checks.
do $$ declare v_constraint record; begin
 for v_constraint in select conname from pg_constraint
  where conrelid='public.tasks'::regclass and contype='c'
   and pg_get_constraintdef(oid) like '%final_product_url%'
   and pg_get_constraintdef(oid) like '%submitted_at%'
 loop
  execute format('alter table public.tasks drop constraint %I',v_constraint.conname);
 end loop;
end $$;
alter table public.tasks add constraint tasks_submission_evidence_check check(
 status='in_progress' or (submitted_at is not null and
 (final_product_url is not null or length(btrim(submission_description,E' \t\n\r'))>0))
);
create or replace function public.submit_officer_task(p_task_id uuid,p_url text,p_description text)
returns void language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; v_url text:=nullif(btrim(p_url),'');
 v_description text:=btrim(coalesce(p_description,''),E' \t\n\r'); begin
 if not public.has_officer_access() then raise exception 'Officer access is required.'; end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or (v_task.assigned_to<>auth.uid() and not public.is_peet_admin()) then
  raise exception 'Task not available.';
 end if;
 if v_task.cancelled_at is not null or v_task.status<>'in_progress' then
  raise exception 'This task can no longer be submitted.';
 end if;
 if length(v_description)>10000 then raise exception 'Keep the work description within 10,000 characters.'; end if;
 if v_url is not null and (length(v_url)>2048 or v_url !~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$') then
  raise exception 'Enter a valid HTTP or HTTPS link, or leave the link blank.';
 end if;
 if v_url is null and v_description='' then raise exception 'Describe the completed work or add a link.'; end if;
 update public.tasks set final_product_url=v_url,submission_description=v_description,
  status='submitted',submitted_at=now() where id=p_task_id;
end $$;
-- Keep existing link-only clients compatible without ambiguous default arguments.
create or replace function public.submit_officer_task(p_task_id uuid,p_url text)
returns void language sql security definer set search_path='' as $$
 select public.submit_officer_task(p_task_id,p_url,'');
$$;
revoke all on function public.submit_officer_task(uuid,text,text),public.submit_officer_task(uuid,text) from public,anon,authenticated;
grant execute on function public.submit_officer_task(uuid,text,text),public.submit_officer_task(uuid,text) to authenticated;
commit;
