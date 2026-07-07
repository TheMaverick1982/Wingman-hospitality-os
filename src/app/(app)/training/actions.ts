"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
