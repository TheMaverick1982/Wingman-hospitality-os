import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncToastOrg } from "@/lib/toast-sync";

// Daily: sync every org that has connected Toast (check customers → Guests,
// last-7-day sales → Business Health, per restaurant by name match).
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: conns } = await admin.from("toast_connections").select("org_id");
  const orgIds = [...new Set(((conns ?? []) as { org_id: string }[]).map((c) => c.org_id))];

  let synced = 0;
  for (const orgId of orgIds) {
    const res = await syncToastOrg(orgId);
    if (!res.error) synced++;
  }
  return NextResponse.json({ ok: true, orgs: orgIds.length, synced });
}
