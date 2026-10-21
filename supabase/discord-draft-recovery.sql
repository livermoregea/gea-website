-- Existing installations: run after discord.sql and the officer task submission migrations.
-- Preserve malformed modal input; allow explanation-only Discord submissions.
begin;
-- Raw modal text is separate from validated submissions so even malformed
-- links and incomplete answers can be reopened without submitting the task.
create table if not exists public.discord_form_drafts (
 discord_id text not null,
 custom_id text not null check(length(custom_id) between 1 and 100),
 fields jsonb not null check(jsonb_typeof(fields)='object' and octet_length(fields::text)<=60000),
 interaction_id numeric(20,0) not null,
 updated_at timestamptz not null default now(),
 primary key(discord_id,custom_id)
);
alter table public.discord_form_drafts enable row level security;
revoke all on public.discord_form_drafts from public,anon,authenticated;
grant all on public.discord_form_drafts to service_role;
create or replace function public.save_discord_form(p_discord_id text,p_custom_id text,p_fields jsonb,p_interaction_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_saved boolean; begin
 if p_interaction_id !~ '^[0-9]{1,20}$' then raise exception 'Invalid interaction.'; end if;
 insert into public.discord_form_drafts(discord_id,custom_id,fields,interaction_id)
 values(p_discord_id,p_custom_id,p_fields,p_interaction_id::numeric)
 on conflict(discord_id,custom_id) do update set fields=excluded.fields,interaction_id=excluded.interaction_id,updated_at=now()
 where excluded.interaction_id>=public.discord_form_drafts.interaction_id returning true into v_saved;
 return coalesce(v_saved,false);
end $$;
revoke all on function public.save_discord_form(text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.save_discord_form(text,text,jsonb,text) to service_role;
create or replace function public.save_discord_submission(p_discord_id text,p_task_id uuid,p_notes text,p_url text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_source public.tasks; begin
 select id into v_actor from public.officer_profiles where discord_id=p_discord_id and access_enabled;
 if v_actor is null then raise exception 'Connect Discord first.'; end if;
 perform set_config('request.jwt.claim.sub',v_actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
 if not public.has_officer_access() or not public.is_officer_task_participant(p_task_id) then raise exception 'Submit your own task only.'; end if;
 select * into v_source from public.tasks where id=p_task_id for update;
 if not found or v_source.cancelled_at is not null or v_source.status not in ('in_progress','submitted') then raise exception 'Task unavailable.'; end if;
 p_url:=btrim(coalesce(p_url,''));
 if p_notes is null or length(btrim(p_notes)) not between 1 and 2000 then raise exception 'Describe your completed work.'; end if;
 if length(p_url)>2048 or (p_url<>'' and p_url !~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$') then raise exception 'Use a valid HTTP(S) link or leave the optional link blank.'; end if;
 insert into public.discord_submission_drafts(task_id,officer_id,notes,project_url) values(p_task_id,v_actor,p_notes,p_url)
 on conflict(task_id,officer_id) do update set notes=excluded.notes,project_url=excluded.project_url,updated_at=now();
 if v_source.status='in_progress' then perform public.submit_officer_task(p_task_id,p_url,p_notes); end if;
end $$;
revoke all on function public.save_discord_submission(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.save_discord_submission(text,uuid,text,text) to service_role;
commit;
