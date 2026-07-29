import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminTabs from "@/components/admin/AdminTabs";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function AdminPortalPage() {
  const supabase = await createClient();
  if (!hasSupabaseConfig()) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Admin Portal</p>
        <h1 className="mt-3 font-display text-2xl font-medium text-forest">Demo mode</h1>
        <p className="mt-2 text-sm text-graphite/60">
          Supabase is not configured, so the admin portal is showing empty values only.
        </p>
        <div className="dim-divider my-8" />
        <AdminTabs />
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 md:py-24">
        <p className="text-sm text-graphite/70">
          <Link
            href="/admin-portal-x7k9/login"
            className="text-forest underline decoration-gold underline-offset-4"
          >
            Sign in
          </Link>{" "}
          to access the admin portal.
        </p>
      </div>
    );
  }

  const { data: adminRow } = await supabase
    .from("admins")
    .select("name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 md:py-24">
        <p className="text-sm text-graphite/70">Your account doesn&apos;t have admin access.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Admin Portal</p>
      <h1 className="mt-3 font-display text-2xl font-medium text-forest">
        Welcome, {adminRow.name.split(" ")[0]}
      </h1>
      <p className="mt-2 text-sm text-graphite/60">
        This page is not linked anywhere on the public site — bookmark it.
      </p>
      <div className="dim-divider my-8" />
      <AdminTabs />
    </div>
  );
}
