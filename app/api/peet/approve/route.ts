import { NextResponse } from "next/server";
import { approveSchema } from "@/lib/peet-ai";
import { dbFailure, peetActor, peetBody, peetFailure, PeetHttpError } from "@/lib/peet-ai-server";

export async function POST(request: Request) {
  try {
    const actor = await peetActor();
    if (!actor.reviewer) throw new PeetHttpError(403, "PEET reviewer access required.");
    const body = await peetBody(request, approveSchema);
    const { data: task, error } = await actor.supabase.rpc("approve_gea_peet_task", {
      p_task_id: body.taskId, p_version: body.version,
      p_scores: body.scores, p_override_reason: body.overrideReason,
    });
    if (error) dbFailure(error);
    return NextResponse.json({ task }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return peetFailure(error); }
}
