"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";

export type ActionState = { error: string | null };

export async function updateMenuReference(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const department = String(formData.get("department") || "");
  const content = String(formData.get("content") || "");

  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { error } = await supabase
    .from("menu_references")
    .upsert({ org_id: org.id, department, content }, { onConflict: "org_id,department" });

  if (error) return { error: error.message };

  revalidatePath("/training");
  return { error: null };
}

export async function signOffTraining(name: string, department: string, pct: number) {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return;

  await supabase.from("training_signoffs").insert({
    org_id: org.id,
    staff_name: name,
    department,
    completion_pct: pct,
  });

  revalidatePath("/training");
  revalidatePath("/dashboard");
}
