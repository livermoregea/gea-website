import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { STUDENT_EMAIL_BLOCK_REASONS, type StudentEmailBlockReason } from "@/lib/student-access";

type Payload =
  | {
      action?: "remove";
      studentProfileId?: string;
      reason?: StudentEmailBlockReason;
      note?: string;
    }
  | {
      action?: "unblacklist";
      schoolEmail?: string;
    };

function isValidReason(reason: string | undefined): reason is StudentEmailBlockReason {
  return Boolean(STUDENT_EMAIL_BLOCK_REASONS.find((item) => item.value === reason));
}

async function isAuthorizedStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, status: 401, error: "Not signed in." };
  }

  const [{ data: adminRow }, { data: teacherRow }] = await Promise.all([
    supabase.from("admins").select("auth_user_id").eq("auth_user_id", user.id).maybeSingle(),
    supabase.from("teacher_profiles").select("auth_user_id").eq("auth_user_id", user.id).maybeSingle(),
  ]);

  if (!adminRow && !teacherRow) {
    return { ok: false as const, status: 403, error: "Not authorized." };
  }

  return { ok: true as const, userId: user.id };
}

export async function POST(request: Request) {
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Student management is unavailable until Supabase is configured." },
      { status: 503 }
    );
  }

  const auth = await isAuthorizedStaff();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as Payload;
  const action = body.action;
  const admin = createAdminClient();

  if (action === "remove") {
    const studentProfileId = body.studentProfileId?.trim() ?? "";
    const reason = body.reason;
    const note = body.note?.trim() ?? null;

    if (!studentProfileId || !isValidReason(reason)) {
      return NextResponse.json({ error: "Missing removal details." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await admin
      .from("student_profiles")
      .select("id, auth_user_id, auth_email, school_email, full_name")
      .eq("id", studentProfileId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    }

    const email = (profile.school_email ?? profile.auth_email).trim().toLowerCase();

    const { error: blockError } = await admin.from("student_email_blocks").upsert(
      {
        school_email: email,
        reason,
        note,
        is_active: true,
        blocked_by_auth_user_id: auth.userId,
        blocked_at: new Date().toISOString(),
        unblocked_by_auth_user_id: null,
        unblocked_at: null,
      },
      { onConflict: "school_email" }
    );

    if (blockError) {
      return NextResponse.json({ error: blockError.message ?? "Could not blacklist that email." }, { status: 500 });
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(profile.auth_user_id);

    if (authDeleteError) {
      return NextResponse.json(
        {
          error:
            authDeleteError.message ??
            "Student was blacklisted, but the auth account could not be removed.",
        },
        { status: 500 }
      );
    }

    await admin.from("student_account_requests").delete().eq("school_email", email);

    return NextResponse.json({ ok: true, status: "removed", schoolEmail: email });
  }

  if (action === "unblacklist") {
    const schoolEmail = body.schoolEmail?.trim().toLowerCase() ?? "";

    if (!schoolEmail) {
      return NextResponse.json({ error: "Missing email address." }, { status: 400 });
    }

    const { error: updateError, data: updatedRow } = await admin
      .from("student_email_blocks")
      .update({
        is_active: false,
        unblocked_by_auth_user_id: auth.userId,
        unblocked_at: new Date().toISOString(),
      })
      .eq("school_email", schoolEmail)
      .eq("is_active", true)
      .select("school_email")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message ?? "Could not unblacklist that email." }, { status: 500 });
    }

    if (!updatedRow) {
      return NextResponse.json({ error: "That email is not currently blacklisted." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, status: "unblacklisted", schoolEmail });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
