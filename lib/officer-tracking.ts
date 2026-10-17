export const CONTRACT_YEAR = "2026-2027";
export type OfficerEvent = {
  id: string; title: string; kind: "meeting" | "volunteer" | "outreach"; academic_year: string;
  starts_at: string; ends_at: string; location: string; mandatory: boolean; gea_approved: boolean;
  cancelled: boolean; notes: string;
  public_volunteering?: boolean; public_description?: string; public_signup_open?: boolean; public_capacity?: number | null;
};
export type OfficerAttendance = {
  id: string; event_id: string; officer_id: string;
  status: "unmarked" | "present" | "late" | "excused" | "unexcused";
  absence_notice: string; notice_at: string | null; reviewer_notes: string;
};
export type EventSignup = { id: string; event_id: string; officer_id: string; committed: boolean; assigned?: boolean; participation_role?: string; participation_notes?: string; version?: number };
export function eventParticipationLabel(signup?: EventSignup) {
  return signup?.assigned ? (signup.committed ? "Assigned · Requested" : "Assigned") : signup?.committed ? "Requested" : "Not requested";
}
export type VolunteerLog = {
  id: string; event_id: string; officer_id: string; check_in: string; check_out: string; minutes: number;
  notes: string; status: "pending" | "approved" | "rejected"; review_notes: string; reviewed_at: string | null;
};
export type OfficerStrike = {
  id: string; officer_id: string; academic_year: string; category: "attendance" | "conduct";
  incident_date: string; reason: string; attendance_id: string | null;
  status: "notified" | "confirmed" | "dismissed" | "revoked";
  notified_at: string; response_due_at: string; officer_response: string; responded_at: string | null;
  decision_notes: string; decided_at: string | null;
};
export type RemovalReview = {
  id: string; officer_id: string; academic_year: string; category: "attendance" | "conduct";
  status: "pending" | "retained" | "removal_approved"; advisor_notes: string; opened_at: string;
  context_snapshot: { peet_score: number | null; confirmed_strikes: OfficerStrike[] };
};
export type TrackingData = {
  events: OfficerEvent[]; attendance: OfficerAttendance[]; signups: EventSignup[];
  volunteerLogs: VolunteerLog[]; strikes: OfficerStrike[]; reviews: RemovalReview[];
  generalNotes: AccountabilityNotes[];
};
export type AccountabilityNotes = { id: string; officer_id: string; academic_year: string; notes: string; updated_at: string };
export function trackingSummary(data: TrackingData, officerId: string, year: string) {
  const events = data.events.filter(event => event.academic_year === year && !event.cancelled);
  const meetings = new Set(events.filter(event => event.kind === "meeting").map(event => event.id));
  const service = new Set(events.filter(event => event.kind !== "meeting" && event.gea_approved).map(event => event.id));
  const attendance = data.attendance.filter(row => row.officer_id === officerId && meetings.has(row.event_id));
  const approved = data.volunteerLogs.filter(row => row.officer_id === officerId && service.has(row.event_id) && row.status === "approved");
  const strikes = data.strikes.filter(row => row.officer_id === officerId && row.academic_year === year && row.status === "confirmed");
  return {
    present: attendance.filter(row => ["present", "late"].includes(row.status)).length,
    excused: attendance.filter(row => row.status === "excused").length,
    unexcused: attendance.filter(row => row.status === "unexcused").length,
    volunteerEvents: new Set(approved.filter(row => row.minutes > 0).map(row => row.event_id)).size,
    volunteerMinutes: approved.reduce((total, row) => total + Number(row.minutes), 0),
    attendanceStrikes: strikes.filter(row => row.category === "attendance").length,
    conductStrikes: strikes.filter(row => row.category === "conduct").length,
  };
}
export function durationLabel(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
// Event schedules and logged service use the school's timezone on every device.
export function schoolDate(value: string, withTime = true) {
  return new Date(value.length === 10 ? `${value}T12:00:00-07:00` : value).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const : {}),
  });
}
export function localDateInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** Calendar date at the school, regardless of the officer's device timezone. */
export function schoolToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
