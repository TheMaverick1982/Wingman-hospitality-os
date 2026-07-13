import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey, resolveApiLocation, apiUnauthorized, apiError } from "@/lib/api-auth";
import { consumeRateLimit, API_V1_LIMIT } from "@/lib/rate-limit";

// GET /api/v1/business-health -> recent weekly business-health inputs for this org.
export async function GET(request: NextRequest) {
  const caller = await authenticateApiKey(request);
  if (!caller) return apiUnauthorized();
  if (!(await consumeRateLimit(`apiv1:${caller.keyId}`, API_V1_LIMIT.max, API_V1_LIMIT.windowSeconds))) {
    return apiError("Rate limit exceeded. Slow down and retry shortly.", 429);
  }

  const loc = await resolveApiLocation(request, caller);
  if (loc.error) return loc.error;

  const admin = createAdminClient();
  let query = admin
    .from("business_health_metrics")
    .select("id, period_date, location_id, net_sales, labor_cost, labor_hours, comp_cost, covers, checks, seats, created_at")
    .eq("org_id", caller.orgId);
  if (loc.locationId) query = query.eq("location_id", loc.locationId);
  const { data, error } = await query.order("period_date", { ascending: false }).limit(100);
  if (error) return apiError(error.message, 500);
  return NextResponse.json({ entries: data ?? [] });
}

// POST /api/v1/business-health -> upsert one week's RAW POS numbers.
// Body: { period_date "YYYY-MM-DD", net_sales, labor_cost, labor_hours, comp_cost,
//         covers, checks, seats?, location_id? }
// Wingman derives the dashboard ratios (revenue/seat, revenue/labor hr, labor %,
// avg check, comp cost, retention $ impact) from these. Omit location_id for an
// org-wide entry.
export async function POST(request: NextRequest) {
  const caller = await authenticateApiKey(request);
  if (!caller) return apiUnauthorized();
  if (!(await consumeRateLimit(`apiv1:${caller.keyId}`, API_V1_LIMIT.max, API_V1_LIMIT.windowSeconds))) {
    return apiError("Rate limit exceeded. Slow down and retry shortly.", 429);
  }

  const scope = await resolveApiLocation(request, caller);
  if (scope.error) return scope.error;

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return apiError("Invalid JSON body.");

  const periodDate = String(raw.period_date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodDate)) return apiError("period_date must be in YYYY-MM-DD format.");

  // Non-negative numeric fields. `seats` is optional (null when omitted).
  const numericFields = ["net_sales", "labor_cost", "labor_hours", "comp_cost", "covers", "checks"] as const;
  const values: Record<string, number> = {};
  for (const field of numericFields) {
    const value = Number(raw[field] ?? 0);
    if (!Number.isFinite(value) || value < 0) return apiError(`${field} must be a non-negative number.`);
    values[field] = value;
  }
  let seats: number | null = null;
  if (raw.seats != null && raw.seats !== "") {
    const s = Number(raw.seats);
    if (!Number.isFinite(s) || s < 0) return apiError("seats must be a non-negative number.");
    seats = s;
  }

  const admin = createAdminClient();

  // location_id: explicit body value (validated) wins; otherwise fall back to the
  // request scope (the key's location or the header). Omit both for an org-wide row.
  let locationId: string | null = scope.locationId;
  if (raw.location_id != null && raw.location_id !== "") {
    const explicit = String(raw.location_id);
    if (caller.keyLocationId && explicit !== caller.keyLocationId) {
      return apiError("This key is locked to one location and can't write to another.", 403);
    }
    const { data: loc } = await admin
      .from("locations")
      .select("id")
      .eq("id", explicit)
      .eq("org_id", caller.orgId)
      .maybeSingle();
    if (!loc) return apiError("location_id is not in your organization.");
    locationId = explicit;
  }

  // Manual upsert (the unique indexes on period/location are partial).
  let existingQuery = admin
    .from("business_health_metrics")
    .select("id")
    .eq("org_id", caller.orgId)
    .eq("period_date", periodDate);
  existingQuery = locationId == null ? existingQuery.is("location_id", null) : existingQuery.eq("location_id", locationId);
  const { data: existing } = await existingQuery.maybeSingle();
  const existingId = (existing as { id: string } | null)?.id ?? null;

  const row = {
    net_sales: values.net_sales,
    labor_cost: values.labor_cost,
    labor_hours: values.labor_hours,
    comp_cost: values.comp_cost,
    covers: Math.round(values.covers),
    checks: Math.round(values.checks),
    seats: seats == null ? null : Math.round(seats),
  };

  if (existingId) {
    const { error } = await admin.from("business_health_metrics").update(row).eq("id", existingId);
    if (error) return apiError(error.message, 500);
    return NextResponse.json({ ok: true, id: existingId, updated: true });
  }

  const { data: inserted, error } = await admin
    .from("business_health_metrics")
    .insert({ org_id: caller.orgId, location_id: locationId, period_date: periodDate, ...row })
    .select("id")
    .single();
  if (error) return apiError(error.message, 500);
  return NextResponse.json({ ok: true, id: inserted.id, created: true }, { status: 201 });
}
