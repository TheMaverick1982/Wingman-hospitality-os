import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncOrgReviews } from "@/lib/google-review-sync";

// Weekly: pull fresh Google reviews for every connected location and refresh its
// AI insight. Owners can also refresh on demand from Guest Reviews.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: rows } = await admin.from("google_review_locations").select("org_id");
  const orgIds = Array.from(new Set(((rows ?? []) as { org_id: string }[]).map((r) => r.org_id)));

  let locations = 0;
  let synced = 0;
  for (const orgId of orgIds) {
    const res = await syncOrgReviews(orgId);
    locations += res.locations;
    synced += res.synced;
  }
  return NextResponse.json({ ok: true, orgs: orgIds.length, locations, synced });
}
