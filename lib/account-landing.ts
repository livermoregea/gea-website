import type { createClient } from "@/lib/supabase/server";

export async function accountMemberships(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const [admin, superAdmin, officer, teacher, student] = await Promise.all([
    supabase.from("admins").select("auth_user_id, name").eq("auth_user_id", userId).maybeSingle(),
    supabase.from("super_admins").select("auth_user_id").eq("auth_user_id", userId).maybeSingle(),
    supabase.from("officer_profiles").select("id, name, access_enabled").eq("id", userId).maybeSingle(),
    supabase.from("teacher_profiles").select("id, full_name").eq("auth_user_id", userId).maybeSingle(),
    supabase.from("student_profiles").select("id, full_name, display_username").eq("auth_user_id", userId).maybeSingle(),
  ]);
  const isAdmin = Boolean(admin.data || superAdmin.data);
  const isTeacher = Boolean(teacher.data);
  const isOfficer = Boolean(officer.data && officer.data.access_enabled !== false);
  const isStudent = Boolean(student.data);
  return {
    isAdmin, isTeacher, isOfficer, isStudent,
    hasWorkspace: isAdmin || isTeacher || isOfficer,
    canUseForum: isStudent || isTeacher || isAdmin || isOfficer,
    displayName: student.data?.display_username ?? teacher.data?.full_name ?? officer.data?.name ?? admin.data?.name ?? student.data?.full_name ?? null,
  };
}

export async function accountLanding(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const membership = await accountMemberships(supabase, userId);
  return membership.isStudent && !membership.hasWorkspace ? "/dashboard#qa" : "/account";
}
