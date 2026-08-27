import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Payload = {
  fullName?: string;
  displayUsername?: string;
  schoolEmail?: string;
  graduatingClassYear?: number;
  studentIdNumber?: string;
};

function isLvjusdEmail(email: string) {
  return email.toLowerCase().endsWith("@lvjusd.org");
}

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
      { error: "Student account requests are unavailable until Supabase is configured." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as Payload;
  const fullName = body.fullName?.trim() ?? "";
  const displayUsername = body.displayUsername?.trim() ?? "";
  const schoolEmail = body.schoolEmail?.trim().toLowerCase() ?? "";
  const studentIdNumber = body.studentIdNumber?.trim() ?? "";
  const graduatingClassYear = Number(body.graduatingClassYear);

  if (!fullName || !displayUsername || !schoolEmail || !studentIdNumber || !Number.isInteger(graduatingClassYear)) {
    return NextResponse.json({ error: "Missing student account details." }, { status: 400 });
  }

  if (!isLvjusdEmail(schoolEmail)) {
    return NextResponse.json({ error: "Student email must end in @lvjusd.org." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const [{ data: existingProfile, error: profileLookupError }, { data: existingRequest, error: requestLookupError }] = await Promise.all([
    supabase
      .from("student_profiles")
      .select("id")
      .eq("school_email", schoolEmail)
      .maybeSingle(),
    supabase
      .from("student_account_requests")
      .select("id, status")
      .eq("school_email", schoolEmail)
      .maybeSingle(),
  ]);

  if (profileLookupError) {
    return NextResponse.json(
      { error: profileLookupError.message ?? "Could not check for an existing student profile." },
      { status: 500 }
    );
  }

  if (existingProfile) {
    return NextResponse.json(
      { error: "That student already has an approved account." },
      { status: 409 }
    );
  }

  if (requestLookupError) {
    return NextResponse.json(
      { error: requestLookupError.message ?? "Could not check for an existing request." },
      { status: 500 }
    );
  }

  if (existingRequest?.status === "pending") {
    return NextResponse.json(
      { error: "That request is already pending admin review." },
      { status: 409 }
    );
  }

  const existingUser = await findAuthUserByEmail(supabase, schoolEmail);
  if (existingUser) {
    const { error: updateUserError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: studentIdNumber,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        display_username: displayUsername,
        graduating_class_year: graduatingClassYear,
        account_type: "student_pending",
      },
    });

    if (updateUserError) {
      return NextResponse.json(
        { error: updateUserError.message ?? "Could not create the student account." },
        { status: 400 }
      );
    }
  } else {
    const { error: createUserError } = await supabase.auth.admin.createUser({
      email: schoolEmail,
      password: studentIdNumber,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        display_username: displayUsername,
        graduating_class_year: graduatingClassYear,
        account_type: "student_pending",
      },
    });

    if (createUserError) {
      return NextResponse.json(
        { error: createUserError.message ?? "Could not create the student account." },
        { status: 400 }
      );
    }
  }

  const { error: requestError } = await supabase.from("student_account_requests").upsert(
    {
      full_name: fullName,
      display_username: displayUsername,
      school_email: schoolEmail,
      graduating_class_year: graduatingClassYear,
      student_id_number: studentIdNumber,
      status: "pending",
      reviewed_at: null,
      reviewed_by_auth_user_id: null,
      rejection_reason: null,
    },
    { onConflict: "school_email" }
  );

  if (requestError) {
    return NextResponse.json(
      { error: requestError.message ?? "Could not save the student request." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Your request has been submitted for admin approval.",
  });
}
