import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey, apiUnauthorized, apiError } from "@/lib/api-auth";
import { consumeRateLimit, API_V1_LIMIT } from "@/lib/rate-limit";

// GET /api/v1/menu -> the org's Menu Engineering items.
export async function GET(request: NextRequest) {
  const caller = await authenticateApiKey(request);
  if (!caller) return apiUnauthorized();
  if (!(await consumeRateLimit(`apiv1:${caller.keyId}`, API_V1_LIMIT.max, API_V1_LIMIT.windowSeconds))) {
    return apiError("Rate limit exceeded. Slow down and retry shortly.", 429);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("menu_engineering_items")
    .select("id, name, price, food_cost, popularity, sort_order")
    .eq("org_id", caller.orgId)
    .order("sort_order", { ascending: true })
    .limit(1000);
  if (error) return apiError(error.message, 500);
  return NextResponse.json({ items: data ?? [] });
}

type InItem = { name: string; price: number; food_cost: number; popularity: number | null; units_sold: number | null };

// POST /api/v1/menu -> sync the Menu Engineering matrix from a POS.
// Body: { items: [{ name (required), price?, food_cost?, popularity?(1-3), units_sold? }] }
// Non-destructive: matches existing items by name (case-insensitive) and updates
// them, inserting any that are new. Items not in the payload are left alone.
// If popularity is omitted but units_sold is given, Wingman ranks the batch into
// terciles (bottom third = 1, middle = 2, top = 3).
export async function POST(request: NextRequest) {
  const caller = await authenticateApiKey(request);
  if (!caller) return apiUnauthorized();
  if (!(await consumeRateLimit(`apiv1:${caller.keyId}`, API_V1_LIMIT.max, API_V1_LIMIT.windowSeconds))) {
    return apiError("Rate limit exceeded. Slow down and retry shortly.", 429);
  }

  const raw = (await request.json().catch(() => null)) as { items?: unknown } | null;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.items)) {
    return apiError('Body must be { "items": [...] }.');
  }
  if (raw.items.length === 0) return apiError("Send at least one item.");
  if (raw.items.length > 500) return apiError("Sync up to 500 items at a time.");

  const items: InItem[] = [];
  for (const [i, r] of (raw.items as Record<string, unknown>[]).entries()) {
    if (!r || typeof r !== "object") return apiError(`items[${i}] must be an object.`);
    const name = String(r.name ?? "").trim();
    if (!name) return apiError(`items[${i}].name is required.`);

    const num = (v: unknown, field: string): number | null => {
      if (v == null || v === "") return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw new Error(`items[${i}].${field} must be a non-negative number.`);
      return n;
    };
    let price: number | null, foodCost: number | null, unitsSold: number | null, popularityRaw: number | null;
    try {
      price = num(r.price, "price");
      foodCost = num(r.food_cost, "food_cost");
      unitsSold = num(r.units_sold, "units_sold");
      popularityRaw = num(r.popularity, "popularity");
    } catch (err) {
      return apiError(err instanceof Error ? err.message : "Invalid number.");
    }
    if (popularityRaw != null && ![1, 2, 3].includes(Math.round(popularityRaw))) {
      return apiError(`items[${i}].popularity must be 1, 2, or 3.`);
    }

    items.push({
      name: name.slice(0, 200),
      price: price ?? 0,
      food_cost: foodCost ?? 0,
      popularity: popularityRaw == null ? null : Math.round(popularityRaw),
      units_sold: unitsSold,
    });
  }

  // Derive popularity for items that gave units_sold but no explicit popularity.
  const needRanking = items.filter((it) => it.popularity == null && it.units_sold != null);
  if (needRanking.length > 0) {
    const sorted = [...needRanking].sort((a, b) => (a.units_sold ?? 0) - (b.units_sold ?? 0));
    const n = sorted.length;
    sorted.forEach((it, idx) => {
      it.popularity = idx < n / 3 ? 1 : idx < (2 * n) / 3 ? 2 : 3;
    });
  }
  for (const it of items) if (it.popularity == null) it.popularity = 2; // no signal -> middle

  const admin = createAdminClient();

  // Match existing items by (lowercased) name within this org.
  const { data: existing } = await admin
    .from("menu_engineering_items")
    .select("id, name, sort_order")
    .eq("org_id", caller.orgId);
  const byName = new Map<string, string>();
  let maxSort = -1;
  for (const e of (existing ?? []) as { id: string; name: string; sort_order: number }[]) {
    byName.set(e.name.trim().toLowerCase(), e.id);
    if (e.sort_order > maxSort) maxSort = e.sort_order;
  }

  let updated = 0;
  let created = 0;
  const toInsert: { org_id: string; name: string; price: number; food_cost: number; popularity: number; sort_order: number }[] = [];

  for (const it of items) {
    const existingId = byName.get(it.name.toLowerCase());
    if (existingId) {
      const { error } = await admin
        .from("menu_engineering_items")
        .update({ price: it.price, food_cost: it.food_cost, popularity: it.popularity })
        .eq("id", existingId)
        .eq("org_id", caller.orgId);
      if (error) return apiError(error.message, 500);
      updated++;
    } else {
      toInsert.push({
        org_id: caller.orgId,
        name: it.name,
        price: it.price,
        food_cost: it.food_cost,
        popularity: it.popularity as number,
        sort_order: ++maxSort,
      });
    }
  }

  if (toInsert.length > 0) {
    const { error } = await admin.from("menu_engineering_items").insert(toInsert);
    if (error) return apiError(error.message, 500);
    created = toInsert.length;
  }

  return NextResponse.json({ ok: true, updated, created });
}
