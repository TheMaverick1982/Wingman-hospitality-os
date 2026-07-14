"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getChecklistItems } from "./template-actions";

export type PreshiftState = { error: string | null; done?: boolean };

// A signed-in staff member (or manager/owner) completes THEIR OWN checklist for
// today (pre-shift, FOH loyalty, server, or a custom checklist). Any
// authenticated user can record their own completion — this is their personal
// record, not editing the shared accountability config, so it's intentionally
// independent of the section's edit permission. The checklist items are rebuilt
// server-side against the live template (RLS-scoped to the org), so an unknown
// or cross-org type resolves to zero items and is rejected.
async function completeMyChecklist(type: string, formData: FormData): Promise<PreshiftState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  // Rebuild the checked[] array against the live template so a stale/tampered
  // form can't inflate the item count.
  const template = await getChecklistItems(type);
  const itemCount = template.length;
  if (itemCount === 0) return { error: "There's no checklist set up yet." };

  const checkedIdx = new Set(formData.getAll("checked").map((v) => Number(v)).filter((n) => Number.isInteger(n)));
  const checked = Array.from({ length: itemCount }, (_, i) => checkedIdx.has(i));
  const completedCount = checked.filter(Boolean).length;
  if (completedCount === 0) return { error: "Check off what you completed before submitting." };

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();

  // Upsert this person's completion for today (one per person per type per day).
  const { data: existing } = await supabase
    .from("shift_checklist_completions")
    .select("id")
    .eq("profile_id", profile.userId)
    .eq("checklist_type", type)
    .eq("occurred_on", today)
    .maybeSingle();

  const row = {
    checked,
    item_count: itemCount,
    completed_count: completedCount,
    location_id: profile.locationId,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase.from("shift_checklist_completions").update(row).eq("id", (existing as { id: string }).id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("shift_checklist_completions").insert({
      org_id: profile.orgId,
      profile_id: profile.userId,
      checklist_type: type,
      occurred_on: today,
      ...row,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/accountability");
  revalidatePath("/dashboard");
  return { error: null, done: true };
}

export async function completeMyPreshift(_prev: PreshiftState, formData: FormData): Promise<PreshiftState> {
  return completeMyChecklist("preshift", formData);
}

export async function completeMyLoyalty(_prev: PreshiftState, formData: FormData): Promise<PreshiftState> {
  return completeMyChecklist("loyalty", formData);
}

export async function completeMyServer(_prev: PreshiftState, formData: FormData): Promise<PreshiftState> {
  return completeMyChecklist("server", formData);
}

// Generic completion for a custom (owner-created) checklist. The checklist id
// rides in the form as `checklistType`; completeMyChecklist rebuilds items from
// the live, org-scoped template, so an invalid id yields zero items and errors.
export async function completeMyCustomChecklist(_prev: PreshiftState, formData: FormData): Promise<PreshiftState> {
  const type = String(formData.get("checklistType") || "");
  if (!type) return { error: "Missing checklist." };
  return completeMyChecklist(type, formData);
}
