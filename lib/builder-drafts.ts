import type { BuilderSubmission } from "@/lib/builders";

export type BuilderDraft = {
  title: string;
  location: string;
  problem: string;
  build: string;
  skills: string;
  team: string;
  evidence: string;
  optOut: boolean;
};

export function createBuilderDraft(submission?: BuilderSubmission | null): BuilderDraft {
  return {
    title: submission?.title ?? "",
    location: submission?.location ?? "home",
    problem: submission?.problem ?? "",
    build: submission?.build ?? "",
    skills: submission?.skills ?? "",
    team: submission?.team ?? "",
    evidence: submission?.evidence_url ?? "",
    optOut: submission?.wall_opt_out ?? false,
  };
}

export function readBuilderDraft(fields: FormData): BuilderDraft {
  return {
    title: String(fields.get("title") ?? ""),
    location: String(fields.get("location") ?? "home"),
    problem: String(fields.get("problem") ?? ""),
    build: String(fields.get("build") ?? ""),
    skills: String(fields.get("skills") ?? ""),
    team: String(fields.get("team") ?? ""),
    evidence: String(fields.get("evidence") ?? ""),
    optOut: fields.has("optOut"),
  };
}

export function hasBuilderDraftChanges(draft: BuilderDraft, original: BuilderDraft): boolean {
  return (Object.keys(original) as (keyof BuilderDraft)[]).some(key => draft[key] !== original[key]);
}
