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

export async function updateMenuItem(
  id: string,
  patch: { name?: string; price?: number; foodCost?: number; popularity?: number }
): Promise<ActionState> {
  const { error: authError, profile } = await requireMenuEditor();
  if (authError || !profile) return { error: authError };

  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) return { error: "Item name can't be empty." };
    row.name = patch.name.trim();
  }
  if (patch.price !== undefined) {
    if (Number.isNaN(patch.price) || patch.price < 0) return { error: "Enter a valid price." };
    row.price = patch.price;
  }
  if (patch.foodCost !== undefined) {
    if (Number.isNaN(patch.foodCost) || patch.foodCost < 0) return { error: "Enter a valid food cost." };
    row.food_cost = patch.foodCost;
  }
  if (patch.popularity !== undefined) row.popularity = Math.max(1, Math.min(3, Math.round(patch.popularity)));
  if (Object.keys(row).length === 0) return { error: null };

  const supabase = await createClient();
  const { error } = await supabase.from("menu_engineering_items").update(row).eq("id", id).eq("org_id", profile.orgId);
  if (error) return { error: error.message };
  revalidatePath("/menu");
  return { error: null };
}

// Bulk-import rows from a mapped CSV. Blank/omitted fields fall back to sensible
// defaults (0 cost/price, medium popularity) so the owner can fill them in later
// via edit. Only the name is required.
export async function importMenuItems(
  rows: { name: string; price: number | null; foodCost: number | null; popularity: number | null }[]
): Promise<{ error: string | null; imported: number }> {
  const { error: authError, profile } = await requireMenuEditor();
  if (authError || !profile) return { error: authError, imported: 0 };

  const clean = (rows ?? [])
    .map((r) => ({
      name: String(r.name ?? "").trim(),
      price: r.price != null && !Number.isNaN(r.price) && r.price >= 0 ? r.price : 0,
      food_cost: r.foodCost != null && !Number.isNaN(r.foodCost) && r.foodCost >= 0 ? r.foodCost : 0,
      popularity: r.popularity != null && !Number.isNaN(r.popularity) ? Math.max(1, Math.min(3, Math.round(r.popularity))) : 2,
    }))
    .filter((r) => r.name)
    .slice(0, 500);
  if (clean.length === 0) return { error: "No rows with a name to import.", imported: 0 };

  const supabase = await createClient();
  const { count } = await supabase
    .from("menu_engineering_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", profile.orgId);
  const base = count ?? 0;

  const { error } = await supabase.from("menu_engineering_items").insert(
    clean.map((r, i) => ({ org_id: profile.orgId, ...r, sort_order: base + i, created_by: profile.userId }))
  );
  if (error) return { error: error.message, imported: 0 };

  revalidatePath("/menu");
  return { error: null, imported: clean.length };
}

export async function deleteMenuItem(id: string) {
  const { profile } = await requireMenuEditor();
  if (!profile) return;
  const supabase = await createClient();
  await supabase.from("menu_engineering_items").delete().eq("id", id);
  revalidatePath("/menu");
}
