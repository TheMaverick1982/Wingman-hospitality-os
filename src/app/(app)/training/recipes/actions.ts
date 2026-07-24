"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";

const BUCKET = "recipe-images";

async function requireEditor() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (!canEditSection(profile.accessRole, "training", profile.permissionOverrides)) return null;
  return profile;
}

// Add a blank step to the end of a dish's recipe. The editor fills in the text
// and (optionally) a photo after.
export async function addRecipeStep(menuItemId: string) {
  const profile = await requireEditor();
  if (!profile) return;
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("recipe_steps")
    .select("step_number")
    .eq("menu_item_id", menuItemId)
    .order("step_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = ((last as { step_number?: number } | null)?.step_number ?? 0) + 1;
  await supabase.from("recipe_steps").insert({
    org_id: profile.orgId,
    menu_item_id: menuItemId,
    step_number: nextNumber,
    instruction: "",
  });
  revalidatePath(`/training/recipes/${menuItemId}`);
}

export async function updateRecipeStepText(stepId: string, instruction: string, menuItemId: string) {
  const profile = await requireEditor();
  if (!profile) return;
  const supabase = await createClient();
  await supabase.from("recipe_steps").update({ instruction, updated_at: new Date().toISOString() }).eq("id", stepId);
  revalidatePath(`/training/recipes/${menuItemId}`);
}

// Delete a step and renumber the ones after it, and remove its photo from
// storage so nothing is orphaned.
export async function deleteRecipeStep(stepId: string, menuItemId: string) {
  const profile = await requireEditor();
  if (!profile) return;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: step } = await supabase.from("recipe_steps").select("image_path").eq("id", stepId).maybeSingle();
  const path = (step as { image_path?: string | null } | null)?.image_path;
  if (path) await admin.storage.from(BUCKET).remove([path]);

  await supabase.from("recipe_steps").delete().eq("id", stepId);

  // Renumber remaining steps 1..n so there are no gaps.
  const { data: rest } = await supabase
    .from("recipe_steps")
    .select("id")
    .eq("menu_item_id", menuItemId)
    .order("step_number");
  await Promise.all(
    ((rest ?? []) as { id: string }[]).map((r, i) =>
      supabase.from("recipe_steps").update({ step_number: i + 1 }).eq("id", r.id)
    )
  );
  revalidatePath(`/training/recipes/${menuItemId}`);
}

// Swap a step with its neighbour (reorder up/down).
export async function moveRecipeStep(stepId: string, direction: "up" | "down", menuItemId: string) {
  const profile = await requireEditor();
  if (!profile) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipe_steps")
    .select("id, step_number")
    .eq("menu_item_id", menuItemId)
    .order("step_number");
  const steps = (data ?? []) as { id: string; step_number: number }[];
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx === -1) return;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= steps.length) return;
  const a = steps[idx];
  const b = steps[swapWith];
  await Promise.all([
    supabase.from("recipe_steps").update({ step_number: b.step_number }).eq("id", a.id),
    supabase.from("recipe_steps").update({ step_number: a.step_number }).eq("id", b.id),
  ]);
  revalidatePath(`/training/recipes/${menuItemId}`);
}

export type StepImageState = { error: string | null };

// Upload a photo for a step. The browser resizes to a small WebP first, so what
// arrives here is already ~150–250 KB. We store it under the org's folder and
// keep only the path on the step.
export async function uploadRecipeStepImage(_prev: StepImageState, formData: FormData): Promise<StepImageState> {
  const profile = await requireEditor();
  if (!profile) return { error: "You don't have access to edit recipes." };

  const stepId = String(formData.get("stepId") || "");
  const menuItemId = String(formData.get("menuItemId") || "");
  const file = formData.get("file") as File | null;
  if (!stepId || !menuItemId) return { error: "Missing step." };
  if (!file || file.size === 0) return { error: "Choose a photo." };
  if (file.size > 8 * 1024 * 1024) return { error: "That image is too large — try again (it should compress automatically)." };

  const admin = createAdminClient();
  const supabase = await createClient();
  const path = `${profile.orgId}/${menuItemId}/${stepId}.webp`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: true });
  if (up.error) return { error: "Couldn't upload that photo. Try again." };

  await supabase.from("recipe_steps").update({ image_path: path, updated_at: new Date().toISOString() }).eq("id", stepId);
  revalidatePath(`/training/recipes/${menuItemId}`);
  return { error: null };
}

export async function removeRecipeStepImage(stepId: string, menuItemId: string) {
  const profile = await requireEditor();
  if (!profile) return;
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: step } = await supabase.from("recipe_steps").select("image_path").eq("id", stepId).maybeSingle();
  const path = (step as { image_path?: string | null } | null)?.image_path;
  if (path) await admin.storage.from(BUCKET).remove([path]);
  await supabase.from("recipe_steps").update({ image_path: null, updated_at: new Date().toISOString() }).eq("id", stepId);
  revalidatePath(`/training/recipes/${menuItemId}`);
}
