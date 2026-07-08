"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";

export type MenuUploadState = { error: string | null; parsedCount?: number };

type ParsedDish = {
  name: string;
  description: string;
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

  const department = String(formData.get("department") || "");
  const file = formData.get("file") as File | null;

  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Invalid department." };
  if (!file || file.size === 0) return { error: "Choose a menu file (PDF or image) first." };
  if (file.size > 10 * 1024 * 1024) return { error: "File is too large — 10MB max." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "ANTHROPIC_API_KEY isn't configured yet — add it in Vercel's project environment variables." };
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
- A one-sentence pairing suggestion (what to recommend alongside it, e.g. a wine or side)
- A one-sentence upsell suggestion (a specific, natural way staff can suggest a bigger or add-on version)
- A short comma-separated list of likely allergens based on typical ingredients (best guess is fine, note "verify with kitchen" is implied, don't add that text)

Respond with ONLY a valid JSON array, no markdown fences, no commentary, matching exactly this shape:
[{"name": string, "description": string, "price": number or null, "allergens": string, "pairing_suggestion": string, "upsell_suggestion": string}]`;

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
        max_tokens: 4000,
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
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");
    let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("[");
    const last = cleaned.lastIndexOf("]");
    if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
    dishes = JSON.parse(cleaned);

    if (!Array.isArray(dishes) || dishes.length === 0) {
      throw new Error("Couldn't find any menu items in that file. Try a clearer photo or PDF.");
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Menu parsing failed. Try again." };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  // Re-parsing replaces the previously auto-parsed items but leaves any
  // manually added "custom" items untouched.
  await supabase.from("menu_items").delete().eq("org_id", org.id).eq("department", department).eq("source", "wingman");

  const { error: insertError } = await supabase.from("menu_items").insert(
    dishes.map((d, i) => ({
      org_id: org.id,
      department,
      name: d.name,
      description: d.description ?? "",
      price: d.price,
      allergens: d.allergens ?? "",
      pairing_suggestion: d.pairing_suggestion ?? "",
      upsell_suggestion: d.upsell_suggestion ?? "",
      source: "wingman",
      sort_order: i,
    }))
  );
  if (insertError) return { error: insertError.message };

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

export async function deleteMenuItem(id: string) {
  const supabase = await createClient();
  await supabase.from("menu_items").delete().eq("id", id);
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

  const { error } = await supabase.from("menu_items").insert({
    org_id: org.id,
    department,
    name,
    description: String(formData.get("description") || ""),
    allergens: String(formData.get("allergens") || ""),
    pairing_suggestion: String(formData.get("pairing_suggestion") || ""),
    upsell_suggestion: String(formData.get("upsell_suggestion") || ""),
    source: "custom",
  });
  if (error) return { error: error.message };

  revalidatePath("/training");
  return { error: null };
}
