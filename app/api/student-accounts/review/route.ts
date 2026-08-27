import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Payload = {
  requestId?: string;
  action?: "approve" | "reject";
  rejectionReason?: string;
};

async function findAuthUserByEmail(supabase: ReturnType<typeof createAdminClient>, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return null;
  return (
    data.users.find((user: { email?: string | null }) => user.email?.toLowerCase() === email.toLowerCase()) ??
    null
  );
}

export async function POST(request: Request) {
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Student account review is unavailable until Supabase is configured." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const [{ data: adminRow }, { data: teacherRow }] = await Promise.all([
    supabase.from("admins").select("auth_user_id").eq("auth_user_id", user.id).maybeSingle(),
    supabase
      .from("teacher_profiles")
      .select("auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
  ]);

  if (!adminRow && !teacherRow) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = (await request.json()) as Payload;
  const requestId = body.requestId?.trim() ?? "";
  const action = body.action;
  const rejectionReason = body.rejectionReason?.trim() ?? null;

  if (!requestId || !action) {
    return NextResponse.json({ error: "Missing request details." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: requestRow, error: requestError } = await admin
    .from("student_account_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: "Student request not found." }, { status: 404 });
  }

  if (requestRow.status !== "pending") {
    return NextResponse.json({ error: "That request has already been reviewed." }, { status: 409 });
  }

  if (action === "reject") {
    const { error: rejectError } = await admin
      .from("student_account_requests")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by_auth_user_id: user.id,
        rejection_reason: rejectionReason || "Rejected by admin.",
      })
      .eq("id", requestRow.id);

    if (rejectError) {
      return NextResponse.json({ error: rejectError.message ?? "Could not reject the request." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const existingUser = await findAuthUserByEmail(admin, requestRow.school_email);
  let authUser = existingUser;

  if (!authUser) {
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email: requestRow.school_email,
      password: requestRow.student_id_number,
      email_confirm: true,
      user_metadata: {
        full_name: requestRow.full_name,
        display_username: requestRow.display_username,
        graduating_class_year: requestRow.graduating_class_year,
        account_type: "student",
      },
    });

    if (createUserError || !createdUser.user) {
      return NextResponse.json(
        { error: createUserError?.message ?? "Could not create the student account." },
        { status: 400 }
      );
    }

    authUser = createdUser.user;
  } else {
    const { error: updateUserError } = await admin.auth.admin.updateUserById(authUser.id, {
      password: requestRow.student_id_number,
      email_confirm: true,
      user_metadata: {
        full_name: requestRow.full_name,
        display_username: requestRow.display_username,
        graduating_class_year: requestRow.graduating_class_year,
        account_type: "student",
      },
    });

    if (updateUserError) {
      return NextResponse.json(
        { error: updateUserError.message ?? "Could not update the student account." },
        { status: 400 }
      );
    }
  }

  const { error: profileError } = await admin.from("student_profiles").upsert(
    {
      auth_user_id: authUser.id,
      auth_email: requestRow.school_email,
      full_name: requestRow.full_name,
      display_username: requestRow.display_username,
      graduating_class_year: requestRow.graduating_class_year,
      student_id_number: requestRow.student_id_number,
      school_email: requestRow.school_email,
    },
    { onConflict: "auth_user_id" }
  );

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message ?? "Could not save the student profile." },
      { status: 400 }
    );
  }

  const { error: approveError } = await admin
    .from("student_account_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by_auth_user_id: user.id,
      rejection_reason: null,
    })
    .eq("id", requestRow.id);

  if (approveError) {
    return NextResponse.json(
      { error: approveError.message ?? "Could not approve the request." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, status: "approved", authEmail: requestRow.school_email });
}
