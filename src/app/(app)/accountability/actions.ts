"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS, DAILY_CHECKLIST_ITEMS, PRE_SHIFT_ITEMS, AMBIANCE_DIMENSIONS, type Department } from "@/lib/constants";

export type ActionState = { error: string | null };

export async function addDailyChecklist(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const managerName = String(formData.get("managerName") || "").trim();
  const locationId = String(formData.get("locationId") || "");
  const occurredOn = String(formData.get("occurredOn") || "");
  const notes = String(formData.get("notes") || "").trim();
  const checked = DAILY_CHECKLIST_ITEMS.map((_, i) => formData.get(`item_${i}`) === "on");

  if (!managerName || !locationId || !occurredOn) {
    return { error: "Manager, location, and date are required." };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("daily_checklists").insert({
    org_id: org.id,
    location_id: locationId,
    manager_name: managerName,
    occurred_on: occurredOn,
    checked,
    notes,
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/accountability");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function addSpotCheck(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staffName = String(formData.get("staffName") || "").trim();
  const department = String(formData.get("department") || "");
  const locationId = String(formData.get("locationId") || "");
  const occurredOn = String(formData.get("occurredOn") || "");
  const notes = String(formData.get("notes") || "").trim();
  const feltLikeTransaction = formData.get("feltLikeTransaction") === "on";
  const scores = [0, 1, 2, 3, 4].map((i) => Number(formData.get(`score_${i}`) || 3));

  if (!staffName || !locationId || !occurredOn) {
    return { error: "Staff member, location, and date are required." };
  }
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("spot_checks").insert({
    org_id: org.id,
    location_id: locationId,
    staff_name: staffName,
    department,
    occurred_on: occurredOn,
    scores,
    felt_like_transaction: feltLikeTransaction,
    notes,
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/accountability");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function addPreShiftCheck(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staffName = String(formData.get("staffName") || "").trim();
  const department = String(formData.get("department") || "");
  const locationId = String(formData.get("locationId") || "");
  const occurredOn = String(formData.get("occurredOn") || "");
  const checked = PRE_SHIFT_ITEMS.map((_, i) => formData.get(`item_${i}`) === "on");

  if (!staffName || !locationId || !occurredOn) {
    return { error: "Staff member, location, and date are required." };
  }
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("pre_shift_checks").insert({
    org_id: org.id,
    location_id: locationId,
    staff_name: staffName,
    department,
    occurred_on: occurredOn,
    checked,
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/accountability");
  return { error: null };
}

export async function addAmbianceCheck(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locationId = String(formData.get("locationId") || "");
  const occurredOn = String(formData.get("occurredOn") || "");
  const notes = String(formData.get("notes") || "").trim();
  const scores = AMBIANCE_DIMENSIONS.map((_, i) => Number(formData.get(`score_${i}`) || 3));

  if (!locationId || !occurredOn) {
    return { error: "Location and date are required." };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("ambiance_checks").insert({
    org_id: org.id,
    location_id: locationId,
    occurred_on: occurredOn,
    scores,
    notes,
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/accountability");
  return { error: null };
}

export async function logCoaching(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const flagText = String(formData.get("flagText") || "").trim();
  const locationId = String(formData.get("locationId") || "");
  const strategyNote = String(formData.get("strategyNote") || "").trim();

  if (!flagText || !locationId) return { error: "Missing flag context." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("coaching_logs").insert({
    org_id: org.id,
    location_id: locationId,
    flag_text: flagText,
    strategy_note: strategyNote,
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/accountability");
  return { error: null };
}
