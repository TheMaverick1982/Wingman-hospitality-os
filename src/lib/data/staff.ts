import { createClient } from "@/lib/supabase/server";
import type { Department } from "@/lib/constants";

export type StaffMember = {
  id: string;
  location_id: string;
  candidate_id: string | null;
  full_name: string;
  department: Department;
  email: string;
  phone: string;
  status: "active" | "inactive";
  hired_on: string | null;
  created_at: string;
};

export async function getStaffMembers(effectiveLocation: string | null): Promise<StaffMember[]> {
  const supabase = await createClient();
  let q = supabase
    .from("staff_members")
    .select("id, location_id, candidate_id, full_name, department, email, phone, status, hired_on, created_at")
    .order("full_name");
  if (effectiveLocation) q = q.eq("location_id", effectiveLocation);
  const { data } = await q;
  return data ?? [];
}
