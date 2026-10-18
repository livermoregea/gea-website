import { generateObject } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { assessmentSchema, clarificationPrompt, submissionSchema, type PeetSourceTask } from "@/lib/peet-ai";
import { productLink } from "@/lib/peet";
import { dbFailure, limitPeetAI, peetActor, peetAdmin, peetBody, peetFailure, PeetHttpError, peetModel } from "@/lib/peet-ai-server";

export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const actor = await peetActor();
    const body = await peetBody(request, submissionSchema);
    if (body.requestForSubmitter) {
      if (!actor.reviewer) throw new PeetHttpError(403, "Reviewer access is required to request clarification from a submitter.");
      const { data: allowed, error } = await actor.supabase.rpc("gea_peet_can_review", { p_task_id: body.officerTaskId });
      if (error || !allowed) throw new PeetHttpError(403, "An independent authorized reviewer must request clarification.");
    } else {
      if (!actor.student) throw new PeetHttpError(403, "Active officer access is required to submit work for PEET review.");
      const { data: participant } = await actor.supabase.rpc("is_officer_task_participant", { p_task_id: body.officerTaskId });
      if (!participant) throw new PeetHttpError(403, "You can only submit work for your own tasks.");
    }
    const { data: sourceData, error: sourceError } = await actor.supabase.rpc("gea_peet_source_task", { p_task_id: body.officerTaskId });
    if (sourceError) dbFailure(sourceError);
    const source = sourceData as PeetSourceTask;
    if (!source || source.cancelled_at || source.status === "completed") throw new PeetHttpError(409, "This task is closed or unavailable.");
    if (body.requestForSubmitter && source.status !== "submitted") throw new PeetHttpError(409, "The officer must submit their work before you request clarification.");
    const { data: existing, error: existingError } = await actor.supabase.from("gea_peet_tasks").select("*").eq("task_id", source.id).maybeSingle();
    if (existingError) dbFailure(existingError);
    if (existing) return NextResponse.json({ task: existing }, { headers: { "Cache-Control": "no-store" } });
    const submissionUrl = source.status === "submitted" ? source.final_product_url || "" : body.submissionUrl;
    if (submissionUrl && !productLink(submissionUrl)) throw new PeetHttpError(400, "Enter a valid HTTP or HTTPS supporting link, or leave it blank.");
    const studentId = body.requestForSubmitter ? source.assigned_to : actor.user.id;
    const submission = { description: body.requestForSubmitter ? source.submission_description.slice(0, 5000) || "Supporting deliverable submitted for review." : body.description,
      category: body.category, submissionUrl };
    const { model, modelId } = peetModel();
    await limitPeetAI(actor.user.id);
    const { object } = await generateObject({
      model, schema: assessmentSchema, temperature: 0,
      system: `${clarificationPrompt}\nJSON schema: ${JSON.stringify(z.toJSONSchema(assessmentSchema))}`,
      prompt: JSON.stringify({ originalTask: source, submission }),
      abortSignal: AbortSignal.timeout(45000), maxRetries: 1, maxOutputTokens: 1600,
    });
    if (body.requestForSubmitter) {
      const { data: allowed } = await actor.supabase.rpc("gea_peet_can_review", { p_task_id: source.id });
      if (!allowed) throw new PeetHttpError(403, "Your reviewer access changed. Reopen this task.");
    }
    const { data: task, error } = await peetAdmin().rpc("save_gea_peet_assessment", {
      p_task_id: source.id, p_student_id: studentId, p_description: submission.description,
      p_category: submission.category, p_source_context: source,
      p_assessment: assessmentSchema.parse(object), p_model: modelId,
      p_submission_url: submissionUrl || null,
    });
    if (error) dbFailure(error);
    return NextResponse.json({ task }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return peetFailure(error); }
}
