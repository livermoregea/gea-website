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
  const existingUser = await findAuthUserByEmail(supabase, schoolEmail);

  let authUser = existingUser;

  if (!authUser) {
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: schoolEmail,
      password: studentIdNumber,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        display_username: displayUsername,
        graduating_class_year: graduatingClassYear,
      },
    });

    if (createUserError || !createdUser.user) {
      return NextResponse.json(
        { error: createUserError?.message ?? "Could not create the authentication account." },
        { status: 400 }
      );
    }

    authUser = createdUser.user;
  } else {
    const { error: updateUserError } = await supabase.auth.admin.updateUserById(authUser.id, {
      password: studentIdNumber,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        display_username: displayUsername,
        graduating_class_year: graduatingClassYear,
      },
    });

    if (updateUserError) {
      return NextResponse.json(
        { error: updateUserError.message ?? "Could not update the authentication account." },
        { status: 400 }
      );
    }
  }

  const { error: profileError } = await supabase.from("student_profiles").upsert(
    {
      auth_user_id: authUser.id,
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

  return NextResponse.json({ authEmail: schoolEmail });
}
