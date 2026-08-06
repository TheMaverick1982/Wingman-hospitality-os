"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getSectionAccess } from "@/lib/auth/permissions";
import { localDate } from "@/lib/local-date";
import { KIND_IDS } from "@/lib/shift-board";

export type ShiftActionState = { error: string | null; ok?: boolean };

function canPost(role: Parameters<typeof getSectionAccess>[0], overrides: Parameters<typeof getSectionAccess>[2]) {
  return getSectionAccess(role, "shift", overrides) === "full";
}

// Post a shift board item (86'd / staffing / note) for a location, dated to that
// location's local business day so it archives on its own each day.
export async function postShiftNote(input: { kind: string; body: string; locationId: string }): Promise<ShiftActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canPost(profile.accessRole, profile.permissionOverrides)) return { error: "Only managers can post to the shift board." };

  const kind = KIND_IDS.includes(input.kind as (typeof KIND_IDS)[number]) ? input.kind : "note";
  const body = (input.body ?? "").trim().slice(0, 1000);
  const locationId = (input.locationId ?? "").trim();
  if (!body) return { error: "Write something to post." };
  if (!locationId) return { error: "Pick a location." };

  const supabase = await createClient();
  // Validate the location belongs to the caller's org (RLS-scoped) and get its tz.
  const { data: loc } = await supabase.from("locations").select("timezone").eq("id", locationId).maybeSingle();
  if (!loc) return { error: "That location isn't available." };
  const timezone = (loc as { timezone?: string | null }).timezone ?? profile.locationTimezone;

  const { error } = await supabase.from("shift_board_notes").insert({
    org_id: profile.orgId,
    location_id: locationId,
    author_id: profile.userId,
    author_name: profile.fullName || "A manager",
    kind,
    body,
    business_day: localDate(timezone),
  });
  if (error) return { error: "Couldn't post that — please try again." };

  revalidatePath("/shift");
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}

// Remove a board item (soft delete — never hard-delete).
export async function deleteShiftNote(id: string): Promise<ShiftActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canPost(profile.accessRole, profile.permissionOverrides)) return { error: "Not allowed." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_board_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", profile.orgId);
  if (error) return { error: "Couldn't remove that." };

  revalidatePath("/shift");
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}
