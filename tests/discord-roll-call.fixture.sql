-- Empty disposable local database only. Never run in production.
\ir secretary-attendance.fixture.sql
begin;
insert into auth.users(id) values('55555555-5555-4555-8555-555555555555');
insert into public.officer_profiles(id,name,role,position,discord_id,access_enabled) values
 ('55555555-5555-4555-8555-555555555555','Secretary','officer','Secretary','555555555555555555',true);
update public.officer_profiles set discord_id='111111111111111111' where id='11111111-1111-4111-8111-111111111111';
update public.officer_profiles set discord_id='333333333333333333' where id='33333333-3333-4333-8333-333333333333';
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$
declare ev uuid; service uuid; future_ev uuid; state jsonb; fresh jsonb; saved jsonb; rows_before jsonb;
 who text:='11111111-1111-4111-8111-111111111111'; sid text; ver integer;
begin
 ev:=public.save_officer_event('Interactive roll call','meeting','2026-2027',now()-interval '1 hour',now());
 service:=public.save_officer_event('Service roster','volunteer','2026-2027',now()-interval '1 hour',now());
 future_ev:=public.save_officer_event('Upcoming roll call','meeting','2026-2027',now()+interval '1 day',now()+interval '25 hours');
 perform public.record_officer_attendance(ev,who::uuid,'late','Keep this private note');
 perform public.record_officer_attendance(ev,'22222222-2222-4222-8222-222222222222','excused','Existing excuse');
 execute 'set local role authenticated';
 perform public.test_denied('select public.discord_roll_call(''333333333333333333'',''events'')');
 execute 'set local role service_role';
 perform public.test_denied('select public.discord_roll_call(''111111111111111111'',''events'')');
 state:=public.discord_roll_call('555555555555555555','events');
 perform public.test_assert(not exists(select 1 from jsonb_array_elements(state->'events') e where e->>'kind'<>'meeting'),'secretary dropdown lists meetings only');
 perform public.test_denied(format('select public.discord_roll_call(%L,%L,%L::jsonb)','555555555555555555','open',jsonb_build_object('event',service)));
 state:=public.discord_roll_call('555555555555555555','open',jsonb_build_object('event',ev),'roll-open');sid:=state->>'id';
 perform public.test_assert(public.discord_roll_call('555555555555555555','open',jsonb_build_object('event',ev),'roll-open')->>'id'=sid,'interaction retry does not duplicate a draft');
 perform public.test_assert(jsonb_array_length(state->'rows')>=3,'roster includes active officers without individual Discord links');
 perform public.test_assert(not exists(select 1 from jsonb_array_elements(state->'rows') r where r ? 'reviewer_notes' or r ? 'absence_notice'),'roster does not expose private attendance notes');
 perform public.test_denied(format('select public.discord_roll_call(%L,%L,%L::jsonb)','333333333333333333','all',jsonb_build_object('session',sid,'version',1)));
 state:=public.discord_roll_call('555555555555555555','all',jsonb_build_object('session',sid,'version',1),'roll-all');
 perform public.test_assert((select r->>'status'='late' from jsonb_array_elements(state->'rows') r where r->>'officer_id'=who),'Mark all present preserves existing tardiness');
 perform public.test_assert((select r->>'status'='excused' from jsonb_array_elements(state->'rows') r where r->>'officer_id'='22222222-2222-4222-8222-222222222222'),'Mark all present preserves existing excuses');
 perform public.test_assert((select count(*)=2 from public.officer_attendance where event_id=ev),'drafting does not save attendance');
 perform public.test_denied(format('select public.discord_roll_call(%L,%L,%L::jsonb)','555555555555555555','select',jsonb_build_object('session',sid,'version',1,'officers',jsonb_build_array(who))));
 state:=public.discord_roll_call('555555555555555555','select',jsonb_build_object('session',sid,'version',2,'officers',jsonb_build_array(who)));
 state:=public.discord_roll_call('555555555555555555','status',jsonb_build_object('session',sid,'version',3,'status','present'));
 saved:=public.discord_roll_call('555555555555555555','save',jsonb_build_object('session',sid,'version',4),'roll-save');
 perform public.test_assert((saved->>'saved')::boolean,'Save confirms the whole roster');
 perform public.test_assert((select status='present' and reviewer_notes='Keep this private note' from public.officer_attendance where event_id=ev and officer_id=who::uuid),'batched save updates attendance while preserving notes');
 perform public.test_assert(public.discord_roll_call('555555555555555555','save',jsonb_build_object('session',sid,'version',4),'roll-save')=saved,'Save is idempotent');
 -- Concurrent website edits reject the whole pending batch.
 state:=public.discord_roll_call('555555555555555555','open',jsonb_build_object('event',ev));sid:=state->>'id';
 state:=public.discord_roll_call('555555555555555555','select',jsonb_build_object('session',sid,'version',1,'officers',jsonb_build_array(who)));
 state:=public.discord_roll_call('555555555555555555','status',jsonb_build_object('session',sid,'version',2,'status','excused'));
 perform public.discord_action('333333333333333333','attendance',jsonb_build_object('event',ev,'officer','111111111111111111','status','late'));
 perform public.test_denied(format('select public.discord_roll_call(%L,%L,%L::jsonb)','555555555555555555','save',jsonb_build_object('session',sid,'version',3)));
 perform public.test_assert((select status='late' from public.officer_attendance where event_id=ev and officer_id=who::uuid),'concurrent attendance cannot be overwritten');
 state:=public.discord_roll_call('555555555555555555','discard',jsonb_build_object('session',sid,'version',3));
 perform public.test_assert((state->>'discarded')::boolean,'discard closes the draft without saving');
 -- Future attendance and expired drafts stay protected.
 state:=public.discord_roll_call('555555555555555555','open',jsonb_build_object('event',future_ev));sid:=state->>'id';
 perform public.test_denied(format('select public.discord_roll_call(%L,%L,%L::jsonb)','555555555555555555','all',jsonb_build_object('session',sid,'version',1)));
 execute 'reset role';
 update public.discord_roll_calls set expires_at=now()-interval '1 second' where id=sid::uuid;
 execute 'set local role service_role';
 perform public.test_denied(format('select public.discord_roll_call(%L,%L,%L::jsonb)','555555555555555555','discard',jsonb_build_object('session',sid,'version',1)));
 state:=public.discord_roll_call('333333333333333333','open',jsonb_build_object('event',service));sid:=state->>'id';
 state:=public.discord_roll_call('333333333333333333','all',jsonb_build_object('session',sid,'version',1));
 state:=public.discord_roll_call('333333333333333333','save',jsonb_build_object('session',sid,'version',2));
 perform public.test_assert((state->>'saved')::boolean,'reviewers can save a service-event roster');
end $$;
reset role;
rollback;
select 'Discord interactive roll-call checks passed.';
