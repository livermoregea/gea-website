import { createOpenAI } from "@ai-sdk/openai";
import { wrapLanguageModel } from "ai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { PeetTask, PeetSourceTask } from "@/lib/peet-ai";

export class PeetHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function peetActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new PeetHttpError(401, "Sign in to GEA One to continue.");
  const { data: access, error } = await supabase.rpc("gea_peet_access");
  if (error) throw new PeetHttpError(503, "PEET scoring is awaiting database setup. Contact an advisor.");
  const rights = access as { student: boolean; reviewer: boolean };
  if (!rights.student && !rights.reviewer) throw new PeetHttpError(403, "Student or PEET reviewer access required.");
  return { supabase, user, ...rights };
}
export function peetModel() {
  if (!process.env.GROQ_API_KEY) throw new PeetHttpError(503, "AI scoring is not configured. Contact an advisor.");
  const modelId = process.env.GROQ_PEET_MODEL || "llama-3.3-70b-versatile";
  const provider = createOpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY });
  // Llama supports JSON object mode, rather than OpenAI's strict JSON Schema mode.
  const model = wrapLanguageModel({ model: provider.chat(modelId), middleware: {
    specificationVersion: "v3",
    transformParams: async ({ params }) => ({ ...params,
      responseFormat: params.responseFormat?.type === "json" ? { type: "json" } : params.responseFormat,
    }),
  } });
  return { model, modelId };
}
export function peetAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new PeetHttpError(503, "PEET scoring is not configured. Contact an advisor.");
  return createAdminClient();
}
export async function limitPeetAI(userId: string) {
  const { data, error } = await peetAdmin().rpc("reserve_gea_peet_ai_request", { p_user_id: userId });
  if (error) throw new PeetHttpError(503, "Could not start the assessment. Please try again.");
  if (!data) throw new PeetHttpError(429, "Too many AI requests. Please wait ten minutes before trying again.");
}
export async function peetBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new PeetHttpError(403, "Submit changes from GEA One.");
  if (Number(request.headers.get("content-length") || 0) > 24000) throw new PeetHttpError(413, "Submission is too large.");
  // Bound bytes while reading, including chunked bodies and multibyte text.
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let raw = "", bytes = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 24000) {
          void reader.cancel().catch(() => {});
          throw new PeetHttpError(413, "Submission is too large.");
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
  }
  try { return schema.parse(JSON.parse(raw)); }
  catch { throw new PeetHttpError(400, "Check the required fields and allowed lengths, then try again."); }
}
export function peetFailure(error: unknown) {
  if (error instanceof PeetHttpError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  // Never return prompts, student data, keys, or provider response bodies.
  return NextResponse.json({ error: "The AI assessment could not finish. Please try again; no evaluation was approved." }, { status: 502, headers: { "Cache-Control": "no-store" } });
}

export async function loadPeetReview(taskId: string, version: number) {
  const actor = await peetActor();
  if (!actor.reviewer) throw new PeetHttpError(403, "PEET reviewer access required.");
  const { data, error } = await actor.supabase.from("gea_peet_tasks").select("*").eq("id", taskId).maybeSingle();
  if (error) dbFailure(error);
  const task = data as PeetTask | null;
  if (!task) throw new PeetHttpError(404, "Task submission unavailable.");
  const { data: allowed, error: rightsError } = await actor.supabase.rpc("gea_peet_can_review", { p_task_id: task.task_id });
  if (rightsError || !allowed) throw new PeetHttpError(403, "An independent reviewer is required; the President’s work needs an advisor.");
  if (task.status !== "pending" || task.version !== version) throw new PeetHttpError(409, "This review changed. Refresh the page.");
  const { data: source, error: sourceError } = await actor.supabase.rpc("gea_peet_source_task", { p_task_id: task.task_id });
  if (sourceError) dbFailure(sourceError);
  if (!source || source.status !== "submitted" || source.cancelled_at) throw new PeetHttpError(409, "The original task changed or is closed. Refresh the page.");
  return { actor, task, source: source as PeetSourceTask };
}

export function reviewEvidence(task: PeetTask, source: PeetSourceTask) {
  return { originalTask: source, submitterDescription: task.description, category: task.category,
    studentQuestionsAndAnswers: task.assessment.studentQuestions.map((question, i) => ({ question, answer: task.answers[i] })) };
}

export async function savePeetReview(task: PeetTask, actorId: string, source: PeetSourceTask, stage: "questions" | "score", result: unknown, notes: string, answers: string[], modelId: string) {
  const fresh = await loadPeetReview(task.id, task.version);
  if (fresh.actor.user.id !== actorId) throw new PeetHttpError(403, "Your reviewer session changed. Refresh the page.");
  if (JSON.stringify(fresh.source) !== JSON.stringify(source)) throw new PeetHttpError(409, "The task goals or deliverables changed. Start the review again.");
  const { data: updated, error } = await peetAdmin().rpc("save_gea_peet_review", {
    p_task_id: task.id, p_version: task.version, p_actor: actorId, p_source_context: source,
    p_stage: stage, p_result: result, p_notes: notes, p_answers: answers, p_model: modelId,
  });
  if (error) dbFailure(error);
  return updated as PeetTask;
}
export function dbFailure(error: { code?: string }) {
  if (["42883", "42703", "PGRST202", "PGRST204", "PGRST205"].includes(error.code || "")) throw new PeetHttpError(503, "Task clarification needs the latest database migration. Please contact an advisor.");
  if (error.code === "P0001") throw new PeetHttpError(409, "This task changed or is unavailable. Refresh the page before continuing.");
  throw new PeetHttpError(503, "Could not save the task. Please try again.");
}
