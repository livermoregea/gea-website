import PageNotice from "@/components/PageNotice";
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
    return <PageNotice title="Staff workspace unavailable"><p>Staff tools will be available once the site is connected.</p></PageNotice>;
  }

  if (!validSection || validSection === "dashboard") {
    return <PageNotice title="Page not found"><p>That staff workspace does not exist. Return to the staff dashboard to choose a workspace.</p></PageNotice>;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6"><h1 className="mb-4 font-display text-2xl text-forestdeep">Staff sign-in required</h1><p className="text-sm text-graphite/80"><Link href="/admin-portal-x7k9/login" className="text-forest underline decoration-gold underline-offset-4">Sign in</Link>{" "}to access the admin portal.</p></div>;
  }

  const [{ data: adminRow }, { data: teacherRow }] = await Promise.all([
    supabase.from("admins").select("name").eq("auth_user_id", user.id).maybeSingle(),
    supabase.from("teacher_profiles").select("full_name, school_email").eq("auth_user_id", user.id).maybeSingle(),
  ]);

  if (validSection === "builders" && !adminRow) {
    return <PageNotice title="Officer access required"><p>GEA Builders reviews require an approved officer account.</p></PageNotice>;
  }

  if (!adminRow && !teacherRow) {
    return <PageNotice title="Staff access required"><p>Your account does not have staff access. Contact a GEA coordinator if you need help.</p></PageNotice>;
  }

  return <StaffPortal title="Admin Portal" accessLabel={adminRow ? "Admin" : "Teacher"} displayName={(adminRow?.name ?? teacherRow?.full_name ?? user.email ?? "Staff").split(" ")[0]} schoolEmail={teacherRow?.school_email ?? user.email ?? ""} userId={user.id} section={validSection} />;
}
