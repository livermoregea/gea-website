import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Payload = {
  fullName?: string;
  schoolEmail?: string;
  signupCode?: string;
  password?: string;
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
      { error: "Teacher accounts are unavailable until Supabase is configured." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as Payload;
  const schoolEmail = body.schoolEmail?.trim().toLowerCase() ?? "";

  if (schoolEmail && !isLvjusdEmail(schoolEmail)) {
    return NextResponse.json({ error: "Teacher email must end in @lvjusd.org." }, { status: 400 });
  }

  return NextResponse.json(
    { error: "Teacher signup now requires a private invite link from an admin." },
    { status: 410 }
  );
}
