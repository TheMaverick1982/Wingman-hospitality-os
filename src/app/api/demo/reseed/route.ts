import { NextResponse, type NextRequest } from "next/server";
import { reseedDemoOrg } from "@/lib/demo/reseed";
import { createAdminClient } from "@/lib/supabase/admin";

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
    // Report what actually landed, so a single call reveals whether the tests
    // and their assignments seeded (if these are 0, check the logs for a
    // "[demo] seedTest(...) failed" line — a silent insert error).
    const admin = createAdminClient();
    const [{ count: tests }, { count: assignments }] = await Promise.all([
      admin.from("tests").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId),
      admin.from("test_assignments").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId),
    ]);
    return NextResponse.json({ ok: true, orgId: ctx.orgId, locations: ctx.locationIds.length, tests: tests ?? 0, assignments: assignments ?? 0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reseed failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
