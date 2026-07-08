"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";

export type StaffFormState = { error: string | null };

export async function addStaffMember(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const fullName = String(formData.get("fullName") || "").trim();
  const department = String(formData.get("department") || "");
  const locationId = String(formData.get("locationId") || "");
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (!fullName) return { error: "Name is required." };
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Choose a role." };
  if (!locationId) return { error: "Choose a location." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { error } = await supabase.from("staff_members").insert({
    org_id: org.id,
    location_id: locationId,
    full_name: fullName,
    department,
    email,
    phone,
  });
  if (error) return { error: error.message };

  revalidatePath("/staff");
  return { error: null };
}

export type BatchState = { error: string | null; successCount: number; failures: { index: number; message: string }[] };
const MAX_BATCH_SIZE = 40;

export async function bulkAddStaffMembers(_prev: BatchState, formData: FormData): Promise<BatchState> {
  const raw = String(formData.get("membersJson") || "[]");
  let rows: { fullName: string; department: string; locationId: string; email?: string; phone?: string }[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { error: "Couldn't read the submitted rows.", successCount: 0, failures: [] };
  }
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Add at least one person.", successCount: 0, failures: [] };
  if (rows.length > MAX_BATCH_SIZE) return { error: `Max ${MAX_BATCH_SIZE} at a time.`, successCount: 0, failures: [] };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found.", successCount: 0, failures: [] };

  let successCount = 0;
  const failures: { index: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fullName = (row.fullName || "").trim();
    if (!fullName) {
      failures.push({ index: i, message: "Name is required." });
      continue;
    }
    if (!ALL_DEPARTMENTS.includes(row.department as Department)) {
      failures.push({ index: i, message: "Invalid role." });
      continue;
    }
    if (!row.locationId) {
      failures.push({ index: i, message: "Location is required." });
      continue;
    }
    const { error } = await supabase.from("staff_members").insert({
      org_id: org.id,
      location_id: row.locationId,
      full_name: fullName,
      department: row.department,
      email: (row.email || "").trim(),
      phone: (row.phone || "").trim(),
    });
    if (error) {
      failures.push({ index: i, message: error.message });
      continue;
    }
    successCount++;
  }

  revalidatePath("/staff");
  return { error: successCount === 0 ? "None of the rows could be added." : null, successCount, failures };
}

export async function updateStaffContact(
  id: string,
  patch: { fullName?: string; email?: string; phone?: string; status?: "active" | "inactive" }
) {
  const supabase = await createClient();
  await supabase.from("staff_members").update(patch).eq("id", id);
  revalidatePath("/staff");
  revalidatePath(`/staff/${id}`);
}

export async function deleteStaffMember(id: string) {
  const supabase = await createClient();
  await supabase.from("staff_members").delete().eq("id", id);
  revalidatePath("/staff");
}

export async function updateTrainingProgress(
  staffId: string,
  itemType: "standard" | "training",
  itemId: string,
  patch: { checked?: boolean; rating?: "" | "strong" | "coaching"; note?: string }
) {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return;

  await supabase
    .from("staff_training_progress")
    .upsert(
      { org_id: org.id, staff_id: staffId, item_type: itemType, item_id: itemId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "staff_id,item_type,item_id" }
    );
  revalidatePath(`/staff/${staffId}`);
}

export async function signOffStaffTraining(staffId: string, staffName: string, department: string, completionPct: number) {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return;

  await supabase.from("training_signoffs").insert({
    org_id: org.id,
    staff_id: staffId,
    staff_name: staffName,
    department,
    completion_pct: completionPct,
  });

  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/training");
  revalidatePath("/dashboard");
}
