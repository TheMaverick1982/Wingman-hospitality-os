"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

export async function saveGrowthPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locationId = String(formData.get("locationId") || "") || null;
  const frequency = String(formData.get("frequency") || "monthly");
  if (frequency !== "weekly" && frequency !== "monthly") return { error: "Invalid frequency." };

  const currentCustomers = Number(formData.get("currentCustomers") || 0);
  const currentAvgSale = Number(formData.get("currentAvgSale") || 0);
  const currentRepurchaseFrequency = Number(formData.get("currentRepurchaseFrequency") || 0);
  const targetCustomersPct = Number(formData.get("targetCustomersPct") || 0);
  const targetAvgSalePct = Number(formData.get("targetAvgSalePct") || 0);
  const targetFrequencyPct = Number(formData.get("targetFrequencyPct") || 0);

  if ([currentCustomers, currentAvgSale, currentRepurchaseFrequency, targetCustomersPct, targetAvgSalePct, targetFrequencyPct].some(Number.isNaN)) {
    return { error: "Enter valid numbers." };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    frequency,
    current_customers: currentCustomers,
    current_avg_sale: currentAvgSale,
    current_repurchase_frequency: currentRepurchaseFrequency,
    target_customers_pct: targetCustomersPct,
    target_avg_sale_pct: targetAvgSalePct,
    target_frequency_pct: targetFrequencyPct,
    updated_by: user?.id,
    updated_at: new Date().toISOString(),
  };

  let existingQuery = supabase.from("growth_plans").select("id").eq("org_id", org.id);
  existingQuery = locationId ? existingQuery.eq("location_id", locationId) : existingQuery.is("location_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  const { error } = existing
    ? await supabase.from("growth_plans").update(payload).eq("id", existing.id)
    : await supabase.from("growth_plans").insert({ ...payload, org_id: org.id, location_id: locationId });

  if (error) return { error: error.message };

  revalidatePath("/growth");
  revalidatePath("/reporting");
  return { error: null };
}
