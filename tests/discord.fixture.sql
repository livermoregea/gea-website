-- LOCAL DISPOSABLE POSTGRES ONLY. Requires an empty database.
\ir peet-ai.fixture.sql
reset role;
create table auth.identities(user_id uuid references auth.users(id),provider text,identity_data jsonb);
create or replace function public.can_read_officer_task(p_task_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.has_officer_access() and (public.is_peet_admin() or public.is_officer_task_participant(p_task_id)); $$;
alter table public.officer_task_members add constraint discord_fixture_members_key unique(task_id,officer_id);
\ir ../supabase/officer-accountability.sql
\ir ../supabase/officer-individual-contributions.sql
\ir ../supabase/discord.sql
\ir ../supabase/discord.sql
begin;
insert into auth.identities values ('11111111-1111-4111-8111-111111111111','discord','{"sub":"111111111111111111"}'),('33333333-3333-4333-8333-333333333333','discord','{"sub":"333333333333333333"}');
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.test_assert(public.bind_officer_discord(),'verified Discord identity binds');
select public.test_denied('select public.discord_action(''333333333333333333'',''me'')');
select public.test_denied('select public.claim_discord_jobs()');
select public.test_denied('insert into public.discord_jobs(id,kind,payload) values(''forged'',''interaction'',''{}'')');
select public.test_denied('update public.officer_profiles set discord_id=''333333333333333333''');
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
select public.test_assert(public.bind_officer_discord(),'advisor binds verified identity');
reset role;
update public.officer_profiles set position='Secretary' where id='11111111-1111-4111-8111-111111111111';
update public.officer_profiles set position='Treasurer' where id='22222222-2222-4222-8222-222222222222';
set role service_role;
select public.test_assert(public.discord_action('111111111111111111','me')->>'name'='Submitter','bridge uses linked officer');
select public.test_denied('select public.discord_action(''999999999999999999'',''me'')');
select public.test_denied('select public.discord_action(''111111111111111111'',''assign'',''{"officer":"333333333333333333","title":"Forgery"}'')');
select public.discord_action('333333333333333333','assign','{"officer":"111111111111111111","title":"Discord task","description":"Create reusable workshop materials"}','assignment-1') assigned \gset
select public.test_assert(public.discord_action('333333333333333333','assign','{"officer":"111111111111111111","title":"Duplicate"}','assignment-1')=:'assigned'::jsonb,'retry returns original assignment');
select public.test_assert((select count(*)=1 from public.tasks where title='Discord task'),'retry does not duplicate tasks');
select public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'task_id'=(:'assigned'::jsonb#>>'{}') and payload->>'assignee_position'='Secretary' and payload->>'assignee_name'='Submitter'),'assignment queues the receiving officer position and name once');
select public.discord_action('333333333333333333','assign','{"officer":"111111111111111111","title":"Committee task","channel":"777777777777777777"}','assignment-channel') committee \gset
select public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'task_id'=(:'committee'::jsonb#>>'{}') and payload->>'channel_id'='777777777777777777'),'explicit channel overrides the same durable receipt');
select public.test_denied('select public.discord_action(''333333333333333333'',''assign'',''{"officer":"111111111111111111","title":"Invalid channel task","channel":"bad"}'',''assignment-bad'')');
select public.test_assert(not exists(select 1 from public.tasks where title='Invalid channel task'),'invalid channel rolls back the assignment and receipt');
reset role;
update public.tasks set assigned_to='22222222-2222-4222-8222-222222222222' where id=(:'assigned'::jsonb#>>'{}')::uuid;
select public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'task_id'=(:'assigned'::jsonb#>>'{}') and payload->>'assignee_position'='Treasurer'),'website reassignment queues the new recipient even without status change');
set role service_role;

select public.test_denied('select public.save_discord_submission(''111111111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''work'',''javascript:alert(1)'')');
select public.save_discord_submission('111111111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Completed slides by the deadline with advisor guidance','https://example.com/slides');
select public.test_assert((select count(*)=1 from public.discord_submission_drafts),'evidence durable before AI');
select public.test_assert((select status='submitted' from public.tasks where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'existing submission workflow is used');
select public.test_assert((select count(*)>0 from public.discord_jobs where kind='notification'),'website mutations enqueue webhook outbox');
select public.test_denied('select public.discord_action(''111111111111111111'',''assessment'',''{"id":"ffffffff-ffff-4fff-8fff-ffffffffffff"}'')');
select count(*) claimed from public.claim_discord_jobs() \gset
select public.test_assert(:'claimed'::integer>0,'worker claims available jobs');
select public.test_assert((select count(*)=0 from public.claim_discord_jobs()),'leased jobs cannot be claimed twice');
do $$
declare flow public.gea_peet_tasks; context jsonb; result jsonb; begin
 context:=public.discord_action('111111111111111111','source','{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}');
 flow:=public.save_gea_peet_assessment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Completed slides','Media',context,
 '{"needsMoreInfo":true,"studentQuestions":["When did you finish?"],"initialAssessmentSummary":"Confirm timing"}','test','https://example.com/slides');
 result:=public.discord_action('111111111111111111','finalize',jsonb_build_object('id',flow.id,'version',flow.version,'answers',jsonb_build_array('Completed by the deadline.')),'finalize-1');
 perform public.test_assert(result->>'status'='pending','Discord finalization enters canonical review');
 perform public.test_denied(format('select public.discord_action(%L,%L,%L::jsonb)','111111111111111111','revision',jsonb_build_object('id',flow.id,'version',2,'feedback','Change my own review')));
 result:=public.discord_action('333333333333333333','revision',jsonb_build_object('id',flow.id,'version',2,'feedback','Please describe which slides you personally created.'),'revision-1');
 perform public.test_assert(result->>'status'='clarification','revision preserves evidence and returns to clarification');
 result:=public.discord_action('111111111111111111','finalize',jsonb_build_object('id',flow.id,'version',3,'answers',jsonb_build_array('I created all slides and finished by the deadline.')),'finalize-2');
 context:=public.discord_action('333333333333333333','source','{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}');
 flow:=public.save_gea_peet_review(flow.id,4,'33333333-3333-4333-8333-333333333333',context,'questions','{"reviewerQuestions":["Did goals match?","Was it on time?"],"reviewContextSummary":"Confirm quality and timing"}','','[]','test');
 flow:=public.save_gea_peet_review(flow.id,flow.version,'33333333-3333-4333-8333-333333333333',context,'score','{"efficiency":3,"effectiveness":3,"time":3,"justification":"Met agreed goals on time with appropriate resources."}','','["Yes","Yes"]','test');
 perform public.test_denied(format('select public.discord_action(%L,%L,%L::jsonb)','111111111111111111','approve',jsonb_build_object('id',flow.id,'version',flow.version,'scores',flow.recommendation-'justification')));
 result:=public.discord_action('333333333333333333','approve',jsonb_build_object('id',flow.id,'version',flow.version,'scores',flow.recommendation-'justification'),'approve-1');
 perform public.test_assert(result->>'status'='approved','one-click Discord approval saves canonical evaluation');
 perform public.test_assert((select count(*)=1 from public.peet_evaluations where task_id=flow.task_id),'approval awards exactly one evaluation');
 result:=public.discord_action('111111111111111111','score');
 perform public.test_assert(jsonb_array_length(result->'evaluations')=1,'score reads actual approved evaluations');
end $$;
reset role;
update public.officer_profiles set access_enabled=false where discord_id='111111111111111111';
set role service_role;
select public.test_denied('select public.discord_action(''111111111111111111'',''score'')');
reset role;
rollback;
select 'Discord SQL integration checks passed.';
