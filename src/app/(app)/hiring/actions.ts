"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS, RECOMMENDATION_OPTIONS, type Department } from "@/lib/constants";

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

export async function hireCandidate(candidateId: string): Promise<{ error: string | null; staffId?: string }> {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { data: candidate } = await supabase
    .from("candidates")
    .select("name, department, location_id")
    .eq("id", candidateId)
    .maybeSingle();
  if (!candidate) return { error: "Candidate not found." };

  const { data: staffRow, error } = await supabase
    .from("staff_members")
    .insert({
      org_id: org.id,
      location_id: candidate.location_id,
      candidate_id: candidateId,
      full_name: candidate.name,
      department: candidate.department,
      hired_on: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/hiring");
  revalidatePath("/staff");
  return { error: null, staffId: staffRow.id };
}
