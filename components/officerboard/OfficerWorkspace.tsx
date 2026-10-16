import GEAOneBadge from "@/components/GEAOneBadge";
import Link from "next/link";
import LoginForm from "@/components/LoginForm";
import OfficerBoard from "@/components/officerboard/OfficerBoard";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { peetError, type OfficerTask, type PeetEvaluation, type OfficerProfile, type TaskCancellationRequest, type TaskTeammate } from "@/lib/peet";
import type { OfficerEvent, OfficerAttendance, EventSignup, VolunteerLog, OfficerStrike, RemovalReview, AccountabilityNotes } from "@/lib/officer-tracking";


export default async function OfficerWorkspace({ embedded = false }: { embedded?: boolean }) {
  if (!hasSupabaseConfig()) return <AccessMessage message="The officer portal is awaiting account setup. Please contact an advisor." />;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <GEAOneBadge />
      <p className="mt-4 text-sm font-semibold text-[#064e3b]">GEA Officer Board</p>
      <h1 className="mt-3 text-3xl font-semibold text-forestdeep">Your work. Your progress.</h1>
      <p className="mb-8 mt-3 text-graphite/80">Sign in with your GEA One account. Access is reserved for designated officers and PEET reviewers.</p>
      <LoginForm redirectTo="/account/redirect" />
    </div>
  );
  const { data: profile, error } = await supabase.from("officer_profiles").select("id,name,role,position,reviewer_kind,peet_onboarding_seen_at,access_enabled").eq("id", user.id).maybeSingle();
  if (error) return <AccessMessage message={peetError(error)} />;
  if (!profile || profile.access_enabled === false) return <AccessMessage message="Your GEA One account doesn’t have officer access. Ask a President or advisor to add you to the officer roster." />;
  const { data: superAdmin } = await supabase.from("super_admins").select("auth_user_id").eq("auth_user_id",user.id).maybeSingle();
  const [tasks, evaluations, profiles, events, attendance, signups, volunteerLogs, strikes, reviews, generalNotes, cancellationRequests, teammates] = await Promise.all([
    readAll<OfficerTask>((from, to) => supabase.from("tasks").select("id,title,description,assigned_to,created_by,due_date,original_due_date,status,final_product_url,submission_description,created_at,submitted_at,completed_at,ended_by,end_notes,cancelled_at,cancellation_reason,officer_task_members(officer_id)").order("created_at", { ascending: false }).order("id").range(from, to)),
    readAll<PeetEvaluation>((from, to) => supabase.from("peet_evaluations").select("id,task_id,evaluated_by,efficiency,effectiveness,time,feedback_notes,evaluated_at").order("id").range(from, to)),
    readAll<OfficerProfile>((from,to) => supabase.rpc("officer_directory").order("name").order("id").range(from,to)),
    readAll<OfficerEvent>((from,to) => supabase.from("officer_events").select("id,title,kind,academic_year,starts_at,ends_at,location,mandatory,gea_approved,cancelled,notes").order("starts_at").order("id").range(from,to)),
    readAll<OfficerAttendance>((from,to) => supabase.from("officer_attendance").select("id,event_id,officer_id,status,absence_notice,notice_at,reviewer_notes").order("id").range(from,to)),
    readAll<EventSignup>((from,to) => supabase.from("officer_event_signups").select("id,event_id,officer_id,committed").order("id").range(from,to)),
    readAll<VolunteerLog>((from,to) => supabase.from("officer_volunteer_logs").select("id,event_id,officer_id,check_in,check_out,minutes,notes,status,review_notes,reviewed_at").order("created_at",{ascending:false}).order("id").range(from,to)),
    readAll<OfficerStrike>((from,to) => supabase.from("officer_strikes").select("id,officer_id,academic_year,category,incident_date,reason,attendance_id,status,notified_at,response_due_at,officer_response,responded_at,decision_notes,decided_at").order("created_at",{ascending:false}).order("id").range(from,to)),
    readAll<RemovalReview>((from,to) => supabase.from("officer_removal_reviews").select("id,officer_id,academic_year,category,status,advisor_notes,opened_at,context_snapshot").order("opened_at",{ascending:false}).order("id").range(from,to)),
    readAll<AccountabilityNotes>((from,to) => supabase.from("officer_accountability_notes").select("id,officer_id,academic_year,notes,updated_at").order("id").range(from,to)),
    readAll<TaskCancellationRequest>((from,to) => supabase.from("officer_task_cancellation_requests").select("id,task_id,requested_by,reason,status,review_notes,created_at,reviewed_at").order("created_at",{ascending:false}).order("id").range(from,to)),
    readAll<TaskTeammate>((from,to) => supabase.rpc("officer_task_teammates").order("name").order("id").range(from,to)),
  ]);
  const loadError = tasks.error || evaluations.error || profiles.error || events.error || attendance.error || signups.error || volunteerLogs.error || strikes.error || reviews.error || generalNotes.error || cancellationRequests.error || teammates.error;
  if (loadError) return <AccessMessage message={peetError(loadError)} />;
  return <OfficerBoard teammates={teammates.data ?? []} embedded={embedded} cancellationRequests={cancellationRequests.data ?? []} profile={{...profile,...profiles.data?.find(person => person.id === profile.id)}} profiles={profiles.data ?? []} tasks={tasks.data ?? []} evaluations={evaluations.data ?? []} isSuperAdmin={Boolean(superAdmin)} tracking={{ events:events.data??[], attendance:attendance.data??[], signups:signups.data??[], volunteerLogs:volunteerLogs.data??[], strikes:strikes.data??[], reviews:reviews.data??[], generalNotes:generalNotes.data??[] }} />;
}

// Supabase caps rows per response. Fetch every visible page so older evaluations
// continue to count toward the cumulative score as the task history grows.
async function readAll<T>(query: (from: number, to: number) => PromiseLike<{
  data: T[] | null; error: { code?: string; message?: string } | null;
}>) {
  const rows: T[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const result = await query(offset, offset + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < pageSize) return { data: rows, error: null };
  }
}

function AccessMessage({ message }: { message: string }) {
  return <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
    <h1 className="text-3xl font-semibold text-forestdeep">Officer Board</h1>
    <p className="mt-4 text-graphite/80">{message}</p>
    <Link href="/" className="mt-6 inline-flex min-h-11 items-center text-forest underline">Back to GEA</Link>
  </div>;
}
