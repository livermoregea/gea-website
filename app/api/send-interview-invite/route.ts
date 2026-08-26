import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSchoolEmail } from "@/lib/roles";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { error: "Interview draft generation is unavailable in demo mode." },
      { status: 503 }
    );
  }

  // 1. Verify the caller is a signed-in admin using the cookie-bound,
  //    RLS-respecting client — never trust the request body for this.
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

  const { applicationId } = await request.json();
  if (!applicationId) {
    return NextResponse.json({ error: "Missing applicationId." }, { status: 400 });
  }

  // 2. Use the service-role client for the privileged read/write.
  const admin = createAdminClient();
  const { data: application, error: fetchError } = await admin
    .from("applications")
    .select("id, name, role, school_email, status, interview_token")
    .eq("id", applicationId)
    .single();

  if (fetchError || !application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  if (!isSchoolEmail(application.school_email)) {
    return NextResponse.json(
      { error: "Applicant email is not a verified school email — refusing to generate draft." },
      { status: 400 }
    );
  }

  const token = application.interview_token ?? crypto.randomUUID();
  if (!application.interview_token) {
    const { error: updateError } = await admin
      .from("applications")
      .update({ interview_token: token })
      .eq("id", applicationId);

    if (updateError) {
      return NextResponse.json({ error: "Could not update application." }, { status: 500 });
    }
  }

  const siteUrl = "https://livermoregea.org";
  const bookingLink = `${siteUrl}/interview/${token}`;
  const firstName = application.name.split(" ")[0] || application.name;
  const subject = `GEA Leadership Interview — ${application.role}`;
  const body = `Hi ${firstName},

Thanks for applying for a GEA leadership position. We'd like to move forward with an interview
during lunch. Please pick an available time using the link below:

${bookingLink}

This link is unique to you — please don't share it.

— GEA Leadership Team`;

  return NextResponse.json({ ok: true, bookingLink, email: { subject, body } });
}
