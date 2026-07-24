import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurrentProfile } from "@/lib/auth/profile";

// Resolve "which staff member am I" for the personal staff experience.
// Normally this is the staff record linked to the logged-in account. In a demo
// staff view we instead pick a staff member of the demoed department (Server or
// Chef), so a rep can show each role's experience from the one demo login.
// test_assignments / staff_training_progress are manager-only under RLS, so this
// uses the admin client — always scoped to the caller's own org.
export async function resolveMyStaff(profile: CurrentProfile): Promise<{ id: string; department: string } | null> {
  const admin = createAdminClient();
  const base = admin
    .from("staff_members")
    .select("id, department")
    .eq("org_id", profile.orgId)
    .is("deleted_at", null);
  const { data } =
    profile.isDemo && profile.demoDept
      ? await base.eq("department", profile.demoDept).order("hired_on").limit(1).maybeSingle()
      : await base.eq("profile_id", profile.userId).maybeSingle();
  return (data as { id: string; department: string } | null) ?? null;
}
