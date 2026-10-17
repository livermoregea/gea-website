-- Apply after gea-operations.sql. Keeps all existing meeting notes and agenda history.
begin;
create or replace function public.is_google_doc_url(p_url text)
returns boolean language sql immutable set search_path='' as $$
 select p_url is null or (length(p_url)<=2048 and strpos(p_url,chr(92))=0 and
 p_url ~ '^https://docs[.]google[.]com/document/(u/[0-9]+/)?d/(e/)?[A-Za-z0-9_-]+(/(edit|view|preview|pub|mobilebasic))?/?([?#][^[:space:]]*)?$');
$$;
alter table public.gea_meeting_notes add column if not exists agenda_doc_url text check(public.is_google_doc_url(agenda_doc_url));
alter table public.gea_meeting_notes add column if not exists notes_doc_url text check(public.is_google_doc_url(notes_doc_url));
create or replace function public.save_meeting_documents(p_event_id uuid,p_agenda_url text,p_notes_url text,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_agenda text:=nullif(btrim(p_agenda_url),''); v_notes text:=nullif(btrim(p_notes_url),''); begin
 if not public.can_manage_meetings() then raise exception 'Secretary or reviewer access is required.'; end if;
 perform 1 from public.officer_events where id=p_event_id and kind='meeting' and not cancelled for update;
 if not found then raise exception 'Select an active meeting.'; end if;
 if not public.is_google_doc_url(v_agenda) or not public.is_google_doc_url(v_notes) then raise exception 'Use a valid HTTPS Google Docs document link.'; end if;
 if p_version is null or coalesce((select version from public.gea_meeting_notes where event_id=p_event_id),0)<>p_version then
 raise exception 'Meeting documents changed in another session. Reload before saving.'; end if;
 insert into public.gea_meeting_notes(event_id,agenda_doc_url,notes_doc_url,updated_by)
 values(p_event_id,v_agenda,v_notes,auth.uid()) on conflict(event_id) do update
 set agenda_doc_url=excluded.agenda_doc_url,notes_doc_url=excluded.notes_doc_url,
 updated_by=auth.uid(),updated_at=now(),version=public.gea_meeting_notes.version+1;
end $$;
revoke all on function public.is_google_doc_url(text),public.save_meeting_documents(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.is_google_doc_url(text),public.save_meeting_documents(uuid,text,text,integer) to authenticated;
commit;
