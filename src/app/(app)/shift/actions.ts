"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectionAccess } from "@/lib/auth/permissions";
import { localDate } from "@/lib/local-date";
import { KIND_IDS } from "@/lib/shift-board";
import { resolveMyStaff } from "@/lib/data/my-staff";
import { alertManagersOfFeedback } from "@/lib/shift-feedback-notify";

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

// Submit a post-shift reflection. Any team member with shift access can leave
// their own; it reports to that location's managers. business_day is the local
// day at the location so the manager feed groups by shift.
export async function postShiftFeedback(input: {
  wentWell: string;
  improve: string;
  guestNotes: string;
  locationId?: string;
}): Promise<ShiftActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "shift", profile.permissionOverrides) === "none")
    return { error: "You don't have access to the shift page." };

  const wentWell = (input.wentWell ?? "").trim().slice(0, 2000);
  const improve = (input.improve ?? "").trim().slice(0, 2000);
  const guestNotes = (input.guestNotes ?? "").trim().slice(0, 2000);
  if (!wentWell && !improve && !guestNotes) return { error: "Add a note in at least one box." };

  const locationId = (input.locationId || profile.locationId || "").trim();
  if (!locationId) return { error: "No location is set on your account — ask a manager to set yours." };

  const supabase = await createClient();
  // Validate the location belongs to the caller's org (RLS-scoped) and get its tz.
  const { data: loc } = await supabase.from("locations").select("timezone").eq("id", locationId).maybeSingle();
  if (!loc) return { error: "That location isn't available." };
  const timezone = (loc as { timezone?: string | null }).timezone ?? profile.locationTimezone;

  // Tag the reflection with the submitter's staff record (role/department) for
  // the manager view. Optional — a login not yet linked to a staff row still posts.
  const my = await resolveMyStaff(profile);

  const { error } = await supabase.from("shift_feedback").insert({
    org_id: profile.orgId,
    location_id: locationId,
    staff_id: my?.id ?? null,
    author_id: profile.userId,
    author_name: profile.fullName || "A team member",
    department: my?.department ?? "",
    went_well: wentWell,
    improve,
    guest_notes: guestNotes,
    business_day: localDate(timezone),
  });
  if (error) return { error: "Couldn't submit that — please try again." };

  // Report to the location's managers (push + email). Best-effort — a failed
  // alert must never fail the submission.
  try {
    const admin = createAdminClient();
    await alertManagersOfFeedback(admin, {
      orgId: profile.orgId,
      locationId,
      authorName: profile.fullName || "A team member",
      department: my?.department ?? "",
      wentWell,
      improve,
      guestNotes,
    });
  } catch {
    /* best-effort */
  }

  revalidatePath("/shift");
  return { error: null, ok: true };
}

// Remove a reflection (soft delete — managers only, for cleanup).
export async function deleteShiftFeedback(id: string): Promise<ShiftActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canPost(profile.accessRole, profile.permissionOverrides)) return { error: "Not allowed." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_feedback")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", profile.orgId);
  if (error) return { error: "Couldn't remove that." };

  revalidatePath("/shift");
  return { error: null, ok: true };
}
