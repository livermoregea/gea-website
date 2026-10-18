import { NextResponse } from "next/server";
import { finalizeSchema } from "@/lib/peet-ai";
import { dbFailure, peetActor, peetBody, peetFailure, PeetHttpError } from "@/lib/peet-ai-server";

export async function POST(request: Request) {
  try {
    const actor = await peetActor();
    if (!actor.student) throw new PeetHttpError(403, "Student access required.");
    const body = await peetBody(request, finalizeSchema);
    const { data: task, error } = await actor.supabase.rpc("finalize_gea_peet_task", {
      p_task_id: body.taskId, p_version: body.version, p_answers: body.answers,
    });
    if (error) dbFailure(error);
    return NextResponse.json({ task }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return peetFailure(error); }
}
