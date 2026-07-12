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
