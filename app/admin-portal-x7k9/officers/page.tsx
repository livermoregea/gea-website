import { redirect } from "next/navigation";
import StaffPortal from "@/components/StaffPortal";
import OfficerWorkspace from "@/components/officerboard/OfficerWorkspace";
import PageNotice from "@/components/PageNotice";
import { accountMemberships } from "@/lib/account-landing";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata = { title: "Officer workspace · GEA One", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminOfficersPage(props: { searchParams?: Promise<{ view?: string; event?: string; task?: string; topic?: string; officer?: string }> }) {
  const search = await props?.searchParams ?? {};
  if (!hasSupabaseConfig()) return <PageNotice title="Workspace unavailable"><p>Connect GEA One to open your workspace.</p></PageNotice>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const membership = await accountMemberships(supabase, user.id);
  if (!membership.isAdmin && !membership.isTeacher) redirect(membership.isOfficer ? "/officerboard" : "/account");
  if (!membership.isOfficer) return <PageNotice title="Officer access required"><p>Your account does not have active officer access.</p></PageNotice>;
  return <StaffPortal title="GEA One workspace" accessLabel={membership.isAdmin ? "Admin" : "Teacher"} displayName={membership.displayName ?? "Staff"} schoolEmail={user.email ?? ""} userId={user.id} workspace="officers">
    <OfficerWorkspace embedded search={search} />
  </StaffPortal>;
}
