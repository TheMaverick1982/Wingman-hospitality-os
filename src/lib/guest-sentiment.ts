import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { avgRating } from "@/lib/guest-survey";

// Guest-survey sentiment for the dashboard card (shown to the whole team). Read
// with the admin client scoped to the org so staff (who don't have direct RLS
// read on responses) still see how guests are feeling + the shout-outs. Only
// aggregates and curated positives are exposed here — never the raw negative
// comments (those stay in the manager-facing Guest Reviews archive).
export type ShoutOut = { server: string; comment: string };
export type GuestSentiment = { count: number; avg: number; shoutouts: ShoutOut[] };

type Row = { server_staff_id: string | null; ratings: Record<string, number> | null; comment: string | null };

export async function getGuestSentiment(orgId: string, locationId?: string | null): Promise<GuestSentiment> {
  const admin = createAdminClient();
  let q = admin
    .from("guest_survey_responses")
    .select("server_staff_id, ratings, comment, created_at")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (locationId) q = q.eq("location_id", locationId);

  let rows: Row[] = [];
  try {
    const { data } = await q;
    rows = (data ?? []) as Row[];
  } catch {
    return { count: 0, avg: 0, shoutouts: [] };
  }

  const rated = rows.filter((r) => avgRating(r.ratings ?? {}) > 0);
  const avg = rated.length ? rated.reduce((a, r) => a + avgRating(r.ratings ?? {}), 0) / rated.length : 0;

  // Positive shout-outs: strongly rated + a named server.
  const positives = rows.filter((r) => avgRating(r.ratings ?? {}) >= 4.5 && r.server_staff_id);
  const ids = [...new Set(positives.map((p) => p.server_staff_id).filter(Boolean) as string[])];
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: staff } = await admin.from("staff_members").select("id, full_name").in("id", ids);
    for (const s of (staff ?? []) as { id: string; full_name: string }[]) {
      nameById.set(s.id, (s.full_name || "").trim().split(/\s+/)[0] || s.full_name);
    }
  }

  const shoutouts: ShoutOut[] = positives
    .map((p) => ({ server: nameById.get(p.server_staff_id as string) ?? "", comment: (p.comment ?? "").trim() }))
    .filter((s) => s.server)
    .slice(0, 4);

  return { count: rows.length, avg, shoutouts };
}
