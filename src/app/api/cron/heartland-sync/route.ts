import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncHeartland } from "@/lib/heartland-retail-sync";

// Daily: sync every connected Heartland Retail account (customers → Guests,
// last-7-day completed tickets → Business Health, per location by name match).
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: conns } = await admin.from("heartland_retail_connections").select("org_id, account_host");
  const rows = (conns ?? []) as { org_id: string; account_host: string }[];

  let synced = 0;
  for (const row of rows) {
    const res = await syncHeartland(row.org_id, row.account_host);
    if (!res.error) synced++;
  }
  return NextResponse.json({ ok: true, accounts: rows.length, synced });
}
