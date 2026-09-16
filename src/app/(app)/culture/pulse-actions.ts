"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSectionAccess } from "@/lib/auth/permissions";

export type PulseState = { error: string | null; ok?: boolean };

function currentPulsePeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

const clamp = (n: number) => (Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : null);

// Submit an anonymous culture pulse for this month. The response carries no
// identity; a per-person marker (separate table) prevents a second submission
// this period without linking the answer to the person.
export async function submitCulturePulse(_prev: PulseState, formData: FormData): Promise<PulseState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  // Anyone with any culture access can check in (staff included).
  if (getSectionAccess(profile.accessRole, "culture", profile.permissionOverrides) === "none") {
    return { error: "You don't have access." };
  }

  const recognized = clamp(Number(formData.get("recognized")));
  const valuesClear = clamp(Number(formData.get("values_clear")));
  const proud = clamp(Number(formData.get("proud")));
  const comment = String(formData.get("comment") || "").trim().slice(0, 1000);
  if (recognized === null && valuesClear === null && proud === null && !comment) {
    return { error: "Answer at least one question." };
  }

  const period = currentPulsePeriod();
  const supabase = await createClient();

  // Already checked in this month? (marker is private to this user)
  const { data: existing } = await supabase
    .from("culture_pulse_submissions")
    .select("period")
    .eq("org_id", profile.orgId)
    .eq("user_id", profile.userId)
    .eq("period", period)
    .maybeSingle();
  if (existing) return { error: "You've already checked in this month — thank you!" };

  const { error: insErr } = await supabase.from("culture_pulse_responses").insert({
    org_id: profile.orgId,
    location_id: profile.locationId,
    period,
    recognized,
    values_clear: valuesClear,
    proud,
    comment: comment || null,
  });
  if (insErr) return { error: "Couldn't save that. Try again." };

  const { error: markErr } = await supabase
    .from("culture_pulse_submissions")
    .insert({ org_id: profile.orgId, user_id: profile.userId, period });
  // A marker failure isn't fatal to the (already saved) response; ignore.
  if (markErr) { /* no-op */ }

  revalidatePath("/culture");
  return { error: null, ok: true };
}
