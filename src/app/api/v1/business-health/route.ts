import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey, apiUnauthorized, apiError } from "@/lib/api-auth";
import { consumeRateLimit, API_V1_LIMIT } from "@/lib/rate-limit";

// GET /api/v1/business-health -> recent weekly business-health inputs for this org.
export async function GET(request: NextRequest) {
  const caller = await authenticateApiKey(request);
  if (!caller) return apiUnauthorized();
  if (!(await consumeRateLimit(`apiv1:${caller.keyId}`, API_V1_LIMIT.max, API_V1_LIMIT.windowSeconds))) {
    return apiError("Rate limit exceeded. Slow down and retry shortly.", 429);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("business_health_metrics")
    .select("id, period_date, location_id, net_sales, labor_cost, labor_hours, comp_cost, covers, checks, seats, created_at")
    .eq("org_id", caller.orgId)
    .order("period_date", { ascending: false })
    .limit(100);
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
