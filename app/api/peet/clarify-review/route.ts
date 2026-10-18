import { generateObject } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { reviewerAssessmentSchema, reviewerClarificationPrompt, reviewerQuestionsRequestSchema } from "@/lib/peet-ai";
import { loadPeetReview, savePeetReview, reviewEvidence, limitPeetAI, peetBody, peetFailure, peetModel } from "@/lib/peet-ai-server";

export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const body = await peetBody(request, reviewerQuestionsRequestSchema);
    const { actor, task, source } = await loadPeetReview(body.taskId, body.version);
    const { model, modelId } = peetModel();
    await limitPeetAI(actor.user.id);
    const { object } = await generateObject({
      model, schema: reviewerAssessmentSchema, temperature: 0,
      system: `${reviewerClarificationPrompt}\nJSON schema: ${JSON.stringify(z.toJSONSchema(reviewerAssessmentSchema))}`,
      prompt: JSON.stringify({ ...reviewEvidence(task, source), reviewerNotes: body.reviewerNotes }),
      abortSignal: AbortSignal.timeout(45000), maxRetries: 1, maxOutputTokens: 2000,
    });
    const updated = await savePeetReview(task, actor.user.id, source, "questions", reviewerAssessmentSchema.parse(object), body.reviewerNotes, [], modelId);
    return NextResponse.json({ task: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return peetFailure(error); }
}
