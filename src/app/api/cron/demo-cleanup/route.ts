import { NextResponse, type NextRequest } from "next/server";
import { cleanupExpiredSandboxes } from "@/lib/demo/reseed";

// Reaps expired "Try the live demo" sandboxes — deletes each throwaway user
// (which cascade-removes its profile) and its org (which cascade-removes all
// tenant data). Runs hourly; sandboxes live SANDBOX_TTL_HOURS before they qualify.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orgs, users } = await cleanupExpiredSandboxes();
    return NextResponse.json({ purgedOrgs: orgs, purgedUsers: users });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Cleanup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
