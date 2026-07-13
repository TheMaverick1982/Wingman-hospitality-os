import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Sales reps = platform staff granted the Sales Training section (our "this is a
// rep" signal, same one that triggers the W-9 request).
export type SalesRep = { id: string; name: string };

export async function listSalesReps(): Promise<SalesRep[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("is_platform_admin", true)
    .contains("platform_access", ["sales_training"])
    .order("full_name");
  return ((data ?? []) as { id: string; full_name: string | null }[]).map((p) => ({ id: p.id, name: p.full_name || "(unnamed)" }));
}

// A contact a rep can pick when launching a live demo: their own assigned leads
// plus any still-open, unassigned lead they could pick up. Excludes won / lost /
// past clients so the list stays to live prospects worth demoing.
export type DemoTarget = { id: string; name: string; email: string; stage: string };

export async function listDemoTargets(repId: string): Promise<DemoTarget[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("crm_contacts")
    .select("id, name, email, stage, assigned_rep_id")
    .in("stage", ["new", "engaged", "demoed", "demo_completed"])
    .or(`assigned_rep_id.eq.${repId},assigned_rep_id.is.null`)
    .order("last_activity_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as { id: string; name: string | null; email: string; stage: string }[]).map((c) => ({
    id: c.id,
    name: c.name || c.email,
    email: c.email,
    stage: c.stage,
  }));
}
