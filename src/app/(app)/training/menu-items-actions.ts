"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS, menuGroup, type Department } from "@/lib/constants";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { consumeAiLimit } from "@/lib/rate-limit";
import { recordAiUsage } from "@/lib/ai/usage";

export type MenuUploadState = { error: string | null; parsedCount?: number };

type ParsedDish = {
  name: string;
  description: string;
  category: string;
  price: number | null;
  allergens: string;
  pairing_suggestion: string;
  upsell_suggestion: string;
};

export async function uploadAndParseMenu(_prev: MenuUploadState, formData: FormData): Promise<MenuUploadState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canEditSection(profile.accessRole, "training", profile.permissionOverrides)) {
    return { error: "You don't have access to upload menus." };
  }
  if (!(await consumeAiLimit(profile))) {
    return { error: "You've reached the hourly limit for AI generation. Please try again a bit later." };
  }

  const department = String(formData.get("department") || "");
  const file = formData.get("file") as File | null;

  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };
  if (!file || file.size === 0) return { error: "Choose a menu file (PDF or image) first." };
  if (file.size > 10 * 1024 * 1024) return { error: "File is too large — 10MB max." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };
  }

  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");
  if (!isPdf && !isImage) return { error: "Upload a PDF or image (JPG/PNG) of the menu." };

  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: bytes } }
    : { type: "image", source: { type: "base64", media_type: file.type, data: bytes } };

  const prompt = `This is a photo or PDF of a restaurant's ${department.toLowerCase()} menu. Read every dish/drink on it and extract structured data for each one.

For each item, also write:
- A menu category / section for grouping (e.g. "Appetizers", "Salads", "Mains", "Sides", "Desserts", "Cocktails", "Wine", "Beer", "Non-Alcoholic"). If the menu is already divided into sections, use those section names. If it is NOT sectioned, infer the best category for each item from what the item actually is. Keep the category names short, in Title Case, and reuse the same wording across items so they group cleanly.
- A one-sentence pairing suggestion (what to recommend alongside it, e.g. a wine or side)
- A one-sentence upsell suggestion (a specific, natural way staff can suggest a bigger or add-on version)
- A short comma-separated list of likely allergens based on typical ingredients (best guess is fine, note "verify with kitchen" is implied, don't add that text)

Respond with ONLY a valid JSON array, no markdown fences, no commentary, matching exactly this shape:
[{"name": string, "description": string, "category": string, "price": number or null, "allergens": string, "pairing_suggestion": string, "upsell_suggestion": string}]`;

  let dishes: ParsedDish[];
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: [contentBlock, { type: "text", text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Anthropic API returned ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    await recordAiUsage({ orgId: profile.orgId, feature: "menu_parse", model: "claude-sonnet-5", usage: data.usage });
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("Couldn't read that menu. Try a clearer, well-lit photo or a text-based PDF.");
    let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("[");
    const last = cleaned.lastIndexOf("]");
    if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
    try {
      dishes = JSON.parse(cleaned);
    } catch {
      if (data.stop_reason === "max_tokens") {
        throw new Error("That menu was too long to read in one pass — try uploading one page or section at a time.");
      }
      throw new Error("Couldn't read the full menu from that file. Try a clearer photo, or upload one section at a time.");
    }

    if (!Array.isArray(dishes) || dishes.length === 0) {
      throw new Error("Couldn't find any menu items in that file. Try a clearer photo or PDF.");
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Menu parsing failed. Try again." };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  // Smart merge, not wipe-and-replace: match each parsed dish to an existing item
  // by name (case-insensitive) and UPDATE it in place — so a re-upload refreshes
  // the details without creating duplicates and without throwing away an owner's
  // popularity/profit numbers or their manual edits. Genuinely new dishes are
  // inserted; items no longer on the menu are left alone (the owner can remove
  // them with the bulk-delete controls). Matching is scoped to the same MENU
  // GROUP (food vs bar), not the exact department — the food menu is shared
  // across the Server and Chef tabs, so re-uploading it from either tab dedupes
  // against the one shared list instead of duplicating every dish.
  const group = menuGroup(department);
  const { data: existingRows } = await supabase
    .from("menu_items")
    .select("id, name, department")
    .eq("org_id", org.id);
  const byName = new Map(
    ((existingRows ?? []) as { id: string; name: string; department: string }[])
      .filter((e) => menuGroup(e.department) === group)
      .map((e) => [e.name.trim().toLowerCase(), e.id])
  );

  const updatePlan: { id: string; fields: Record<string, unknown> }[] = [];
  const toInsert: Record<string, unknown>[] = [];
  dishes.forEach((d, i) => {
    const fields = {
      description: d.description ?? "",
      category: (d.category ?? "").trim(),
      price: d.price,
      allergens: d.allergens ?? "",
      pairing_suggestion: d.pairing_suggestion ?? "",
      upsell_suggestion: d.upsell_suggestion ?? "",
      sort_order: i,
      // Re-uploading a menu that includes a previously-archived dish brings it
      // (and its recipe) back to the active menu.
      archived_at: null,
    };
    const key = (d.name ?? "").trim().toLowerCase();
    const existingId = key ? byName.get(key) : undefined;
    if (existingId) {
      updatePlan.push({ id: existingId, fields });
    } else {
      toInsert.push({ org_id: org.id, department, name: d.name, source: "wingman", ...fields });
    }
  });

  const updateResults = await Promise.all(
    updatePlan.map((u) => supabase.from("menu_items").update(u.fields).eq("id", u.id))
  );
  const insertResult = toInsert.length ? await supabase.from("menu_items").insert(toInsert) : null;
  const firstErr = [...updateResults, insertResult].find((r) => r != null && r.error != null);
  if (firstErr && firstErr.error) return { error: firstErr.error.message };

  revalidatePath("/training");
  return { error: null, parsedCount: dishes.length };
}

export async function updateMenuItemMetrics(id: string, popularityPct: number | null, profitAmount: number | null) {
  const supabase = await createClient();
  await supabase
    .from("menu_items")
    .update({ popularity_pct: popularityPct, profit_amount: profitAmount })
    .eq("id", id);
  revalidatePath("/training");
}

// "Delete" a menu item = archive it (soft delete). The dish drops off the active
// menu but stays in the database with its recipe intact, so it can be restored
// later. Never a hard delete — that would take the recipe with it.
export async function deleteMenuItem(id: string) {
  const supabase = await createClient();
  await supabase.from("menu_items").update({ archived_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/training");
}

// Bulk-archive several menu items at once (the checkbox selection). RLS scopes
// it to the caller's org, so a stray id from another org is a no-op.
export async function deleteMenuItems(ids: string[]) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (clean.length === 0) return;
  const supabase = await createClient();
  await supabase.from("menu_items").update({ archived_at: new Date().toISOString() }).in("id", clean);
  revalidatePath("/training");
}

// Bring an archived dish (and its recipe) back to the active menu.
export async function restoreMenuItem(id: string) {
  const supabase = await createClient();
  await supabase.from("menu_items").update({ archived_at: null }).eq("id", id);
  revalidatePath("/training");
}

// Permanent delete from the archive — the one path that actually removes the
// row (its recipe_steps cascade away too). Deliberate and irreversible.
export async function deleteMenuItemPermanently(id: string) {
  const supabase = await createClient();
  await supabase.from("menu_items").delete().eq("id", id);
  revalidatePath("/training");
}

export type EditMenuItemState = { error: string | null };

// Inline-edit a single item's details. Only the fields the owner can change are
// touched; popularity/profit metrics have their own save path.
export async function updateMenuItem(_prev: EditMenuItemState, formData: FormData): Promise<EditMenuItemState> {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id) return { error: "Missing item." };
  if (!name) return { error: "Dish name is required." };

  const priceRaw = String(formData.get("price") || "").trim();
  const price = priceRaw === "" ? null : Number(priceRaw);
  if (price != null && !Number.isFinite(price)) return { error: "Price must be a number." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .update({
      name,
      category: String(formData.get("category") || "").trim(),
      description: String(formData.get("description") || ""),
      allergens: String(formData.get("allergens") || ""),
      pairing_suggestion: String(formData.get("pairing_suggestion") || ""),
      upsell_suggestion: String(formData.get("upsell_suggestion") || ""),
      price,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  // LTO flag written separately and guarded: its column (0144) only lands on the
  // prod branch, so folding it into the update above would break inline edit on a
  // not-yet-migrated preview. On preview it simply no-ops.
  await setMenuItemLtoSafe(supabase, id, formData.get("is_lto") === "on");

  revalidatePath("/training");
  return { error: null };
}

// Set is_lto without letting a missing column (pre-migration preview) fail the
// caller's main write. Errors are swallowed on purpose.
async function setMenuItemLtoSafe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  isLto: boolean
): Promise<void> {
  try {
    await supabase.from("menu_items").update({ is_lto: isLto }).eq("id", id);
  } catch {
    // is_lto not migrated yet — ignore.
  }
}

// Bulk mark/unmark dishes as Limited Time Offers (the checkbox selection).
// Guarded like the single-item path so a pre-migration preview no-ops instead of
// erroring. RLS scopes it to the caller's org.
export async function setMenuItemsLto(ids: string[], isLto: boolean) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (clean.length === 0) return;
  const supabase = await createClient();
  try {
    await supabase.from("menu_items").update({ is_lto: isLto }).in("id", clean);
  } catch {
    // is_lto not migrated yet — ignore.
  }
  revalidatePath("/training");
}

export type AddCustomDishState = { error: string | null };

export async function addCustomMenuItem(_prev: AddCustomDishState, formData: FormData): Promise<AddCustomDishState> {
  const department = String(formData.get("department") || "");
  const name = String(formData.get("name") || "").trim();
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };
  if (!name) return { error: "Dish name is required." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  const { data: inserted, error } = await supabase.from("menu_items").insert({
    org_id: org.id,
    department,
    name,
    description: String(formData.get("description") || ""),
    category: String(formData.get("category") || "").trim(),
    allergens: String(formData.get("allergens") || ""),
    pairing_suggestion: String(formData.get("pairing_suggestion") || ""),
    upsell_suggestion: String(formData.get("upsell_suggestion") || ""),
    source: "custom",
  }).select("id").single();
  if (error) return { error: error.message };

  if (formData.get("is_lto") === "on" && inserted?.id) {
    await setMenuItemLtoSafe(supabase, inserted.id as string, true);
  }

  revalidatePath("/training");
  return { error: null };
}
