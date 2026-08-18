import { createClient } from "@/lib/supabase/server";
import type { Department } from "@/lib/constants";

export type StaffMember = {
  id: string;
  location_id: string;
  candidate_id: string | null;
  full_name: string;
  department: Department;
  additional_departments: Department[];
  email: string;
  phone: string;
  status: "active" | "inactive";
  hired_on: string | null;
  created_at: string;
};

// additional_departments (multi-role) lands in migration 0168. Select it
// defensively so a not-yet-migrated database degrades to single-role behavior
// (empty extra roles) instead of 500-ing every page that lists staff.
const STAFF_COLS = "id, location_id, candidate_id, full_name, department, email, phone, status, hired_on, created_at";

export async function getStaffMembers(effectiveLocation: string | null): Promise<StaffMember[]> {
  const supabase = await createClient();
  const build = (cols: string) => {
    let q = supabase.from("staff_members").select(cols).order("full_name");
    if (effectiveLocation) q = q.eq("location_id", effectiveLocation);
    return q;
  };
  const first = await build(`${STAFF_COLS}, additional_departments`);
  let data = first.data;
  if (first.error) ({ data } = await build(STAFF_COLS)); // column not migrated yet
  return ((data ?? []) as unknown as StaffMember[]).map((s) => ({ ...s, additional_departments: s.additional_departments ?? [] }));
}
