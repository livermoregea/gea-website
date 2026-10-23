-- Run after officer-individual-contributions.sql. Admin removal across task surfaces.
begin;
create or replace function public.guard_officer_task_editing()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); begin
 if tg_op='INSERT' then new.original_due_date:=new.due_date; return new; end if;
 -- Admin participant removal may transfer the primary role to a remaining teammate.
 -- Keep every other task field unchanged, including creator and original deadline.
 if new.assigned_to is distinct from old.assigned_to
  and public.has_officer_access() and public.is_peet_admin()
  and old.status in ('in_progress','submitted') and old.cancelled_at is null
  and (to_jsonb(new)-'assigned_to')=(to_jsonb(old)-'assigned_to')
  and exists(select 1 from public.officer_task_members where task_id=old.id and officer_id=new.assigned_to) then
  return new;
 end if;
 if new.assigned_to is distinct from old.assigned_to and exists(select 1 from public.officer_task_members where task_id=old.id) then
  raise exception 'Shared tasks keep their creator as the primary officer.';
 end if;
 if new.original_due_date is distinct from old.original_due_date or new.created_by is distinct from old.created_by then
  raise exception 'The original deadline and task creator cannot be changed.';
 end if;
 if new.title is distinct from old.title or new.description is distinct from old.description
  or new.due_date is distinct from old.due_date or new.assigned_to is distinct from old.assigned_to then
  if old.created_by=v_actor and old.assigned_to<>v_actor and not public.is_peet_admin() then
   raise exception 'You are no longer assigned to this task.';
  end if;
  if v_actor is null or not public.has_officer_access() or (old.created_by<>v_actor and not (public.is_peet_admin() and not public.is_officer_task_participant(old.id))) then
   raise exception 'Only the assigner or a reviewer can edit this task.';
  end if;
  if old.status='completed' or (old.created_by=old.assigned_to and old.status<>'in_progress' and not (public.is_peet_admin() and not public.is_officer_task_participant(old.id))) then
   raise exception 'This task can no longer be edited.';
  end if;
  if old.created_by=old.assigned_to and not (public.is_peet_admin() and not public.is_officer_task_participant(old.id)) then
   if new.title is distinct from old.title or new.assigned_to is distinct from old.assigned_to then
    raise exception 'For self-created tasks, only the description and deadline can be edited.';
   end if;
   if new.due_date is distinct from old.due_date and
    (old.original_due_date is null or new.due_date is null or abs(new.due_date-old.original_due_date)>3) then
    raise exception 'The deadline must stay within three days of its original date and cannot be added or removed.';
   end if;
  end if;
 end if;
 return new;
end $$;

create or replace function public.guard_officer_task_members()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; v_task_id uuid; begin
 if tg_op='UPDATE' then raise exception 'Remove and add a participant instead of changing membership identity.'; end if;
 if tg_op='DELETE' then v_task_id:=old.task_id; else v_task_id:=new.task_id; end if;
 select * into v_task from public.tasks where id=v_task_id for update;
 -- Admins may remove participants from any open shared task, including
 -- collaborations assigned by someone else and tasks awaiting review.
 if found and tg_op='DELETE' and public.has_officer_access() and public.is_peet_admin()
  and v_task.status in ('in_progress','submitted') and v_task.cancelled_at is null then
  return old;
 end if;
 if not public.has_officer_access() or not found or v_task.created_by<>auth.uid() or (v_task.assigned_to<>auth.uid() and not public.is_peet_admin())
  or v_task.status<>'in_progress' or v_task.cancelled_at is not null then
  raise exception 'Only the creator can change people on their own in-progress task.';
 end if;
 if tg_op='INSERT' then
  if new.officer_id=v_task.assigned_to or not public.is_task_officer(new.officer_id) then
   raise exception 'Choose another active officer. Teachers and advisors cannot join officer tasks.';
  end if;
  return new;
 end if;
 return old;
end $$;

create or replace function public.remove_officer_task_participant(p_task_id uuid,p_officer_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_task public.tasks; v_next uuid; begin
 if auth.uid() is null or not public.has_officer_access() or not public.is_peet_admin() then
  raise exception 'Admin access is required to remove a task participant.';
 end if;
 select * into v_task from public.tasks where id=p_task_id for update;
 if not found or v_task.cancelled_at is not null or v_task.status not in ('in_progress','submitted') then
  raise exception 'Participants can only be removed from an open task.';
 end if;
 if p_officer_id is null or (p_officer_id<>v_task.assigned_to and not exists(
  select 1 from public.officer_task_members where task_id=p_task_id and officer_id=p_officer_id)) then
  raise exception 'This officer is no longer on the task. Refresh and try again.';
 end if;
 if p_officer_id=v_task.assigned_to then
  select officer_id into v_next from public.officer_task_members where task_id=p_task_id order by added_at,officer_id limit 1;
  if v_next is null then raise exception 'Keep at least one participant on the task.'; end if;
  -- The task update and membership deletion are audited by the existing triggers.
  update public.tasks set assigned_to=v_next where id=p_task_id;
  delete from public.officer_task_members where task_id=p_task_id and officer_id=v_next;
 else
  delete from public.officer_task_members where task_id=p_task_id and officer_id=p_officer_id;
 end if;
 -- Finish a submitted collaboration if every remaining participant is already scored.
 if v_task.individual_peet and v_task.status='submitted' and not exists(
  select 1 from (select assigned_to officer_id from public.tasks where id=p_task_id
   union select officer_id from public.officer_task_members where task_id=p_task_id) people
  where not exists(select 1 from public.peet_evaluations e where e.task_id=p_task_id and e.officer_id=people.officer_id)
 ) then
  update public.tasks set status='completed',completed_at=coalesce(completed_at,now()) where id=p_task_id;
 end if;
 -- Contribution reflections and previously awarded scores remain historical records.
end $$;
revoke all on function public.remove_officer_task_participant(uuid,uuid) from public,anon,authenticated;
grant execute on function public.remove_officer_task_participant(uuid,uuid) to authenticated;
commit;
