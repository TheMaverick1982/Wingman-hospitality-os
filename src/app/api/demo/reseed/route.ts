import { NextResponse, type NextRequest } from "next/server";
import { reseedDemoOrg } from "@/lib/demo/reseed";

// Ops endpoint to bootstrap / reseed the demo org on demand — handy for a first
// deploy (so the very first wingmandemo login works) or a scheduled refresh.
// Guarded by CRON_SECRET, same as the cron routes; the on-login path in
// src/app/login/actions.ts is the normal trigger.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ctx = await reseedDemoOrg();
    return NextResponse.json({ ok: true, orgId: ctx.orgId, locations: ctx.locationIds.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reseed failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
