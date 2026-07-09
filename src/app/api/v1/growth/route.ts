import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey, apiUnauthorized, apiError } from "@/lib/api-auth";
import { consumeRateLimit, API_V1_LIMIT } from "@/lib/rate-limit";

// GET /api/v1/growth  -> recent Revenue Growth Planner entries for this org.
export async function GET(request: NextRequest) {
  const caller = await authenticateApiKey(request);
  if (!caller) return apiUnauthorized();
  if (!(await consumeRateLimit(`apiv1:${caller.keyId}`, API_V1_LIMIT.max, API_V1_LIMIT.windowSeconds))) {
    return apiError("Rate limit exceeded. Slow down and retry shortly.", 429);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("growth_plan_entries")
    .select("id, period_date, location_id, customers, avg_sale, repurchase_frequency, created_at")
    .eq("org_id", caller.orgId)
    .order("period_date", { ascending: false })
    .limit(100);
  if (error) return apiError(error.message, 500);
  return NextResponse.json({ entries: data ?? [] });
}

// POST /api/v1/growth  -> upsert one weekly/period metric row.
// Body: { period_date: "YYYY-MM-DD", customers, avg_sale, repurchase_frequency, location_id? }
// If location_id is omitted the entry is org-wide (all locations).
export async function POST(request: NextRequest) {
  const caller = await authenticateApiKey(request);
  if (!caller) return apiUnauthorized();
  if (!(await consumeRateLimit(`apiv1:${caller.keyId}`, API_V1_LIMIT.max, API_V1_LIMIT.windowSeconds))) {
    return apiError("Rate limit exceeded. Slow down and retry shortly.", 429);
  }

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return apiError("Invalid JSON body.");

  const periodDate = String(raw.period_date ?? "");
  const customers = Number(raw.customers);
  const avgSale = Number(raw.avg_sale);
  const repurchase = Number(raw.repurchase_frequency);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodDate)) return apiError("period_date must be in YYYY-MM-DD format.");
  for (const [field, value] of [
    ["customers", customers],
    ["avg_sale", avgSale],
    ["repurchase_frequency", repurchase],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) return apiError(`${field} must be a non-negative number.`);
  }

  const admin = createAdminClient();

  // location_id is optional; if given it must belong to this org.
  let locationId: string | null = null;
  if (raw.location_id != null && raw.location_id !== "") {
    locationId = String(raw.location_id);
    const { data: loc } = await admin
      .from("locations")
      .select("id")
      .eq("id", locationId)
      .eq("org_id", caller.orgId)
      .maybeSingle();
    if (!loc) return apiError("location_id is not in your organization.");
  }

  // Manual upsert (the unique indexes on period/location are partial).
  let existingId: string | null = null;
  if (locationId == null) {
    const { data } = await admin
      .from("growth_plan_entries")
      .select("id")
      .eq("org_id", caller.orgId)
      .eq("period_date", periodDate)
      .is("location_id", null)
      .maybeSingle();
    existingId = (data as { id: string } | null)?.id ?? null;
  } else {
    const { data } = await admin
      .from("growth_plan_entries")
      .select("id")
      .eq("org_id", caller.orgId)
      .eq("period_date", periodDate)
      .eq("location_id", locationId)
      .maybeSingle();
    existingId = (data as { id: string } | null)?.id ?? null;
  }

  const metrics = { customers, avg_sale: avgSale, repurchase_frequency: repurchase };

  if (existingId) {
    const { error } = await admin.from("growth_plan_entries").update(metrics).eq("id", existingId);
    if (error) return apiError(error.message, 500);
    return NextResponse.json({ ok: true, id: existingId, updated: true });
  }

  const { data: inserted, error } = await admin
    .from("growth_plan_entries")
    .insert({ org_id: caller.orgId, location_id: locationId, period_date: periodDate, ...metrics })
    .select("id")
    .single();
  if (error) return apiError(error.message, 500);
  return NextResponse.json({ ok: true, id: inserted.id, created: true }, { status: 201 });
}
