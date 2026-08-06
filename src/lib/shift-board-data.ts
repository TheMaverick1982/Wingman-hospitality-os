import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/local-date";

export type ShiftNote = { id: string; kind: string; body: string; author_name: string };

// Today's shift board for one location, for the dashboard card the whole team
// sees. Read via the admin client scoped to the org; guarded so a not-yet-applied
// migration can't break the dashboard.
export async function getTodaysBoard(orgId: string, locationId: string | null, timezone: string | null): Promise<ShiftNote[]> {
  if (!locationId) return [];
  const today = localDate(timezone);
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("shift_board_notes")
      .select("id, kind, body, author_name")
      .eq("org_id", orgId)
      .eq("location_id", locationId)
      .eq("business_day", today)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(8);
    return (data ?? []) as ShiftNote[];
  } catch {
    return [];
  }
}
