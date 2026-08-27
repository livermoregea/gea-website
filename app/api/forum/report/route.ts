import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type ReportTargetType = "question" | "answer";

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ ok: false, error: "Forum reports are unavailable." }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as
    | { targetType?: ReportTargetType; targetId?: string; reporterKey?: string; reason?: string }
    | null;

  if (!body || !body.targetType || !body.targetId) {
    return NextResponse.json({ ok: false, error: "Missing report details." }, { status: 400 });
  }

  if (body.targetType !== "question" && body.targetType !== "answer") {
    return NextResponse.json({ ok: false, error: "Invalid report target." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const reporterKey = user?.id ?? body.reporterKey?.trim();
  if (!reporterKey) {
    return NextResponse.json({ ok: false, error: "Missing reporter identity." }, { status: 401 });
  }

  const admin = createAdminClient();
  const payload = {
    reporter_auth_user_id: user?.id ?? null,
    reporter_key: reporterKey,
    reason: body.reason?.trim() || "Community report",
  };

  const table =
    body.targetType === "question" ? "qa_question_reports" : "qa_answer_reports";
  const targetField = body.targetType === "question" ? "question_id" : "answer_id";

  const { error } = await admin.from(table).upsert(
    {
      ...payload,
      [targetField]: body.targetId,
    },
    { onConflict: `${targetField},reporter_key` },
  );

  if (error) {
    return NextResponse.json({ ok: false, error: "We couldn’t submit that report." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
