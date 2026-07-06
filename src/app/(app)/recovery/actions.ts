"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DISCOUNT_CATEGORIES } from "@/lib/constants";

export type ActionState = { error: string | null };

export async function addDiscount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const occurredOn = String(formData.get("occurredOn") || "");
  const locationId = String(formData.get("locationId") || "");
  const serverName = String(formData.get("serverName") || "").trim();
  const category = String(formData.get("category") || "");
  const reason = String(formData.get("reason") || "").trim();
  const amount = Number(formData.get("amount"));
  const notes = String(formData.get("notes") || "").trim();

  if (!occurredOn || !locationId || !serverName || !reason || !amount) {
    return { error: "Date, location, server, reason, and amount are required." };
  }
  if (!DISCOUNT_CATEGORIES.includes(category as (typeof DISCOUNT_CATEGORIES)[number])) {
    return { error: "Invalid category." };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("discounts").insert({
    org_id: org.id,
    location_id: locationId,
    occurred_on: occurredOn,
    server_name: serverName,
    category,
    reason,
    amount,
    notes,
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/recovery");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteDiscount(discountId: string) {
  const supabase = await createClient();
  await supabase.from("discounts").delete().eq("id", discountId);
  revalidatePath("/recovery");
  revalidatePath("/dashboard");
}

export async function updateTotalRevenue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const amount = Number(formData.get("totalRevenue"));
  if (Number.isNaN(amount) || amount < 0) return { error: "Enter a valid revenue amount." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { error } = await supabase.from("organizations").update({ total_revenue: amount }).eq("id", org.id);
  if (error) return { error: error.message };

  revalidatePath("/recovery");
  revalidatePath("/dashboard");
  return { error: null };
}
