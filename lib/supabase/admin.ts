import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createEmptySupabaseClient } from "@/lib/supabase/empty";
import { hasSupabaseConfig } from "@/lib/supabase/config";

// SERVER ONLY. Never import this file from a "use client" component —
// the service role key bypasses Row Level Security entirely.
export function createAdminClient() {
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createEmptySupabaseClient();
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
