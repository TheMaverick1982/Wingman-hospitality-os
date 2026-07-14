"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS } from "@/lib/constants";

export type CustomChecklist = { id: string; title: string; departments: string[]; sort_order: number };

const DEPTS = new Set<string>(ALL_DEPARTMENTS);
const cleanDepartments = (departments: string[] | null): string[] =>
  [...new Set((departments ?? []).filter((d) => DEPTS.has(d)))];

async function editorOrgId(): Promise<{ orgId: string } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "accountability", profile.permissionOverrides)) {
    return { error: "You don't have access to manage checklists." };
  }
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  return { orgId: (org as { id: string }).id };
}

export type CustomChecklistState = { error: string | null; id?: string };

// Create a new owner-defined checklist, assigned to zero (all staff) or more roles.
export async function createCustomChecklist(title: string, departments: string[] | null): Promise<CustomChecklistState> {
  const res = await editorOrgId();
  if ("error" in res) return { error: res.error };
  const t = (title || "").trim();
  if (!t) return { error: "Give the checklist a name." };
  const depts = cleanDepartments(departments);

  const supabase = await createClient();
  const { count } = await supabase.from("custom_checklists").select("id", { count: "exact", head: true }).eq("org_id", res.orgId);
  const { data, error } = await supabase
    .from("custom_checklists")
    .insert({ org_id: res.orgId, title: t.slice(0, 80), departments: depts, sort_order: count ?? 0 })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/accountability");
  return { error: null, id: (data as { id: string }).id };
}

// Rename a checklist and/or change which roles it's assigned to.
export async function updateCustomChecklist(id: string, title: string, departments: string[] | null): Promise<CustomChecklistState> {
  const res = await editorOrgId();
  if ("error" in res) return { error: res.error };
  const t = (title || "").trim();
  if (!t) return { error: "Give the checklist a name." };
  const depts = cleanDepartments(departments);

  const supabase = await createClient();
  const { error } = await supabase
    .from("custom_checklists")
    .update({ title: t.slice(0, 80), departments: depts })
    .eq("id", id)
    .eq("org_id", res.orgId);
  if (error) return { error: error.message };
  revalidatePath("/accountability");
  return { error: null };
}

// The built-in staff-facing checklists whose audience can be role-assigned.
const ASSIGNABLE = new Set<string>(["preshift", "server", "loyalty"]);

// Set which roles a built-in checklist shows up for (empty = all staff). Stored
// in checklist_assignments, keyed by the built-in checklist_type.
export async function setChecklistRoles(checklistType: string, departments: string[]): Promise<CustomChecklistState> {
  const res = await editorOrgId();
  if ("error" in res) return { error: res.error };
  if (!ASSIGNABLE.has(checklistType)) return { error: "That checklist can't be role-assigned." };
  const depts = cleanDepartments(departments);

  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_assignments")
    .upsert({ org_id: res.orgId, checklist_type: checklistType, departments: depts, updated_at: new Date().toISOString() }, { onConflict: "org_id,checklist_type" });
  if (error) return { error: error.message };
  revalidatePath("/accountability");
  return { error: null };
}

// Delete a checklist and its items. Past completion records are left in place
// (harmless — reports only surface checklists that still exist).
export async function deleteCustomChecklist(id: string): Promise<CustomChecklistState> {
  const res = await editorOrgId();
  if ("error" in res) return { error: res.error };
  const supabase = await createClient();
  await supabase.from("accountability_checklist_items").delete().eq("org_id", res.orgId).eq("checklist_type", id);
  const { error } = await supabase.from("custom_checklists").delete().eq("id", id).eq("org_id", res.orgId);
  if (error) return { error: error.message };
  revalidatePath("/accountability");
  return { error: null };
}
