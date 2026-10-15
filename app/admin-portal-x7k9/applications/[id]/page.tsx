import PageNotice from "@/components/PageNotice";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import AdminApplicationDetail from "@/components/admin/AdminApplicationDetail";

export default async function AdminApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  if (!hasSupabaseConfig()) {
    return <PageNotice title="Staff workspace unavailable"><p>Staff tools will be available once the site is connected.</p></PageNotice>;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 md:py-24">
        <h1 className="mb-4 font-display text-2xl text-forestdeep">Staff sign-in required</h1>
        <p className="text-sm text-graphite/80">
          <Link href="/admin-portal-x7k9/login" className="text-forest underline decoration-gold underline-offset-4">
            Sign in to GEA One
          </Link>{" "}to access the admin portal.
        </p>
      </div>
    );
  }

  const [{ data: adminRow }, { data: teacherRow }] = await Promise.all([
    supabase.from("admins").select("auth_user_id").eq("auth_user_id", user.id).maybeSingle(),
    supabase.from("teacher_profiles").select("auth_user_id").eq("auth_user_id", user.id).maybeSingle(),
  ]);

  if (!adminRow && !teacherRow) {
    return <PageNotice title="Staff access required"><p>Your GEA One account does not have staff access. Contact a GEA coordinator if you need help.</p></PageNotice>;
  }

  return <AdminApplicationDetail applicationId={id} />;
}
