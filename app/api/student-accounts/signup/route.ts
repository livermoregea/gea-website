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
      { error: "Student accounts are unavailable until Supabase is configured." },
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
  const [
    { data: existingProfile, error: profileLookupError },
    { data: existingBlock, error: blockLookupError },
  ] = await Promise.all([
    supabase
      .from("student_profiles")
      .select("id")
      .eq("school_email", schoolEmail)
      .maybeSingle(),
    supabase
      .from("student_email_blocks")
      .select("school_email, reason, note")
      .eq("school_email", schoolEmail)
      .eq("is_active", true)
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
      { error: "That student already has an account." },
      { status: 409 }
    );
  }

  if (blockLookupError) {
    return NextResponse.json(
      { error: blockLookupError.message ?? "Could not check whether that email is blocked." },
      { status: 500 }
    );
  }

  if (existingBlock) {
    return NextResponse.json(
      { error: "That email address is blocked from creating a student account. Please contact a GEA coordinator." },
      { status: 403 }
    );
  }

  const existingUser = await findAuthUserByEmail(supabase, schoolEmail);
  let authUserId = existingUser?.id ?? null;

  if (existingUser) {
    const { error: updateUserError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: studentIdNumber,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        display_username: displayUsername,
        graduating_class_year: graduatingClassYear,
        account_type: "student",
      },
    });

    if (updateUserError) {
      return NextResponse.json(
        { error: updateUserError.message ?? "Could not create the student account." },
        { status: 400 }
      );
    }
  } else {
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: schoolEmail,
      password: studentIdNumber,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        display_username: displayUsername,
        graduating_class_year: graduatingClassYear,
        account_type: "student",
      },
    });

    if (createUserError) {
      return NextResponse.json(
        { error: createUserError.message ?? "Could not create the student account." },
        { status: 400 }
      );
    }

    authUserId = createdUser.user?.id ?? null;
  }

  if (!authUserId) {
    return NextResponse.json({ error: "Could not resolve the student account." }, { status: 500 });
  }

  const { error: profileError } = await supabase.from("student_profiles").upsert(
    {
      auth_user_id: authUserId,
      auth_email: schoolEmail,
      full_name: fullName,
      display_username: displayUsername,
      graduating_class_year: graduatingClassYear,
      student_id_number: studentIdNumber,
      school_email: schoolEmail,
    },
    { onConflict: "auth_user_id" }
  );

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message ?? "Could not save the student profile." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Your account is ready. You can sign in now.",
  });
}
