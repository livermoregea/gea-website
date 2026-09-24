import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isForumBoard } from "@/lib/forumBoards";

async function getAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) return null;
  const { data, error: roleError } = await supabase.from("admins")
    .select("auth_user_id").eq("auth_user_id", user.id).maybeSingle();
  return !roleError && data ? user : null;
}

export async function GET() {
  return NextResponse.json({ eligible: !!(await getAdmin()) }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  // Password-bearing requests must originate from our own UI.
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const user = await getAdmin();
  if (!user) return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Verified publishing is unavailable." }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!body || body.confirmed !== true || typeof body.password !== "string" ||
      !body.password || body.password.length > 1024 ||
      typeof body.text !== "string" || body.text.trim().length < 3 || body.text.length > 20000 ||
      typeof body.reason !== "string" || body.reason.trim().length < 10 || body.reason.length > 500 ||
      !["question", "answer"].includes(body.kind) ||
      (body.kind === "question" && (typeof body.board !== "string" || !isForumBoard(body.board))) ||
      (body.kind === "answer" && (typeof body.questionId !== "string" || !uuid.test(body.questionId) ||
        (body.parentAnswerId != null && (typeof body.parentAnswerId !== "string" || !uuid.test(body.parentAnswerId)))))) {
    return NextResponse.json({ error: "Review the content, provide a reason (10–500 characters), and confirm publication." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: allowed, error: limitError } = await admin.rpc("claim_forum_override_attempt", { p_admin_id: user.id });
  if (limitError) return NextResponse.json({ error: "Verified publishing is unavailable." }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: "Too many verification attempts. Try again in 15 minutes." }, { status: 429 });

  // A separate, non-persistent client avoids replacing the user's browser session.
  const verifier = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: verified, error: verificationError } = await verifier.auth.signInWithPassword({
    email: user.email!, password: body.password,
  });
  if (verificationError || verified.user?.id !== user.id) {
    return NextResponse.json({ error: "Password verification failed. Nothing was published." }, { status: 403 });
  }
  // Discard the temporary verification session; only this request is authorized.
  await verifier.auth.signOut({ scope: "local" });
  const { error } = await admin.rpc("publish_verified_forum_override", {
    p_admin_id: user.id,
    p_kind: body.kind,
    p_text: body.text.trim(),
    p_reason: body.reason.trim(),
    p_board: body.kind === "question" ? body.board : null,
    p_question_id: body.kind === "answer" ? body.questionId : null,
    p_parent_answer_id: body.kind === "answer" ? body.parentAnswerId ?? null : null,
  });
  if (error) return NextResponse.json({ error: "The verified post could not be published. Please try again." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
