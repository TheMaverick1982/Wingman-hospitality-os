"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";
import { recordAiUsage } from "@/lib/ai/usage";

const BUCKET = "recipe-images";

async function requireEditor() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (!canEditSection(profile.accessRole, "training", profile.permissionOverrides)) return null;
  return profile;
}

// Draft a dish's recipe steps with AI from what the menu already knows (name,
// description, allergens). Text only — the owner reviews/edits and adds photos
// after. Only ever runs on an EMPTY recipe, so a hand-written recipe is never
// overwritten. Kills the biggest manual cliff in kitchen setup (40 dishes =
// 40 hand-typed recipes).
export async function draftRecipeWithAI(menuItemId: string): Promise<{ error: string | null; added?: number }> {
  const profile = await requireEditor();
  if (!profile) return { error: "You don't have access to edit recipes." };

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("menu_items")
    .select("id, name, department, description, allergens")
    .eq("id", menuItemId)
    .maybeSingle();
  if (!item) return { error: "Dish not found." };
  const dish = item as { name: string; department: string | null; description: string | null; allergens: string | null };

  // Never clobber a hand-written recipe.
  const { count } = await supabase.from("recipe_steps").select("id", { count: "exact", head: true }).eq("menu_item_id", menuItemId);
  if ((count ?? 0) > 0) return { error: "This recipe already has steps — clear them first if you want a fresh AI draft." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };
  if (!(await consumeAiLimit(profile))) return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };

  const prompt = `Write a clear, numbered prep/make recipe for this restaurant dish so any line cook can make it to spec.
Dish: ${dish.name}${dish.department ? ` (${dish.department})` : ""}
${dish.description ? `Description: ${dish.description}` : ""}
${dish.allergens ? `Known allergens: ${dish.allergens}` : ""}

Give 5-10 concrete steps in order, each a single actionable instruction (include quantities, temps, and times where they matter). This is a best-effort draft the kitchen will review and correct, so keep it practical and typical for a dish like this. Respond with ONLY valid JSON, no markdown fences: {"steps": [string, ...]}`;

  let steps: string[];
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1200,
        system: "You are a seasoned executive chef writing simple, reliable line recipes. You output only valid JSON matching the requested shape, no commentary, no markdown fences.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API returned ${res.status}`);
    const data = await res.json();
    await recordAiUsage({ orgId: profile.orgId, feature: "recipe_draft", model: "claude-sonnet-5", usage: data.usage });
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
    let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
    const parsed = JSON.parse(cleaned) as { steps?: unknown };
    steps = (Array.isArray(parsed.steps) ? parsed.steps : [])
      .map((s) => String(s ?? "").trim())
      .filter(Boolean)
      .slice(0, 12);
    if (steps.length === 0) throw new Error("empty");
  } catch {
    return { error: "Couldn't draft the recipe just now. Try again in a moment." };
  }

  const rows = steps.map((instruction, i) => ({
    org_id: profile.orgId,
    menu_item_id: menuItemId,
    step_number: i + 1,
    instruction: instruction.slice(0, 600),
  }));
  const { error } = await supabase.from("recipe_steps").insert(rows);
  if (error) return { error: "Couldn't save the drafted steps. Try again." };

  revalidatePath(`/training/recipes/${menuItemId}`);
  return { error: null, added: rows.length };
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
