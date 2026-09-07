import { NextResponse, type NextRequest } from "next/server";
import { extractPendingResumes } from "@/lib/hiring/resume-extract";

// Hourly: extract text from newly-uploaded (and any not-yet-processed) applicant
// resumes so the "Ask about your applicants" AI can search resume content. Bounded
// per run to control cost; new resumes are picked up within the hour and the
// initial backfill catches up over a few runs.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { processed, withText } = await extractPendingResumes(40);
  return NextResponse.json({ ok: true, processed, withText });
}
