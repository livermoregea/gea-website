import Link from "next/link";
import { notFound } from "next/navigation";
import TeacherInviteSignupForm from "@/components/TeacherInviteSignupForm";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function TeacherInviteSignupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6 md:py-24">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Teacher Signup</p>
        <h1 className="mt-4 font-display text-2xl font-medium text-forest">Demo mode</h1>
        <p className="mt-3 text-sm text-graphite/70">Teacher invites are disabled until Supabase is configured.</p>
      </div>
    );
  }

  const supabase = createAdminClient();
  const { data: invite } = await supabase
    .from("teacher_invites")
    .select("teacher_name, teacher_email, expires_at, used_at")
    .eq("invite_token", token)
    .maybeSingle();

  if (!invite) {
    notFound();
  }

  const expiresAt = new Date(invite.expires_at);
  const now = new Date();
  if (invite.used_at || expiresAt <= now) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6 md:py-24">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Teacher Signup</p>
        <h1 className="mt-4 font-display text-2xl font-medium text-forest">Invite expired</h1>
        <p className="mt-3 text-sm text-graphite/70">
          This invite has already been used or it expired. Please ask an admin for a new teacher link.
        </p>
        <Link href="/login" className="mt-4 inline-flex text-sm text-forest underline decoration-gold underline-offset-4">
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Teacher Signup</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest">Finish your account</h1>
      <p className="mt-3 text-sm text-graphite/70">
        Use the private invite link from your school to create your teacher account.
      </p>
      <div className="dim-divider my-8" />
      <TeacherInviteSignupForm
        token={token}
        teacherName={invite.teacher_name}
        teacherEmail={invite.teacher_email}
      />
    </div>
  );
}
