import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDunningForOrg } from "@/lib/billing";

// Runs daily. For every past-due org it re-nudges the customer on an interval,
// and once they cross 30 days unpaid it closes the account and alerts the owner.
// Provider-agnostic: it reads the billing state the payment webhook maintains.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, name, payment_failed_at, dunning_last_notified_at")
    .eq("billing_status", "past_due");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: string[] = [];
  for (const org of orgs ?? []) {
    try {
      results.push(await runDunningForOrg(admin, org as never));
    } catch {
      results.push(`error:${(org as { id: string }).id}`);
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
