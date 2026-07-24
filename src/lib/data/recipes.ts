import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RecipeStep = {
  id: string;
  stepNumber: number;
  instruction: string;
  imagePath: string | null;
  imageUrl: string | null;
};

// Public URL for a recipe photo. The bucket is public, so this is a plain CDN
// URL — no signing needed.
function publicUrl(path: string | null): string | null {
  if (!path) return null;
  const admin = createAdminClient();
  return admin.storage.from("recipe-images").getPublicUrl(path).data.publicUrl;
}

// All steps for one dish, in order, with resolved photo URLs.
export async function getRecipeSteps(menuItemId: string): Promise<RecipeStep[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipe_steps")
    .select("id, step_number, instruction, image_path")
    .eq("menu_item_id", menuItemId)
    .order("step_number");
  return ((data ?? []) as { id: string; step_number: number; instruction: string; image_path: string | null }[]).map((r) => ({
    id: r.id,
    stepNumber: r.step_number,
    instruction: r.instruction,
    imagePath: r.image_path,
    imageUrl: publicUrl(r.image_path),
  }));
}

// How many steps each dish has — to show "3 steps" / "Add recipe" on the list
// without loading every step. Keyed by menu_item_id.
export async function getRecipeStepCounts(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("recipe_steps").select("menu_item_id");
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { menu_item_id: string }[]) {
    counts.set(r.menu_item_id, (counts.get(r.menu_item_id) ?? 0) + 1);
  }
  return counts;
}
