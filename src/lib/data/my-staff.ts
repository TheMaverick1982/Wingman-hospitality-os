import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurrentProfile } from "@/lib/auth/profile";

// Resolve "which staff member am I" for the personal staff experience.
// Normally this is the staff record linked to the logged-in account. In a demo
// staff view we instead pick a staff member of the demoed department (Server or
// Chef), so a rep can show each role's experience from the one demo login.
// test_assignments / staff_training_progress are manager-only under RLS, so this
// uses the admin client — always scoped to the caller's own org.
export async function resolveMyStaff(
  profile: CurrentProfile
): Promise<{ id: string; department: string; additional_departments: string[] } | null> {
  const admin = createAdminClient();
  // Select additional_departments (migration 0168) defensively so a not-yet-
  // migrated database still resolves the staff record (single role) instead of
  // erroring the whole personal Training view.
  const run = async (cols: string) => {
    const base = admin.from("staff_members").select(cols).eq("org_id", profile.orgId).is("deleted_at", null);
    return profile.isDemo && profile.demoDept
      ? base.eq("department", profile.demoDept).order("hired_on").limit(1).maybeSingle()
      : base.eq("profile_id", profile.userId).maybeSingle();
  };
  const first = await run("id, department, additional_departments");
  let data = first.data;
  if (first.error) ({ data } = await run("id, department"));
  const row = data as { id: string; department: string; additional_departments?: string[] } | null;
  return row ? { id: row.id, department: row.department, additional_departments: row.additional_departments ?? [] } : null;
}
