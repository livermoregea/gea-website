import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Student account approval has been removed. Students now create accounts immediately, and admins can use the student management panel to remove and blacklist emails if needed.",
    },
    { status: 410 }
  );
}
