import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import StaffPortal from "@/components/StaffPortal";
import { ADMIN_SECTIONS, type AdminSectionKey } from "@/components/admin/admin-sections";

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const validSection = ADMIN_SECTIONS.find((item) => item.key === section)?.key as AdminSectionKey | undefined;
  const supabase = await createClient();

  if (!hasSupabaseConfig()) {
    return <p className="mx-auto max-w-5xl px-4 py-16 text-sm text-graphite/60 sm:px-6">Demo mode is enabled.</p>;
  }

  if (!validSection || validSection === "dashboard") {
    return <p className="mx-auto max-w-md px-4 py-16 text-center text-sm text-graphite/70 sm:px-6">That admin section does not exist.</p>;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6"><p className="text-sm text-graphite/70"><Link href="/admin-portal-x7k9/login" className="text-forest underline decoration-gold underline-offset-4">Sign in</Link>{" "}to access the admin portal.</p></div>;
  }

  const [{ data: adminRow }, { data: teacherRow }] = await Promise.all([
    supabase.from("admins").select("name").eq("auth_user_id", user.id).maybeSingle(),
    supabase.from("teacher_profiles").select("full_name, school_email").eq("auth_user_id", user.id).maybeSingle(),
  ]);

  if (!adminRow && !teacherRow) {
    return <p className="mx-auto max-w-md px-4 py-16 text-center text-sm text-graphite/70 sm:px-6">Your account does not have staff access.</p>;
  }

  return <StaffPortal title="Admin Portal" accessLabel={adminRow ? "Admin" : "Teacher"} displayName={(adminRow?.name ?? teacherRow?.full_name ?? user.email ?? "Staff").split(" ")[0]} schoolEmail={teacherRow?.school_email ?? user.email ?? ""} userId={user.id} section={validSection} />;
}
