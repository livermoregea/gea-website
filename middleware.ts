import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { BUILDERS_ENABLED } from "@/lib/site-features";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  // Discord authenticates with Ed25519 (or the worker bearer secret). Do not
  // spend its three-second ACK budget refreshing a browser session.
  if (request.nextUrl.pathname.startsWith('/api/discord/')) return NextResponse.next();
  // Return an actual 404 before streaming or authentication begins.
  if (!BUILDERS_ENABLED && (request.nextUrl.pathname === "/builders" || request.nextUrl.pathname.startsWith("/builders/"))) {
    const unavailable = request.nextUrl.clone();
    unavailable.pathname = "/_not-found";
    unavailable.search = "";
    return NextResponse.rewrite(unavailable, { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
