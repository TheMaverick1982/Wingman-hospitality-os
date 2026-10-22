import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Soft-delete a row by stamping deleted_at/deleted_by.
//
// Why this needs the service-role client: every soft-delete table has a SELECT
// policy of `... AND deleted_at IS NULL` so deleted rows disappear. Postgres
// rejects an RLS UPDATE that stamps deleted_at — the resulting row no longer
// satisfies the row's own policy, so it fails the row-security check (42501:
// "new row violates row-level security policy"). The update therefore has to run
// with admin. Authorization is NOT weakened: callers first read the row through
// the RLS client (which only returns it if the caller may see it) and refuse
// when it's missing, and this is scoped to that row in the caller's own org.
export async function softDeleteRow(
  table: string,
  id: string,
  orgId: string,
  deletedBy: string | null,
): Promise<{ error: string | null }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from(table)
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq("id", id)
    .eq("org_id", orgId);
  return { error: error?.message ?? null };
}
