import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import AdminApplicationDetail from "@/components/admin/AdminApplicationDetail";

export default async function AdminApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  if (!hasSupabaseConfig()) {
    return <p className="mx-auto max-w-5xl px-4 py-16 text-sm text-graphite/60 sm:px-6">Demo mode is enabled.</p>;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 md:py-24">
        <p className="text-sm text-graphite/70">
          <Link href="/admin-portal-x7k9/login" className="text-forest underline decoration-gold underline-offset-4">
            Sign in
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
    return <p className="mx-auto max-w-md px-4 py-16 text-center text-sm text-graphite/70 sm:px-6">Your account does not have staff access.</p>;
  }

  return <AdminApplicationDetail applicationId={id} />;
}
