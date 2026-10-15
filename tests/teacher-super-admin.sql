-- Run last, after tests/super-admin.sql, in the same disposable database.
-- No fixture data should ever be run against your real Supabase project.
begin;
insert into public.teacher_profiles(auth_user_id,auth_email,full_name,school_email)
 values('33333333-3333-3333-3333-333333333333','teacher.b@lvjusd.org','Existing Teacher','teacher.b@lvjusd.org')
 on conflict(auth_user_id) do nothing;
commit;
\ir ../supabase/teacher-super-admin.sql
\ir ../supabase/teacher-super-admin.sql
begin;
insert into auth.users(id,email) values('66666666-6666-6666-6666-666666666666','new.teacher@lvjusd.org');
do $$
declare owner uuid:='11111111-1111-1111-1111-111111111111'; teacher uuid:='33333333-3333-3333-3333-333333333333'; future_teacher uuid:='66666666-6666-6666-6666-666666666666'; ordinary uuid:='22222222-2222-2222-2222-222222222222'; task_id uuid; begin
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 perform public.test_assert(public.is_super_admin() and public.is_admin() and public.is_peet_admin() and public.is_peet_advisor(),'Existing teacher gets full admin permissions');
 perform public.test_assert(exists(select 1 from public.admins where auth_user_id=teacher),'Existing teacher gets admin landing membership');
 perform public.test_assert(public.has_officer_access(),'Existing teacher has active portal membership');
 perform public.test_denied('insert into public.super_admins(auth_user_id) values(''22222222-2222-2222-2222-222222222222'')');
 execute 'set local role service_role';
 perform public.superadmin_save_account(teacher,future_teacher,'teacher','New Teacher','new.teacher@lvjusd.org');
 perform public.test_assert(exists(select 1 from public.super_admins where auth_user_id=future_teacher and teacher_grant and not explicit_grant),'New teachers are automatically promoted');
 perform public.test_assert(exists(select 1 from public.officer_profiles where id=future_teacher and role='admin' and reviewer_kind='advisor' and access_enabled and teacher_managed),'New teachers get advisor portal membership');
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',future_teacher::text,true);
 task_id:=public.save_officer_task('Teacher task');
 perform public.test_assert(public.is_super_admin(),'Teacher newly added through Accounts has root privileges immediately');
 execute 'set local role service_role';
 perform public.superadmin_remove_account(owner,future_teacher,'teacher','Teacher no longer needs school access.');
 perform public.test_assert(not exists(select 1 from public.super_admins where auth_user_id=future_teacher),'Derived root grant revoked on removal');
 perform public.test_assert(not exists(select 1 from public.admins where auth_user_id=future_teacher),'Derived site-admin membership revoked');
 perform public.test_assert(exists(select 1 from public.officer_profiles where id=future_teacher and not access_enabled),'Portal disabled while retaining tracking identity');
 perform public.test_assert(exists(select 1 from public.tasks where id=task_id),'Tracking history preserved');
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',future_teacher::text,true);
 perform public.test_assert(not public.is_super_admin() and not public.is_peet_admin() and not public.has_officer_access(),'Former teacher loses automatic privileges');
 perform public.test_assert((select count(*)=0 from public.officer_profiles),'Disabled officer membership cannot be read');
 perform public.test_denied('select public.save_officer_task(''Unauthorized task'')');
 perform public.test_denied(format('select public.delete_officer_task(%L)',task_id));
 perform public.test_denied('select public.mark_peet_onboarding_seen()');
 execute 'set local role service_role';
 perform public.superadmin_save_account(owner,future_teacher,'teacher','Returning Teacher','new.teacher@lvjusd.org');
 execute 'set local role authenticated';
 perform public.test_assert(public.is_super_admin() and public.has_officer_access(),'Re-adding teacher restores access without replacing identity');
 perform public.test_assert(exists(select 1 from public.tasks where id=task_id),'Historical task remains available after restoration');
 execute 'set local role service_role';
 perform public.superadmin_save_account(owner,future_teacher,'officer','Returning Teacher','new.teacher@lvjusd.org',null,null,null,'admin','advisor','Independent Advisor');
 perform public.superadmin_remove_account(owner,future_teacher,'teacher','Removing teacher role while preserving independent advisor access.');
 execute 'set local role authenticated';
 perform public.test_assert(not public.is_super_admin() and public.is_peet_advisor() and public.has_officer_access(),'Independently assigned advisor access is retained, without root');
 -- Ordinary site admins cannot self-promote via direct teacher or invite inserts.
 execute 'reset role';
 insert into public.admins(auth_user_id,name) values(ordinary,'Ordinary Admin') on conflict do nothing;
 grant insert on public.teacher_profiles,public.teacher_invites to authenticated;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',ordinary::text,true);
 perform public.test_denied('insert into public.teacher_profiles(auth_user_id,auth_email,full_name,school_email) values(auth.uid(),''officer.a@lvjusd.org'',''Fake Teacher'',''officer.a@lvjusd.org'')');
 perform public.test_denied('insert into public.teacher_invites(teacher_email) values(''officer.a@lvjusd.org'')');
 perform public.test_assert(not public.is_super_admin(),'Ordinary admin cannot escalate');
 -- Owner's explicit root and President membership survive teacher add/removal.
 execute 'set local role service_role';
 perform public.superadmin_save_account(owner,owner,'teacher','Jaden','jaden.jir@lvjusd.org');
 delete from public.teacher_profiles where auth_user_id=owner;
 perform public.test_assert(exists(select 1 from public.super_admins where auth_user_id=owner and explicit_grant),'Explicit owner super-admin grant retained');
 perform public.test_assert(exists(select 1 from public.officer_profiles where id=owner and reviewer_kind='president' and access_enabled),'Owner retains President membership');
end $$;
rollback;
