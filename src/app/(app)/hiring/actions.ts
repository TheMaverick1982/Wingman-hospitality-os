"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { ALL_DEPARTMENTS, RECOMMENDATION_OPTIONS, type Department } from "@/lib/constants";
import { linkOrCreateStaff } from "@/lib/staff-link";
import { sendLoginInvite, type LoginAccessRole } from "@/lib/invite";

export type ActionState = { error: string | null };

export async function addCandidate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") || "").trim();
  const department = String(formData.get("department") || "");
  const locationId = String(formData.get("locationId") || "");
  const occurredOn = String(formData.get("occurredOn") || "");
  const recommendation = String(formData.get("recommendation") || "");
  const notes = String(formData.get("notes") || "").trim();

  if (!name || !locationId || !occurredOn) {
    return { error: "Candidate name, location, and date are required." };
  }
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };
  if (!RECOMMENDATION_OPTIONS.includes(recommendation as (typeof RECOMMENDATION_OPTIONS)[number])) {
    return { error: "Invalid recommendation." };
  }

  const scores: number[] = [];
  let i = 0;
  while (formData.has(`score_${i}`)) {
    scores.push(Number(formData.get(`score_${i}`)));
    i++;
  }
  if (scores.length === 0) return { error: "At least one trait score is required." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("candidates").insert({
    org_id: org.id,
    location_id: locationId,
    name,
    department,
    occurred_on: occurredOn,
    scores,
    recommendation,
    notes,
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/hiring");
  return { error: null };
}

export type HireOptions = { email?: string; phone?: string; accessRole?: LoginAccessRole; sendInvite?: boolean };

// Hire a scored candidate: create (or link, by email) their Staff record, and —
// if asked — fire the "set up your account" login invite so they can start
// logging in. Candidates carry no email, so the email + access level are
// collected at hire time. Sending a login requires the actor to be a Super Admin.
export async function hireCandidate(
  candidateId: string,
  opts?: HireOptions
): Promise<{ error: string | null; staffId?: string; invited?: boolean }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const supabase = await createClient();
  const { data: candidate } = await supabase
    .from("candidates")
    .select("name, department, location_id")
    .eq("id", candidateId)
    .maybeSingle();
  if (!candidate) return { error: "Candidate not found." };

  const email = (opts?.email || "").trim();
  const phone = (opts?.phone || "").trim();

  const staffId = await linkOrCreateStaff(supabase, profile.orgId, {
    email,
    fullName: candidate.name,
    department: candidate.department,
    locationId: candidate.location_id,
    phone,
    candidateId,
    hiredOn: new Date().toISOString().slice(0, 10),
  });
  if (!staffId) return { error: "Couldn't create the staff record." };

  let invited = false;
  if (opts?.sendInvite && email) {
    if (profile.accessRole !== "super_admin") {
      return { error: "Hired — but only an owner can send the login invite. Ask them to invite from Settings → Team.", staffId, invited: false };
    }
    const res = await sendLoginInvite({
      orgId: profile.orgId,
      email,
      fullName: candidate.name,
      accessRole: opts.accessRole ?? "staff",
      department: candidate.department,
      locationId: candidate.location_id,
    });
    if (res.error) return { error: `Added to staff, but the login invite failed: ${res.error}`, staffId, invited: false };
    invited = true;
  }

  revalidatePath("/hiring");
  revalidatePath("/staff");
  return { error: null, staffId, invited };
}
