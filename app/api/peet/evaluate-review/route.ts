import { generateObject } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { recommendationSchema, reviewSchema, scoringPrompt } from "@/lib/peet-ai";
import { loadPeetReview, savePeetReview, reviewEvidence, limitPeetAI, peetBody, peetFailure, PeetHttpError, peetModel } from "@/lib/peet-ai-server";

export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const body = await peetBody(request, reviewSchema);
    const { actor, task, source } = await loadPeetReview(body.taskId, body.version);
    if (!task.reviewer_assessment || task.questions_by !== actor.user.id) throw new PeetHttpError(409, "Generate your reviewer questions before calculating a score.");
    if (JSON.stringify(source) !== JSON.stringify(task.source_context)) throw new PeetHttpError(409, "The task goals or deliverables changed. Refresh reviewer questions first.");
    if (body.answers.length !== task.reviewer_assessment.reviewerQuestions.length) throw new PeetHttpError(400, "Answer every reviewer question before calculating a score.");
    const { model, modelId } = peetModel();
    await limitPeetAI(actor.user.id);
    const { object } = await generateObject({
      model, schema: recommendationSchema, temperature: 0,
      system: `${scoringPrompt}\nJSON schema: ${JSON.stringify(z.toJSONSchema(recommendationSchema))}`,
      prompt: JSON.stringify({ ...reviewEvidence(task, source), reviewerNotes: task.reviewer_notes,
        reviewerQuestionsAndAnswers: task.reviewer_assessment.reviewerQuestions.map((question, i) => ({ question, answer: body.answers[i] })) }),
      abortSignal: AbortSignal.timeout(45000), maxRetries: 1, maxOutputTokens: 2000,
    });
    const updated = await savePeetReview(task, actor.user.id, source, "score", recommendationSchema.parse(object), task.reviewer_notes, body.answers, modelId);
    return NextResponse.json({ task: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return peetFailure(error); }
}
