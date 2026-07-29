import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSchoolEmail } from "@/lib/roles";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { error: "Interview invites are unavailable in demo mode." },
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
  const { data: adminRow } = await supabase
    .from("admins")
    .select("auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!adminRow) {
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
      { error: "Applicant email is not a verified school email — refusing to send." },
      { status: 400 }
    );
  }

  const token = application.interview_token ?? crypto.randomUUID();
  const { error: updateError } = await admin
    .from("applications")
    .update({ interview_token: token, status: "invited", invite_sent_at: new Date().toISOString() })
    .eq("id", applicationId);

  if (updateError) {
    return NextResponse.json({ error: "Could not update application." }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const bookingLink = `${siteUrl}/interview/${token}`;

  // 3. Send the email via Resend. Requires RESEND_API_KEY and a
  //    verified sending domain — see README for setup.
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      {
        error:
          "RESEND_API_KEY is not configured, so no email was sent. The booking link is: " +
          bookingLink,
      },
      { status: 500 }
    );
  }

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? "GEA Leadership <noreply@yourdomain.org>",
      to: application.school_email,
      subject: `GEA Leadership Interview — ${application.role}`,
      html: `
        <p>Hi ${application.name.split(" ")[0]},</p>
        <p>Thanks for applying for a GEA leadership position. We'd like to move forward with an
        interview during lunch. Please pick an available time using the link below:</p>
        <p><a href="${bookingLink}">${bookingLink}</a></p>
        <p>This link is unique to you — please don't share it.</p>
        <p>— GEA Leadership Team</p>
      `,
    }),
  });

  if (!emailRes.ok) {
    return NextResponse.json({ error: "Resend API rejected the email." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, bookingLink });
}
