import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import StaffPortal from "@/components/StaffPortal";
import { redirect } from "next/navigation";

export default async function AdminPortalPage() {
  const supabase = await createClient();
  if (!hasSupabaseConfig()) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Admin Portal</p>
        <h1 className="mt-3 font-display text-2xl font-medium text-forest">Demo mode</h1>
        <p className="mt-2 text-sm text-graphite/80">
          Supabase isn&apos;t configured, so the admin portal is showing placeholder content.
        </p>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 md:py-24">
        <h1 className="mb-4 font-display text-2xl text-forestdeep">Account access</h1>
        <p className="text-sm text-graphite/80">
          <Link
            href="/admin-portal-x7k9/login"
            className="text-forest underline decoration-gold underline-offset-4"
          >
            Sign in to GEA One
          </Link>{" "}
          to access the admin portal.
        </p>
      </div>
    );
  }

  const [{ data: adminRow }, { data: teacherRow }, { data: officerRow }, { data: superAdminRow }] = await Promise.all([
    supabase
      .from("admins")
      .select("name")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
    supabase
      .from("teacher_profiles")
      .select("full_name, school_email")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
    supabase.from("officer_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase.from("super_admins").select("auth_user_id").eq("auth_user_id", user.id).maybeSingle(),
  ]);

  if (!adminRow && !superAdminRow && !teacherRow && officerRow) redirect("/officerboard");
  if (!adminRow && !superAdminRow && !teacherRow) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 md:py-24">
        <h1 className="mb-4 font-display text-2xl text-forestdeep">Account access</h1>
        <p className="text-sm text-graphite/80">
          Your GEA One account doesn&apos;t have staff access to this portal.
        </p>
      </div>
    );
  }

  const displayName = adminRow?.name ?? teacherRow?.full_name ?? user.email ?? "Staff";
  const accessLabel = adminRow || superAdminRow ? "Admin" : "Teacher";

  return (
    <StaffPortal
      title="Admin Portal"
      accessLabel={accessLabel}
      displayName={displayName.split(" ")[0]}
      schoolEmail={teacherRow?.school_email ?? user.email ?? ""}
      userId={user.id}
      section="dashboard"
    />
  );
}
