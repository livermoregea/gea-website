export type OfficerProfile = {
  id: string; name: string; role: "officer" | "admin";
  position?: string; reviewer_kind?: "president" | "advisor" | null;
  email?: string; is_teacher?: boolean; access_enabled?: boolean;
  peet_onboarding_seen_at?: string | null;
};
export type OfficerTask = {
  id: string; title: string; description: string; assigned_to: string; created_by: string;
  officer_task_members?: { officer_id: string }[];
  due_date: string | null; original_due_date: string | null; status: "in_progress" | "submitted" | "completed";
  final_product_url: string | null; submission_description: string; created_at: string; submitted_at: string | null;
  ended_by?: string | null; end_notes?: string | null; completed_at: string | null; cancelled_at?: string | null; cancellation_reason?: string | null;
};
export type PeetEvaluation = {
  id: string; task_id: string; evaluated_by: string; efficiency: number;
  effectiveness: number; time: number; feedback_notes: string; evaluated_at: string;
};

export function taskAverage(evaluation: PeetEvaluation) {
  return (Number(evaluation.efficiency) + Number(evaluation.effectiveness) + Number(evaluation.time)) / 3;
}

export function peetSummary(tasks: OfficerTask[], evaluations: PeetEvaluation[]) {
  const completed = tasks.filter(task => !task.cancelled_at && task.status === "completed");
  const ids = new Set(completed.map(task => task.id));
  const scored = evaluations.filter(evaluation => ids.has(evaluation.task_id));
  return {
    score: scored.length ? scored.reduce((sum, evaluation) => sum + taskAverage(evaluation), 0) / scored.length / 4 * 100 : null,
    active: tasks.filter(task => !task.cancelled_at && task.status !== "completed").length,
    completed: completed.length,
    evaluated: scored.length,
  };
}

export function productLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /\s/.test(value.trim()) || value.trim().length > 2048) return null;
    return url.href;
  } catch { return null; }
}

export function peetError(error: { code?: string; message?: string } | null) {
  if (["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(error?.code ?? "")) return "The officer portal is awaiting database setup. Please contact an advisor.";
  if (error?.code === "P0001") return error.message ?? "This task could not be saved.";
  return "We couldn’t save your changes. Check your connection and try again.";
}

export type TaskCancellationRequest = { id: string; task_id: string; requested_by: string; reason: string; status: "pending" | "approved" | "rejected"; review_notes: string; created_at: string; reviewed_at: string | null };
export function taskOfficers(profiles: OfficerProfile[]) { return profiles.filter(person => !person.is_teacher && person.reviewer_kind !== "advisor" && person.access_enabled !== false); }

/** Reviewers can manage other officers; ordinary creators keep their existing limits. */
export function canEditOfficerTask(task: OfficerTask, actorId: string, reviewer = false) {
  return !task.cancelled_at && task.status !== "completed"
    && ((reviewer && !isOfficerTaskParticipant(task, actorId)) || (task.created_by === actorId
      && (task.assigned_to !== actorId || task.status === "in_progress")));
}

export function selfTaskDeadlineBounds(originalDate: string | null) {
  if (!originalDate) return null;
  const shift = (days: number) => {
    const date = new Date(`${originalDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  return { min: shift(-3), max: shift(3) };
}

export type TaskTeammate = { id: string; name: string; position: string | null };

export function officerTaskPeople(task: OfficerTask) {
  return Array.from(new Set([task.assigned_to, ...(task.officer_task_members ?? []).map(member => member.officer_id)]));
}
export function isOfficerTaskParticipant(task: OfficerTask, officerId: string) {
  return officerTaskPeople(task).includes(officerId);
}
