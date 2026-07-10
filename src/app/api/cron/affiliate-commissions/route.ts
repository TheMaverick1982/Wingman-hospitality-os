import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accrueAllActiveReferrals } from "@/lib/affiliate-commissions";

// Monthly safety net: accrue commissions for active referred orgs. This is
// idempotent with the webhook-driven accrual (unique org_id + period_month), so
// when the payment processor is sending "payment succeeded" events this cron is
// a no-op; until then it keeps commissions flowing from billing_status alone.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await accrueAllActiveReferrals(admin);
  return NextResponse.json({ ok: true, ...result });
}
