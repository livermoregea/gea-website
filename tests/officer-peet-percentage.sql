-- Disposable local PostgreSQL only, after officerboard.sql and officer-strike-notifications.sql tests.
-- Simulate an installed calculator that still uses the original percentage.
do $$ declare v_definition text; begin
 v_definition:=pg_get_functiondef('public.open_officer_strike_review()'::regprocedure);
 execute replace(v_definition,'public.peet_percentage(avg((e.efficiency+e.effectiveness+e.time)/3))',
  'avg((e.efficiency+e.effectiveness+e.time)/3)/4*100');
end $$;
\ir ../supabase/officer-peet-percentage.sql
\ir ../supabase/officer-peet-percentage.sql
begin;
do $$
declare v_task uuid; v_strike uuid; i integer;
begin
 perform public.test_assert(public.peet_percentage(null) is null,'Missing PEET remains missing');
 perform public.test_assert(public.peet_percentage(1)=45,'Rating 1 = 45');
 perform public.test_assert(public.peet_percentage(2)=65,'Rating 2 = 65');
 perform public.test_assert(public.peet_percentage(3)=85,'Meets expectations = 85');
 perform public.test_assert(public.peet_percentage(3.2)=88,'Decimal rating 3.2 = 88');
 perform public.test_assert(public.peet_percentage(3.5)=92.5,'Decimal rating 3.5 = 92.5');
 perform public.test_assert(public.peet_percentage(4)=100,'Maximum = 100');
 perform public.test_assert((select public.peet_percentage(avg(r))=85 from (values (2::numeric),(4::numeric)) t(r)),'Convert only after averaging raw ratings');
 perform public.test_assert(position('/4*100' in pg_get_functiondef('public.open_officer_strike_review()'::regprocedure))=0,'Installed trigger upgraded');
 insert into public.tasks(title,assigned_to,created_by,status,submitted_at,completed_at,final_product_url)
 values('PEET scale regression','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','completed',now(),now(),'https://example.com/work') returning id into v_task;
 insert into public.peet_evaluations(task_id,officer_id,evaluated_by,efficiency,effectiveness,time)
 values(v_task,'22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',3.5,3.5,3.5);
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 for i in 1..3 loop
  v_strike:=public.create_officer_strike('22222222-2222-2222-2222-222222222222','2026-2027','conduct',current_date,'Documented conduct regression incident',null);
 end loop;
 perform public.test_assert((select (context_snapshot->>'peet_score')::numeric=92.5 from public.officer_removal_reviews where officer_id='22222222-2222-2222-2222-222222222222' and academic_year='2026-2027' and category='conduct'),'New advisor review uses updated PEET scale');
 perform public.test_assert((select efficiency=3.5 and effectiveness=3.5 and time=3.5 from public.peet_evaluations where task_id=v_task),'Raw ratings preserved');
end $$;
rollback;
