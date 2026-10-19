-- LOCAL DISPOSABLE POSTGRESQL TEST ONLY; not a Supabase deployment script.
\ir peet-ai.fixture.sql
reset role;
create or replace function public.can_read_officer_task(p_task_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.has_officer_access() and (public.is_peet_admin() or public.is_officer_task_participant(p_task_id)); $$;
alter table public.officer_task_members add constraint contribution_fixture_members_key unique(task_id,officer_id);
\ir ../supabase/officer-individual-contributions.sql
\ir ../supabase/officer-individual-contributions.sql
create trigger task_members_guard before insert or update or delete on public.officer_task_members for each row execute function public.guard_officer_task_members();
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
select public.assign_officer_collaboration('Team workshop','Research and prepare the demonstration',null,array['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222']::uuid[]) collaboration \gset
select public.test_assert((select individual_peet and created_by='33333333-3333-4333-8333-333333333333' and assigned_to<>'33333333-3333-4333-8333-333333333333' from public.tasks where id=:'collaboration'),'assigner is not automatically a participant');
reset role;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select (public.save_gea_peet_contribution_assessment(:'collaboration','11111111-1111-4111-8111-111111111111','I researched the experiment','Outreach',public.gea_peet_source_task(:'collaboration'),'{"needsMoreInfo":true,"studentQuestions":["What did you contribute?"],"initialAssessmentSummary":"Describe your work"}','test-model','https://example.com/team-deliverable','Our workshop demonstration')).id a_contribution \gset
set role authenticated;
select public.finalize_gea_peet_task(:'a_contribution',1,'["I researched the experiment and tested it in one hour."]');
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.test_assert(not exists(select 1 from public.gea_peet_tasks where task_id=:'collaboration'),'teammate cannot read another officer reflection');
select public.test_denied(format('select public.evaluate_officer_contribution(%L,%L,2,4,4,4,%L)',:'collaboration','11111111-1111-4111-8111-111111111111','Cannot score my teammate'));
reset role;
select (public.save_gea_peet_contribution_assessment(:'collaboration','22222222-2222-4222-8222-222222222222','I designed the demonstration slides','Outreach',public.gea_peet_source_task(:'collaboration'),'{"needsMoreInfo":true,"studentQuestions":["How did you contribute?"],"initialAssessmentSummary":"Describe your work"}','test-model','https://example.com/team-deliverable','')).id b_contribution \gset
set role authenticated;
select public.finalize_gea_peet_task(:'b_contribution',1,'["I made the slides and practiced presenting for two hours."]');
reset role;
select public.test_assert((select final_product_url='https://example.com/team-deliverable' and submission_description='Our workshop demonstration' from public.tasks where id=:'collaboration'),'second reflection does not replace shared deliverable');
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
reset role;
select public.save_gea_peet_review(:'a_contribution',2,'33333333-3333-4333-8333-333333333333',public.gea_peet_source_task(:'collaboration'),'questions','{"reviewerQuestions":["Research quality?","On time?"],"reviewContextSummary":"Review this officer"}','Observed independent research','[]','test-model');
select public.save_gea_peet_review(:'a_contribution',3,'33333333-3333-4333-8333-333333333333',public.gea_peet_source_task(:'collaboration'),'score','{"efficiency":4,"effectiveness":3,"time":4,"justification":"Research contribution"}','Observed independent research','["Accurate research","Finished on time"]','test-model');
set role authenticated;
select public.approve_gea_peet_task(:'a_contribution',4,'{"efficiency":4,"effectiveness":3,"time":4}','');
select public.test_assert((select status='submitted' from public.tasks where id=:'collaboration'),'one evaluation does not finish teammates');
select public.test_assert((select count(*)=1 from public.peet_evaluations where task_id=:'collaboration'),'one evaluation does not score teammates');
select public.test_denied(format('select public.evaluate_officer_task(%L,3,3,3,%L)',:'collaboration','No group-wide score'));
select public.evaluate_officer_contribution(:'collaboration','22222222-2222-4222-8222-222222222222',2,2,3,2,'Design contribution evaluated independently');
select public.test_assert((select status='completed' from public.tasks where id=:'collaboration'),'task completes after every participant evaluation');
select public.test_assert((select count(distinct efficiency)=2 from public.peet_evaluations where task_id=:'collaboration'),'individual scores can differ');
select public.test_denied(format('select public.evaluate_officer_contribution(%L,%L,2,4,4,4,%L)',:'collaboration','22222222-2222-4222-8222-222222222222','Stale version cannot overwrite'));
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.test_assert((select count(*)=1 from public.peet_evaluations where task_id=:'collaboration'),'officer sees own evaluation only');
select public.test_assert((select count(*)=1 from public.gea_peet_tasks where task_id=:'collaboration'),'officer sees own reflection only');
select 'Shared deliverable / individual reflection and evaluation checks passed.';

set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.submit_officer_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','https://example.com/solo','Finished solo work');
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
select public.evaluate_officer_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',3,3,3,'Solo task unchanged');
select public.evaluate_officer_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',4,3,3,'Solo score correction unchanged');
select public.test_assert((select count(*)=1 and max(efficiency)=4 from public.peet_evaluations where task_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and officer_id is null),'legacy single-person evaluation and corrections still work');
