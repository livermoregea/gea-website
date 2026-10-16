-- Run after officer-task-reviewer-management.sql.
begin;
-- Both operations run in one transaction: invalid scores or reviewer permissions
-- roll back the completion, audit entries, and cancellation-request resolution.
create or replace function public.end_officer_task_with_evaluation(
 p_task_id uuid,p_notes text,p_efficiency numeric,p_effectiveness numeric,p_time numeric
) returns void language plpgsql security definer set search_path='' as $$ begin
 perform public.end_officer_task(p_task_id,p_notes);
 perform public.evaluate_officer_task(p_task_id,p_efficiency,p_effectiveness,p_time,p_notes);
end $$;
revoke all on function public.end_officer_task_with_evaluation(uuid,text,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.end_officer_task_with_evaluation(uuid,text,numeric,numeric,numeric) to authenticated;
commit;
