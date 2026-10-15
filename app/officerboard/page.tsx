import { redirect } from "next/navigation";
import OfficerWorkspace from "@/components/officerboard/OfficerWorkspace";
import { accountMemberships } from "@/lib/account-landing";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata = { title: "Officer Board · GEA One", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OfficerBoardPage() {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const membership = await accountMemberships(supabase, user.id);
      if (membership.isAdmin || membership.isTeacher) redirect("/admin-portal-x7k9/officers");
    }
  }
  return <OfficerWorkspace />;
}
