import "server-only";
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SurveyLink = { location_id: string; code: string; scan_count: number };

// Ensure every location in the org has a survey link (short code for /s/<code>).
// Creates missing ones with a unique code — mirrors the job-openings code
// assignment. Returns all links keyed by location_id.
export async function ensureSurveyLinks(admin: SupabaseClient, orgId: string): Promise<Map<string, SurveyLink>> {
  const { data: locs } = await admin.from("locations").select("id").eq("org_id", orgId);
  const locationIds = ((locs ?? []) as { id: string }[]).map((l) => l.id);

  const { data: existing } = await admin
    .from("guest_survey_links")
    .select("location_id, code, scan_count")
    .eq("org_id", orgId);
  const byLoc = new Map<string, SurveyLink>();
  for (const r of (existing ?? []) as SurveyLink[]) byLoc.set(r.location_id, r);

  for (const locId of locationIds) {
    if (byLoc.has(locId)) continue;
    for (let i = 0; i < 5; i++) {
      const code = randomBytes(5).toString("hex").slice(0, 7);
      const { error } = await admin.from("guest_survey_links").insert({ org_id: orgId, location_id: locId, code });
      if (!error) {
        byLoc.set(locId, { location_id: locId, code, scan_count: 0 });
        break;
      }
    }
  }
  return byLoc;
}
