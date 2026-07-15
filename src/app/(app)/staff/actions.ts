"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { logAudit } from "@/lib/audit-log";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { sendLoginInvite, type LoginAccessRole } from "@/lib/invite";

export type StaffFormState = { error: string | null; staffId?: string };

// Email is what a staff member logs in with, and phone is how the team reaches
// them — both are required so a person you add can actually use the app (log in,
// enter bounce-backs, etc.), not just sit on the roster.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export async function addStaffMember(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const fullName = String(formData.get("fullName") || "").trim();
  const department = String(formData.get("department") || "");
  const locationId = String(formData.get("locationId") || "");
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (!fullName) return { error: "Name is required." };
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Choose a role." };
  if (!locationId) return { error: "Choose a location." };
  if (!email) return { error: "Email is required — it's how they'll log in." };
  if (!isValidEmail(email)) return { error: "Enter a valid email address." };
  if (!phone) return { error: "Phone number is required." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  // Dedupe by email so a person isn't entered twice (they may already exist from
  // hiring or a login invite). If they're already on staff, point the owner there.
  const { data: dupe } = await supabase
    .from("staff_members")
    .select("id, full_name")
    .eq("org_id", org.id)
    .ilike("email", email.toLowerCase())
    .limit(1)
    .maybeSingle();
  if (dupe) {
    return { error: `${(dupe as { full_name: string }).full_name} is already on your staff with that email.`, staffId: (dupe as { id: string }).id };
  }

  const { data: row, error } = await supabase
    .from("staff_members")
    .insert({
      org_id: org.id,
      location_id: locationId,
      full_name: fullName,
      department,
      email,
      phone,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/staff");
  return { error: null, staffId: row.id };
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
    const email = (row.email || "").trim();
    const phone = (row.phone || "").trim();
    if (!email || !isValidEmail(email)) {
      failures.push({ index: i, message: "A valid email is required (it's their login)." });
      continue;
    }
    if (!phone) {
      failures.push({ index: i, message: "Phone is required." });
      continue;
    }
    const { error } = await supabase.from("staff_members").insert({
      org_id: org.id,
      location_id: row.locationId,
      full_name: fullName,
      department: row.department,
      email,
      phone,
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
  // Allowlist the columns a caller may set -- server-action args are fully
  // client-controlled, so never spread the raw object into .update().
  const allowed = new Set(["full_name", "fullName", "email", "phone", "status"]);
  const safe = Object.fromEntries(
    Object.entries(patch as Record<string, unknown>).filter(([k]) => allowed.has(k))
  );
  const supabase = await createClient();
  await supabase.from("staff_members").update(safe).eq("id", id);
  revalidatePath("/staff");
  revalidatePath(`/staff/${id}`);
}

// Soft delete — hidden by RLS but recoverable by the owner from Settings → Trash.
export async function deleteStaffMember(id: string) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: s } = await supabase.from("staff_members").select("name").eq("id", id).maybeSingle();
  await supabase
    .from("staff_members")
    .update({ deleted_at: new Date().toISOString(), deleted_by: profile?.userId ?? null })
    .eq("id", id);
  if (profile) {
    await logAudit({
      orgId: profile.orgId,
      actorId: profile.userId,
      actorName: profile.fullName,
      action: "deleted",
      entityType: "staff",
      entityId: id,
      entityLabel: (s as { name?: string } | null)?.name ?? "",
    });
  }
  revalidatePath("/staff");
}

// Send a login invite to someone already on the roster (e.g. added manually or
// hired earlier). Owner-only; links the resulting profile back to this record.
export async function inviteStaffToLogin(staffId: string, accessRole: LoginAccessRole): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return { error: "Only an owner can send a login invite." };

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("staff_members")
    .select("email, full_name, department, location_id, profile_id")
    .eq("id", staffId)
    .maybeSingle();
  if (!s) return { error: "Staff member not found." };
  const staff = s as { email: string; full_name: string; department: string; location_id: string; profile_id: string | null };
  if (staff.profile_id) return { error: "They already have a login." };
  if (!staff.email) return { error: "Add an email to this staff member first." };

  const res = await sendLoginInvite({
    orgId: profile.orgId,
    email: staff.email,
    fullName: staff.full_name,
    accessRole,
    department: staff.department,
    locationId: staff.location_id,
  });
  if (res.error) return res;

  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/staff");
  return { error: null };
}

export async function updateTrainingProgress(
  staffId: string,
  itemType: "standard" | "training",
  itemId: string,
  patch: { checked?: boolean; rating?: "" | "strong" | "coaching"; note?: string }
) {
  // Allowlist the mutable columns; don't spread the raw client-supplied patch.
  const allowed = new Set(["checked", "rating", "note"]);
  const safe = Object.fromEntries(
    Object.entries(patch as Record<string, unknown>).filter(([k]) => allowed.has(k))
  );

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return;

  await supabase
    .from("staff_training_progress")
    .upsert(
      { org_id: org.id, staff_id: staffId, item_type: itemType, item_id: itemId, ...safe, updated_at: new Date().toISOString() },
      { onConflict: "staff_id,item_type,item_id" }
    );
  revalidatePath(`/staff/${staffId}`);
}

export async function signOffStaffTraining(staffId: string, staffName: string, department: string, completionPct: number) {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return;

  // Record the location the sign-off belongs to (the staff member's store) so
  // the Training page can scope completions per location for multi-location orgs.
  const { data: staffRow } = await supabase.from("staff_members").select("location_id").eq("id", staffId).maybeSingle();

  await supabase.from("training_signoffs").insert({
    org_id: org.id,
    staff_id: staffId,
    staff_name: staffName,
    department,
    completion_pct: completionPct,
    location_id: staffRow?.location_id ?? null,
  });

  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/training");
  revalidatePath("/dashboard");
}
