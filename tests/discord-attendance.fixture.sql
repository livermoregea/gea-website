-- Empty disposable local database only; never run in production.
\ir discord.fixture.sql
reset role;
create table public.admins(auth_user_id uuid);
create table public.teacher_profiles(auth_user_id uuid);
\ir ../supabase/gea-operations.sql
begin;
update public.officer_profiles set position='Vice President',discord_id='111111111111111111' where id='11111111-1111-4111-8111-111111111111';
update public.officer_profiles set position='Treasurer' where id='22222222-2222-4222-8222-222222222222';
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$
declare ev uuid; n integer; rows jsonb; begin
 ev:=public.save_officer_event('Receipt test meeting','meeting','2026-2027',now()-interval '1 day',now()-interval '23 hours');
 -- A planned absence is not a recorded attendance mark.
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 perform public.notify_officer_absence(ev,'I may arrive late.');
 perform public.test_assert((select count(*)=0 from public.discord_jobs where payload->>'topic'='attendance_receipt'),'advance notice alone does not claim attendance recorded');
 perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 rows:=jsonb_build_array(jsonb_build_object('officer_id','11111111-1111-4111-8111-111111111111','status','present','original_status','unmarked'));
 perform public.save_meeting_attendance(ev,rows);
 perform public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'topic'='attendance_receipt' and payload->>'officer_position'='Vice President' and payload->>'status'='present' and payload->>'event_title'='Receipt test meeting'),'website Save attendance queues a targeted position-channel receipt');
 perform public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'topic'='attendance' and payload->>'description' like '%present%'),'channel notification remains independent');
 rows:=jsonb_build_array(jsonb_build_object('officer_id','11111111-1111-4111-8111-111111111111','status','present','original_status','present'));
 perform public.save_meeting_attendance(ev,rows);
 perform public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'topic'='attendance_receipt'),'saving unchanged attendance does not spam recipients');
 perform public.record_officer_attendance(ev,'11111111-1111-4111-8111-111111111111','late','Corrected arrival time');
 perform public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'topic'='attendance_receipt' and payload->>'status'='late'),'attendance corrections queue a new position-channel receipt');
 perform public.record_officer_attendance(ev,'11111111-1111-4111-8111-111111111111','unmarked','Cleared incorrect mark');
 perform public.test_assert((select count(*)=1 from public.discord_jobs where payload->>'topic'='attendance_receipt' and payload->>'status'='unmarked'),'clearing a mark tells the recipient attendance is not recorded yet');
 perform public.record_officer_attendance(ev,'22222222-2222-4222-8222-222222222222','present','Not linked to Discord');
 perform public.test_assert((select count(*)=4 from public.discord_jobs where payload->>'topic'='attendance_receipt'),'position notifications do not require a personal Discord link');
 perform public.test_assert(not exists(select 1 from public.discord_jobs where payload->>'topic'='attendance_receipt' and (payload ? 'absence_notice' or payload ? 'reviewer_notes')),'role-channel jobs do not include private notes');
 begin
  perform public.record_officer_attendance(ev,'11111111-1111-4111-8111-111111111111','present','Rolled back change');
  raise exception 'Simulated save failure';
 exception when others then null;
 end;
 perform public.test_assert((select count(*)=4 from public.discord_jobs where payload->>'topic'='attendance_receipt'),'failed transactions never send saved-attendance receipts');
end $$;
rollback;
select 'Discord attendance receipt integration checks passed.';
