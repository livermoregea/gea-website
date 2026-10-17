-- Apply after gea-operations.sql and meeting-document-links.sql.
-- Retains existing staffing, supplies, recap, checklist, and audit records.
begin;
alter table public.gea_event_plans add column if not exists planning_doc_url text
 check(public.is_google_doc_url(planning_doc_url));

create or replace function public.save_event_planning_document(p_event_id uuid,p_organizer uuid,p_document_url text,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_url text:=nullif(btrim(p_document_url),''); begin
 if not public.has_officer_access() then raise exception 'Officer access required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind<>'meeting' and not cancelled for update;
 if not found then raise exception 'Select an active event or volunteer activity.'; end if;
 if not public.is_peet_admin() and not exists(select 1 from public.gea_event_plans where event_id=p_event_id and organizer_id=auth.uid()) then
 raise exception 'Only the organizer or a reviewer can edit this plan.'; end if;
 if p_organizer is not null and not public.is_task_officer(p_organizer) then raise exception 'Choose an active officer as organizer.'; end if;
 if not public.is_peet_admin() and p_organizer is distinct from auth.uid() then raise exception 'A reviewer must reassign the organizer.'; end if;
 if not public.is_google_doc_url(v_url) then raise exception 'Use a valid HTTPS Google Docs document link.'; end if;
 if p_version is null or coalesce((select version from public.gea_event_plans where event_id=p_event_id),0)<>p_version then
 raise exception 'Plan changed in another session. Reload before saving.'; end if;
 insert into public.gea_event_plans(event_id,organizer_id,planning_doc_url,updated_by)
 values(p_event_id,p_organizer,v_url,auth.uid()) on conflict(event_id) do update
 set organizer_id=excluded.organizer_id,planning_doc_url=excluded.planning_doc_url,
 version=public.gea_event_plans.version+1,updated_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.save_event_planning_document(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.save_event_planning_document(uuid,uuid,text,integer) to authenticated;
commit;
