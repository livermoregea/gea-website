import type { SupabaseClient } from "@supabase/supabase-js";
import { ROLES } from "@/lib/roles";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export type LeadershipRole = {
  slug: string;
  label: string;
  open: boolean;
  requiresProof: boolean;
  display_order: number;
  active: boolean;
};

export const DEFAULT_LEADERSHIP_ROLES: LeadershipRole[] = ROLES.map((role, index) => ({
  slug: role.slug, label: role.label, open: role.open,
  requiresProof: "requiresProof" in role && role.requiresProof,
  display_order: index, active: true,
}));

export async function loadLeadershipRoles(supabase: SupabaseClient) {
  if (!hasSupabaseConfig()) return { roles: DEFAULT_LEADERSHIP_ROLES, error: null };
  const { data, error } = await supabase.from("leadership_roles").select("*").order("display_order").order("slug");
  return { roles: error ? DEFAULT_LEADERSHIP_ROLES : (data ?? []) as LeadershipRole[], error };
}
