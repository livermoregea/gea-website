-- Apply after the existing officer migrations (and officer-strike-notifications.sql
-- when using automatic attendance strikes). Safe to reapply. Raw ratings and
-- historical review snapshots are preserved; current scores recalculate on load.
begin;
-- PEET scale v2: average raw 1–4 ratings first, then convert without rounding.
create or replace function public.peet_percentage(p_average numeric)
returns numeric language sql immutable strict parallel safe set search_path='' as $$
 select case when p_average <= 3 then 85 + 20 * (p_average - 3)
             else 85 + 15 * (p_average - 3) end;
$$;
revoke all on function public.peet_percentage(numeric) from public,anon,authenticated;
grant execute on function public.peet_percentage(numeric) to authenticated,service_role;

-- Update installed snapshot calculators, including projects without the new
-- automatic-strike migration. Function signatures and access controls are retained.
do $upgrade$
declare v_function record; v_definition text;
begin
 for v_function in
  select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('decide_officer_strike','open_officer_strike_review')
 loop
  v_definition:=pg_get_functiondef(v_function.oid);
  if position('avg((e.efficiency+e.effectiveness+e.time)/3)/4*100' in v_definition)>0 then
   execute replace(v_definition,'avg((e.efficiency+e.effectiveness+e.time)/3)/4*100',
    'public.peet_percentage(avg((e.efficiency+e.effectiveness+e.time)/3))');
  end if;
 end loop;
end $upgrade$;
commit;
