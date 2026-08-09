"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createEmptySupabaseClient } from "@/lib/supabase/empty";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export function createClient() {
  if (!hasSupabaseConfig()) {
    return createEmptySupabaseClient();
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  );
}
