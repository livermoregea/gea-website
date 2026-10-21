-- Synthetic disposable local PostgreSQL only. Never run in a live project.
\ir discord-attendance.fixture.sql
reset role;
alter table auth.users add column email text;
alter table public.officer_task_members add column id uuid not null default gen_random_uuid();
\ir ../supabase/officer-task-followthrough.sql
\ir ../supabase/officer-shared-tasks.sql
\ir ../supabase/officer-individual-contributions.sql
\ir ../supabase/officer-event-service.sql
\ir ../supabase/meeting-document-links.sql
\ir ../supabase/event-planning-document.sql
\ir ../supabase/event-participant-assignments.sql
\ir ../supabase/discord-officer-workspace.sql
\ir ../supabase/discord-officer-workspace.sql
begin;
update public.officer_profiles set discord_id='111111111111111111',position='Secretary' where id='11111111-1111-4111-8111-111111111111';
update public.officer_profiles set discord_id='222222222222222222',position='Publicist' where id='22222222-2222-4222-8222-222222222222';
update public.officer_profiles set discord_id='333333333333333333' where id='33333333-3333-4333-8333-333333333333';
set role authenticated;
select public.test_denied('select public.discord_officer_action(''111111111111111111'',''hours'')');
select public.test_denied('select * from public.discord_officer_sessions');
set role service_role;
do $$
declare who text:='111111111111111111'; other text:='222222222222222222'; reviewer text:='333333333333333333';
 session jsonb; state jsonb; task uuid; ev uuid; meeting uuid; log uuid; result jsonb; version text; before_count integer; request_id uuid; agenda_id uuid; checklist_id uuid;
begin
 perform public.test_denied('select public.discord_officer_action(''999999999999999999'',''hours'')');
 session:=public.discord_officer_action(who,'team_start','{}','team-start');
 perform public.test_assert(public.discord_officer_action(who,'team_start','{}','team-start')->>'id'=session->>'id','team creation is idempotent');
 perform public.test_denied(format('select public.discord_officer_action(%L,%L,%L::jsonb)',other,'team_open',jsonb_build_object('session',session->>'id')));
 state:=public.discord_officer_action(who,'team_select',jsonb_build_object('session',session->>'id','version',1,'selected',jsonb_build_array('22222222-2222-4222-8222-222222222222')),'team-select');
 perform public.test_assert(jsonb_array_length(state->'state'->'people')=2,'ordinary creator stays on shared task');
 perform public.test_denied(format('select public.discord_officer_action(%L,%L,%L::jsonb)',who,'team_page',jsonb_build_object('session',session->>'id','version',1,'page',0)));
 perform public.save_discord_form(who,'officer:form:team:'||(session->>'id'),'{"title":"Preserve this task draft","description":"Keep all of this writing"}','123');
 update public.discord_officer_sessions set expires_at=now()-interval '1 day' where id=(session->>'id')::uuid;
 result:=public.discord_officer_action(who,'team_open',jsonb_build_object('session',session->>'id'));
 perform public.test_assert((result->>'expires_at')::timestamptz>now(),'owner can resume an expired draft without losing text');
 perform public.test_assert(public.discord_officer_action(who,'team_drafts')->'rows'->0->>'title'='Preserve this task draft','saved text is discoverable through draft recovery');
 update public.officer_profiles set discord_id=null where id='22222222-2222-4222-8222-222222222222';
 result:=public.discord_officer_action(who,'team_save',jsonb_build_object('session',session->>'id','title','Shared Discord task','description','Prepare the team demonstration','due',''),'team-save');
 task:=(result->>'id')::uuid;
 perform public.test_assert(public.discord_officer_action(who,'team_save',jsonb_build_object('session',session->>'id'),'team-save')=result,'retry does not create duplicate tasks');
 perform public.test_assert((select individual_peet from public.tasks where id=task),'shared creation uses canonical individual PEET');
 perform public.test_assert(exists(select 1 from public.discord_jobs where payload->>'task_id'=task::text and payload->>'assignee_position'='Publicist'),'teammate gets assignment receipt without a Discord identity lookup');
 update public.officer_profiles set discord_id=other where id='22222222-2222-4222-8222-222222222222';
 perform public.test_denied(format('select public.save_discord_contribution(%L,%L,%L,%L,%L)',who,task,'I made the slides','',''));
 perform public.save_discord_contribution(who,task,'I made the slides','','Our group delivered a demonstration.');
 perform public.save_discord_contribution(other,task,'I built the model','','');
 perform public.test_assert((select submission_description='Our group delivered a demonstration.' from public.tasks where id=task),'second personal contribution does not overwrite shared deliverable');
 perform public.test_assert((select notes='I built the model' from public.discord_submission_drafts where task_id=task and officer_id='22222222-2222-4222-8222-222222222222'),'teammate retains their own notes');
 perform public.save_discord_contribution(who,task,repeat('x',5000),'','');
 perform public.test_assert((select length(notes)=5000 from public.discord_submission_drafts where task_id=task and officer_id='11111111-1111-4111-8111-111111111111'),'full-length personal reflection survives');
 perform public.test_assert(jsonb_array_length(public.discord_officer_action(who,'tasks')->'rows')>0,'tasks are visible to participants');
 perform public.test_assert(jsonb_array_length(public.discord_officer_action(who,'task',jsonb_build_object('id',task))->'people')=2,'task details include its team');

 perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 ev:=public.save_officer_event('Discord service event','volunteer','2026-2027',now()-interval '3 hours',now()-interval '1 hour');
 meeting:=public.save_officer_event('Discord meeting','meeting','2026-2027',now()+interval '1 day',now()+interval '25 hours');
 perform public.discord_officer_action(who,'signup',jsonb_build_object('id',ev,'committed',true),'join-event');
 perform public.test_assert((select committed from public.officer_event_signups where event_id=ev and officer_id='11111111-1111-4111-8111-111111111111'),'event participation request uses website record');
 perform public.discord_officer_action(who,'signup',jsonb_build_object('id',ev,'committed',false),'leave-event');
 perform public.test_assert(not (select committed from public.officer_event_signups where event_id=ev and officer_id='11111111-1111-4111-8111-111111111111'),'participation withdrawal works');
 perform public.discord_officer_action(who,'signup',jsonb_build_object('id',ev,'committed',true),'request-again');
 select id into request_id from public.officer_event_signups where event_id=ev and officer_id='11111111-1111-4111-8111-111111111111';
 perform public.test_denied('select public.discord_officer_action(''222222222222222222'',''event_requests'')');
 result:=public.discord_officer_action(reviewer,'event_request',jsonb_build_object('id',request_id));
 perform public.discord_officer_action(reviewer,'assign_request',jsonb_build_object('id',request_id,'version',result->>'version'),'assign-request');
 perform public.test_assert((select assigned and committed from public.officer_event_signups where id=request_id),'reviewer assignment preserves the officer participation request');
 perform public.test_assert(exists(select 1 from public.discord_jobs where payload->>'topic'='event_assignment' and payload->>'event_id'=ev::text),'event assignment receipt is queued');
 perform public.test_assert(jsonb_array_length(public.discord_officer_action(reviewer,'event_requests')->'rows')=0,'assigned request leaves pending queue');
 perform public.discord_officer_action(who,'prepare_hours',jsonb_build_object('id',ev),'prepare-hours');
 perform public.test_assert(exists(select 1 from public.discord_form_drafts where discord_id=who and custom_id='officer:form:hours:'||ev),'actual service form has editable scheduled-time defaults');
 perform public.discord_officer_action(who,'log_hours',jsonb_build_object('id',ev,'check_in',to_char(now()-interval '3 hours','YYYY-MM-DD"T"HH24:MI:SS')||'+00:00','check_out',to_char(now()-interval '1 hour','YYYY-MM-DD"T"HH24:MI:SS')||'+00:00','notes','I led the demonstration.'),'log-hours');
 select id into log from public.officer_volunteer_logs where event_id=ev and officer_id='11111111-1111-4111-8111-111111111111';
 perform public.test_assert((public.discord_officer_action(who,'hours','{"year":"2026-2027"}')->>'verified_minutes')::integer=0,'pending hours never count as verified');
 perform public.test_assert(exists(select 1 from public.discord_jobs where payload->>'topic'='service_review' and payload->>'log_id'=log::text),'submission queues private reviewer notification');
 perform public.test_denied(format('select public.discord_officer_action(%L,%L,%L::jsonb)',other,'record',jsonb_build_object('kind','service','id',log)));
 perform public.test_denied('select public.discord_officer_action(''111111111111111111'',''review_logs'')');
 result:=public.discord_officer_action(reviewer,'review_log',jsonb_build_object('id',log)); version:=result->>'version';
 perform public.test_denied(format('select public.discord_officer_action(%L,%L,%L::jsonb)',reviewer,'verify_hours',jsonb_build_object('id',log,'version','stale')));
 perform public.discord_officer_action(reviewer,'verify_hours',jsonb_build_object('id',log,'version',version),'verify-hours');
 perform public.test_assert((public.discord_officer_action(who,'hours','{"year":"2026-2027"}')->>'verified_minutes')::integer=120,'only reviewer-verified actual minutes count');
 select count(*) into before_count from public.discord_jobs where payload->>'topic'='service_receipt';
 perform public.discord_officer_action(reviewer,'verify_hours',jsonb_build_object('id',log,'version',version),'verify-hours');
 perform public.test_assert((select count(*)=before_count from public.discord_jobs where payload->>'topic'='service_receipt'),'verification retry does not duplicate receipt');
 perform public.test_assert(exists(select 1 from public.discord_jobs where payload->>'topic'='service_receipt' and payload->>'status'='approved' and payload->>'minutes'='120'),'verified hours notification derives canonical duration');
 perform public.discord_officer_action(who,'agenda',jsonb_build_object('id',meeting,'title','Review outreach','details','Propose the next demonstration'),'agenda');
 perform public.discord_officer_action(who,'absence',jsonb_build_object('id',meeting,'notice','I may arrive late because of another appointment.'),'absence');
 perform public.test_assert((select absence_notice<>'' and status='unmarked' from public.officer_attendance where event_id=meeting and officer_id='11111111-1111-4111-8111-111111111111'),'notice uses website workflow without marking attendance');
 perform public.test_assert(jsonb_array_length(public.discord_officer_action(who,'event',jsonb_build_object('id',meeting))->'agenda')=1,'officers can add and read meeting agenda items');
 perform public.discord_officer_action(who,'documents',jsonb_build_object('id',meeting,'version',0,'agenda_url','https://docs.google.com/document/d/agenda123/edit','notes_url',''),'documents');
 result:=public.discord_officer_action(who,'event',jsonb_build_object('id',meeting));
 perform public.test_assert((select fields->>'agenda_url'='https://docs.google.com/document/d/agenda123/edit' from public.discord_form_drafts where discord_id=who and custom_id='officer:form:documents:'||meeting||':1'),'editing document links prefills current values');
 perform public.discord_officer_action(who,'record',jsonb_build_object('kind','meeting','id',meeting));
 perform public.test_denied(format('select public.discord_officer_action(%L,%L,%L::jsonb)',other,'documents',jsonb_build_object('id',meeting,'version',1,'agenda_url','','notes_url','')));
 select id into agenda_id from public.gea_agenda_items where event_id=meeting;
 session:=public.discord_officer_action(who,'team_start',jsonb_build_object('agenda',agenda_id),'agenda-team');
 state:=public.discord_officer_action(who,'team_select',jsonb_build_object('session',session->>'id','version',1,'selected',jsonb_build_array('22222222-2222-4222-8222-222222222222')),'agenda-select');
 perform public.test_assert(jsonb_array_length(state->'state'->'people')=1,'secretary selects one agenda assignee without being forced onto the task');
 result:=public.discord_officer_action(who,'team_save',jsonb_build_object('session',session->>'id','due',''),'agenda-save');
 perform public.test_assert((select task_id=(result->>'id')::uuid from public.gea_agenda_items where id=agenda_id),'secretary assigns canonical agenda action');
 perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 perform public.save_event_plan(ev,'11111111-1111-4111-8111-111111111111','','','',0);
 perform public.discord_officer_action(who,'plan',jsonb_build_object('id',ev,'version',1,'document_url','https://docs.google.com/document/d/plan123/edit'),'plan');
 perform public.discord_officer_action(who,'checklist_add',jsonb_build_object('id',ev,'title','Bring the model'),'checklist');
 select id into checklist_id from public.gea_event_checklist where event_id=ev;
 perform public.discord_officer_action(who,'checklist_toggle',jsonb_build_object('id',checklist_id,'done',true),'checklist-done');
 perform public.test_denied(format('select public.discord_officer_action(%L,%L,%L::jsonb)',other,'checklist_toggle',jsonb_build_object('id',checklist_id,'done',false)));
 perform public.test_assert((select done from public.gea_event_checklist where id=checklist_id),'only organizer/reviewer can change checklist');
 perform public.test_assert(jsonb_array_length(public.discord_officer_action(who,'checklist',jsonb_build_object('id',ev))->'rows')=1,'event checklist can be browsed');
 perform public.test_assert(jsonb_array_length(public.discord_officer_action(who,'agenda_items',jsonb_build_object('id',meeting))->'rows')=1,'complete agenda can be browsed');
 result:=public.discord_officer_action(who,'event',jsonb_build_object('id',ev));
 perform public.test_assert((result->>'can_plan')::boolean,'organizer has event planning controls');
 session:=public.discord_officer_action(who,'team_start','{}','personal-task');
 result:=public.discord_officer_action(who,'team_save',jsonb_build_object('session',session->>'id','title','Personal help task','description','First part ','description2','second part','due',''),'personal-save');
 task:=(result->>'id')::uuid;
 perform public.test_assert((select description='First part second part' from public.tasks where id=task),'split task fields preserve formatting at boundaries');
 perform public.discord_officer_action(who,'task_help',jsonb_build_object('id',task,'reason','Need help collecting materials','resolved',false),'help');
 perform public.discord_officer_action(who,'task_help',jsonb_build_object('id',task,'reason','Need help collecting materials','helper','22222222-2222-4222-8222-222222222222','resolved',false),'chosen-helper');
 perform public.discord_officer_action(reviewer,'task_requests');
 perform public.test_assert((select helper_id='22222222-2222-4222-8222-222222222222' from public.gea_task_blockers where task_id=task),'chosen helper is recorded without changing task membership');
 perform public.test_assert(jsonb_array_length(public.discord_officer_action(who,'helpers')->'rows')>0,'helper roster can be browsed');
 perform public.discord_officer_action(who,'task_help',jsonb_build_object('id',task,'reason','Materials collected now','resolved',true),'unblock');
 perform public.discord_officer_action(who,'task_cancel',jsonb_build_object('id',task,'reason','The event was replaced by a different activity.'),'cancel');
 perform public.test_assert(exists(select 1 from public.officer_task_cancellation_requests where task_id=task and status='pending'),'cancellation remains an independent reviewer decision');
 select id into request_id from public.officer_task_cancellation_requests where task_id=task;
 result:=public.discord_officer_action(reviewer,'task_request',jsonb_build_object('kind','cancellation','id',request_id));
 perform public.test_denied(format('select public.discord_officer_action(%L,%L,%L::jsonb)',who,'review_cancellation',jsonb_build_object('id',request_id,'version',result->>'version','status','approved','notes','Permission must be denied')));
 perform public.discord_officer_action(reviewer,'review_cancellation',jsonb_build_object('id',request_id,'version',result->>'version','status','approved','notes','Approved because the activity was replaced.'),'cancel-approved');
 perform public.test_assert((select cancelled_at is not null from public.tasks where id=task),'reviewer cancellation uses canonical task history instead of deleting work');
 perform public.discord_officer_action(who,'records','{"kind":"service"}');
 perform public.discord_officer_action(who,'records','{"kind":"conduct"}');
 perform public.discord_officer_action(who,'records','{"kind":"attendance"}');
 perform public.discord_officer_action(who,'digest','{"enabled":true}','digest');
 perform public.test_assert((select enabled from public.gea_digest_preferences where user_id='11111111-1111-4111-8111-111111111111'),'digest preference is shared with website');
end $$;
reset role;
rollback;
select 'Discord officer workspace integration checks passed.';
