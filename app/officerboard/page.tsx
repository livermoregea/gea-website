import { redirect } from "next/navigation";
import OfficerWorkspace from "@/components/officerboard/OfficerWorkspace";
import { accountMemberships } from "@/lib/account-landing";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata = { title: "Officer workspace · GEA One", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OfficerBoardPage(props: { searchParams?: Promise<{ view?: string; event?: string; task?: string; topic?: string; officer?: string }> }) {
  const search = await props?.searchParams ?? {};
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const membership = await accountMemberships(supabase, user.id);
      if (membership.isAdmin || membership.isTeacher) redirect(`/admin-portal-x7k9/officers${Object.keys(search).length ? `?${new URLSearchParams(Object.entries(search).filter((entry): entry is [string, string] => typeof entry[1] === "string"))}` : ""}`);
    }
  }
  return <div className="mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-8"><OfficerWorkspace search={search} /></div>;
}
