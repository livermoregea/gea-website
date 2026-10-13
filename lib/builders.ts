export const BUILDER_TIERS = [
  { name: "Starter", min: 10 },
  { name: "Builder", min: 30 },
  { name: "Innovator", min: 60 },
  { name: "GEA Builder", min: 100 },
] as const;

export const BUILDER_RUBRIC = [
  { key: "solves_problem", label: "Completed project that solves a real problem", points: 10 },
  { key: "helps_others", label: "Helps someone other than the builder", points: 5 },
  { key: "gea_skills", label: "Uses a skill learned in GEA", points: 5 },
  { key: "clear_evidence", label: "Clear explanation plus project video", points: 5 },
] as const;

export type BuilderSubmission = {
  id: string; student_id: string; parent_id: string | null;
  title: string; location: string; problem: string; build: string; skills: string; team: string;
  evidence_url: string; wall_opt_out: boolean; wall_hidden: boolean;
  wall_name: string; wall_title: string; wall_problem: string; wall_build: string;
  status: "pending" | "needs_changes" | "approved";
  solves_problem: boolean; helps_others: boolean; gea_skills: boolean; clear_evidence: boolean;
  points: number; officer_note: string; created_at: string; reviewed_at: string | null;
};
export type BuilderStory = {
  id: string; first_name: string; title: string; location: string; problem: string; build: string;
};
export type BuilderRecognition = { student_id: string; threshold: number; certificate: boolean; shoutout: boolean };

export function builderProgress(points: number) {
  const tier = [...BUILDER_TIERS].reverse().find(t => points >= t.min);
  const next = BUILDER_TIERS.find(t => points < t.min);
  return { tier, next, percent: Math.min(100, Math.round(points / (next?.min ?? 100) * 100)) };
}
export function builderError(error: { code?: string; message: string }) {
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(error.code ?? "")) {
    return "GEA Builders is not ready yet. Please try again after the program is set up.";
  }
  if (error.code === "P0001") return error.message;
  return "We couldn’t save this change. Refresh and try again.";
}
