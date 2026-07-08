"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSectionAccess } from "@/lib/auth/permissions";

export type ActionState = { error: string | null };

async function requireMenuEditor() {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." as string, profile: null };
  if (getSectionAccess(profile.accessRole, "menu", profile.permissionOverrides) !== "full") {
    return { error: "You don't have access to edit the menu." as string, profile: null };
  }
  return { error: null as string | null, profile };
}

export async function addMenuItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { error: authError, profile } = await requireMenuEditor();
  if (authError || !profile) return { error: authError };

  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price") || 0);
  const foodCost = Number(formData.get("foodCost") || 0);
  const popularity = Number(formData.get("popularity") || 2);

  if (!name) return { error: "Item name is required." };
  if ([price, foodCost, popularity].some(Number.isNaN)) return { error: "Enter valid numbers." };
  if (price < 0 || foodCost < 0) return { error: "Price and cost can't be negative." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("menu_engineering_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", profile.orgId);

  const { error } = await supabase.from("menu_engineering_items").insert({
    org_id: profile.orgId,
    name,
    price,
    food_cost: foodCost,
    popularity: Math.max(1, Math.min(3, Math.round(popularity))),
    sort_order: count ?? 0,
    created_by: profile.userId,
  });
  if (error) return { error: error.message };

  revalidatePath("/menu");
  return { error: null };
}

export async function deleteMenuItem(id: string) {
  const { profile } = await requireMenuEditor();
  if (!profile) return;
  const supabase = await createClient();
  await supabase.from("menu_engineering_items").delete().eq("id", id);
  revalidatePath("/menu");
}
