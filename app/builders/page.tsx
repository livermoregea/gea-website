import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BUILDERS_ENABLED } from "@/lib/site-features";
import Builders from "@/components/builders/Builders";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import type { BuilderStory, BuilderSubmission } from "@/lib/builders";

export const metadata: Metadata = {
  title: "GEA Builders | Green Engineering Academy",
  description: "Small builds. Real impact. Share real-world engineering projects, get officer feedback, and grow your builder journey.",
};
export const dynamic = "force-dynamic";

export default async function BuildersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!BUILDERS_ENABLED) notFound();
  const { view } = await searchParams;
  let stories: BuilderStory[] = [];
  let submissions: BuilderSubmission[] = [];
  let student: { id: string; name: string } | null = null;
  let signedIn = false;
  let ready = false;
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const [{ data: wall, error: wallError }, { data: { user } }] = await Promise.all([
      supabase.rpc("get_builder_wall"), supabase.auth.getUser(),
    ]);
    stories = (wall ?? []) as BuilderStory[];
    ready = !wallError;
    signedIn = Boolean(user);
    if (user) {
      const { data: profile } = await supabase.from("student_profiles").select("id, full_name").eq("auth_user_id", user.id).maybeSingle();
      if (profile) {
        student = { id: profile.id, name: profile.full_name };
        const { data, error } = await supabase.from("builder_submissions").select("*").eq("student_id", profile.id).order("created_at", { ascending: false });
        submissions = (data ?? []) as BuilderSubmission[];
        if (error) ready = false;
      }
    }
  }
  return <Builders key={student?.id ?? "guest"} stories={stories} submissions={submissions} student={student} signedIn={signedIn} ready={ready} initialView={view} />;
}
