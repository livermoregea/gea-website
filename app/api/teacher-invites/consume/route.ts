import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Payload = {
  token?: string;
  password?: string;
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
      { error: "Teacher invitations are unavailable until Supabase is configured." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as Payload;
  const token = body.token?.trim() ?? "";
  const password = body.password?.trim() ?? "";

  if (!token || !password) {
    return NextResponse.json({ error: "Missing invite details." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: invite, error: inviteError } = await supabase
    .from("teacher_invites")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "That teacher invite link is not valid." }, { status: 404 });
  }

  const now = new Date();
  const expiresAt = invite.expires_at ? new Date(invite.expires_at) : null;
  if ((invite.used_at && new Date(invite.used_at) <= now) || (expiresAt && expiresAt <= now)) {
    return NextResponse.json({ error: "That invite link has expired or already been used." }, { status: 410 });
  }

  const email = invite.teacher_email as string;
  const fullName = invite.teacher_name as string;
  const existingUser = await findAuthUserByEmail(supabase, email);

  let authUser = existingUser;

  if (!authUser) {
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        account_type: "teacher",
      },
    });

    if (createUserError || !createdUser.user) {
      return NextResponse.json(
        { error: createUserError?.message ?? "Could not create the teacher account." },
        { status: 400 }
      );
    }

    authUser = createdUser.user;
  } else {
    const { error: updateUserError } = await supabase.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        account_type: "teacher",
      },
    });

    if (updateUserError) {
      return NextResponse.json(
        { error: updateUserError.message ?? "Could not update the teacher account." },
        { status: 400 }
      );
    }
  }

  const { error: profileError } = await supabase.from("teacher_profiles").upsert(
    {
      auth_user_id: authUser.id,
      auth_email: email,
      full_name: fullName,
      school_email: email,
    },
    { onConflict: "auth_user_id" }
  );

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message ?? "Could not save the teacher profile." },
      { status: 400 }
    );
  }

  const { error: inviteUpdateError } = await supabase
    .from("teacher_invites")
    .update({
      used_at: new Date().toISOString(),
      used_auth_user_id: authUser.id,
    })
    .eq("id", invite.id);

  if (inviteUpdateError) {
    return NextResponse.json(
      { error: inviteUpdateError.message ?? "Could not mark the invite as used." },
      { status: 400 }
    );
  }

  return NextResponse.json({ authEmail: email });
}
