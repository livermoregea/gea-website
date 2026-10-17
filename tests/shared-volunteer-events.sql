-- Disposable local fixture database after tests/public-volunteering.sql.
-- Seed a legacy event before conversion to verify existing records survive.
do $$ begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='public_volunteer_events' and c.relkind='r') then
  insert into public.public_volunteer_events(id,title,description,location,starts_at,ends_at,status,created_by,updated_by)
   values('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','Legacy public event','Existing public description','Park',now()-interval '2 days',now()-interval '2 days 2 hours' + interval '3 hours','published','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111');
  insert into public.public_volunteer_signups(id,event_id,user_id,name,email,attendance,verified_minutes)
   values('ffffffff-ffff-ffff-ffff-ffffffffffff','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','11111111-1111-1111-1111-111111111111','Legacy volunteer','jaden.jir@lvjusd.org','present',60);
 end if;
end $$;
\ir ../supabase/shared-volunteer-events.sql
\ir ../supabase/shared-volunteer-events.sql
begin;
insert into auth.users(id,email) values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','shared.a@lvjusd.org'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','shared.b@lvjusd.org');
do $$
declare owner uuid:='11111111-1111-1111-1111-111111111111';member uuid:='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; other_member uuid:='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 shared uuid; private_id uuid; public_version integer; old_logs integer; old_attendance integer; begin
 perform public.test_assert((select relkind='v' from pg_class where oid='public.public_volunteer_events'::regclass),'Public events are a view of the shared event records');
 perform public.test_assert((select public_volunteering and public_description='Existing public description' from public.officer_events where id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),'Legacy public event migrated with its ID');
 perform public.test_assert((select event_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' and attendance='present' and verified_minutes=60 from public.public_volunteer_signups where id='ffffffff-ffff-ffff-ffff-ffffffffffff'),'Existing public attendance and hours survive migration');
 select count(*) into old_logs from public.officer_volunteer_logs;
 select count(*) into old_attendance from public.officer_attendance;
 execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',owner::text,true);
 private_id:=public.save_officer_event('Leadership only','volunteer','2026-2027',now()+interval '2 days',now()+interval '2 days 1 hour');
 shared:=public.save_officer_event('Shared cleanup','outreach','2026-2027',now()+interval '2 days',now()+interval '2 days 1 hour','Park',false,true,'Private officer instructions',null,false,true,'Public instructions',true,1);
 perform public.test_assert((select count(*)=1 from public.officer_events where id=shared),'One canonical officer event exists');
 perform public.test_assert((select title='Shared cleanup' and description='Public instructions' and status='published' from public.public_volunteer_events where id=shared),'Checkbox publishes the same event ID');
 perform public.test_assert(not exists(select 1 from information_schema.columns where table_name='public_volunteer_events' and column_name='notes'),'Officer notes are excluded from the public view');
 perform public.test_denied('select public.save_officer_event(''Public meeting'',''meeting'',''2026-2027'',now(),now()+interval ''1 hour'','''',false,false,'''',null,false,true)');
 perform set_config('request.jwt.claim.sub',member::text,true);
 perform public.test_assert(not exists(select 1 from public.public_volunteer_events where id=private_id),'Leadership-only event stays hidden');
 perform public.test_assert(not exists(select 1 from public.officer_events where id=shared),'Non-officer cannot read the canonical officer record');
 perform public.set_public_volunteer_signup(shared,true,'General volunteer');
 perform public.test_denied(format('select public.set_public_volunteer_signup(%L,true,''General volunteer'')',private_id));
 perform public.test_denied(format('select public.save_officer_event(''Forged'',''volunteer'',''2026-2027'',now(),now()+interval ''1 hour'','''',false,false,'''',%L,false,true)',private_id));
 perform set_config('request.jwt.claim.sub',owner::text,true);
 select version into public_version from public.public_volunteer_events where id=shared;
 perform public.save_public_volunteer_event('Admin renamed event','New public instructions','New location',now()+interval '3 days',now()+interval '3 days 1 hour','published',true,1,shared,public_version);
 perform public.test_assert((select title='Admin renamed event' and location='New location' and notes='Private officer instructions' and kind='outreach' and gea_approved from public.officer_events where id=shared),'Admin edits update the same event while preserving private officer fields');
 -- An old client that omits audience settings must preserve them.
 perform public.save_officer_event('Officer renamed event','outreach','2026-2027',now()+interval '3 days',now()+interval '3 days 1 hour','New location',false,true,'Private officer instructions',shared);
 perform public.test_assert((select public_volunteering and public_capacity=1 and public_description='New public instructions' from public.officer_events where id=shared),'Older schedule edits preserve public settings');
 perform public.test_denied(format('select public.save_public_volunteer_event(''Stale'','''','''',now(),now()+interval ''1 hour'',''published'',true,1,%L,%s)',shared,public_version));
 perform public.save_officer_event('Officer renamed event','outreach','2026-2027',now()+interval '3 days',now()+interval '3 days 1 hour','New location',false,true,'Private officer instructions',shared,false,false);
 perform set_config('request.jwt.claim.sub',member::text,true);
 perform public.test_assert((select status='draft' from public.public_volunteer_events where id=shared),'Existing volunteers retain access to closed-event history');
 perform set_config('request.jwt.claim.sub',other_member::text,true);
 perform public.test_assert(not exists(select 1 from public.public_volunteer_events where id=shared),'Switching to leadership-only hides the listing from other members');
 perform public.test_denied(format('select public.set_public_volunteer_signup(%L,true,''Another volunteer'')',shared));
 perform set_config('request.jwt.claim.sub',owner::text,true);
 perform public.save_officer_event('Cancelled shared event','outreach','2026-2027',now()+interval '3 days',now()+interval '3 days 1 hour','New location',false,true,'Private officer instructions',shared,true,true,'Public instructions',true,1);
 perform set_config('request.jwt.claim.sub',member::text,true);
 perform public.test_assert((select status='cancelled' and title='Cancelled shared event' from public.public_volunteer_events where id=shared),'Officer cancellation immediately updates the public registration');
 execute 'reset role';
 perform public.test_assert((select count(*)=old_logs from public.officer_volunteer_logs),'Public registration does not change officer service logs');
 perform public.test_assert((select count(*)=old_attendance from public.officer_attendance),'Public registration does not change officer attendance');
end $$;
rollback;
