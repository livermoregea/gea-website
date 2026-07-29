import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createEmptySupabaseClient } from "@/lib/supabase/empty";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export async function createClient() {
  if (!hasSupabaseConfig()) {
    return createEmptySupabaseClient();
  }

  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component - safe to ignore with middleware refresh
          }
        },
      },
    }
  );
}
