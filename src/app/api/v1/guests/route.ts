import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey, apiUnauthorized, apiError } from "@/lib/api-auth";

// GET /api/v1/guests -> recent guests (with their visits) for this org.
export async function GET(request: NextRequest) {
  const caller = await authenticateApiKey(request);
  if (!caller) return apiUnauthorized();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("guests")
    .select("id, name, phone, email, created_at, guest_visits(visit_number, visit_date, location_id, incentive, notes)")
    .eq("org_id", caller.orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return apiError(error.message, 500);
  return NextResponse.json({ guests: data ?? [] });
}

// POST /api/v1/guests -> create a guest, optionally with a first visit.
// Body: { name (required), phone?, email?, visit?: { visit_number(1-4), visit_date?, location_id?, incentive?, notes? } }
export async function POST(request: NextRequest) {
  const caller = await authenticateApiKey(request);
  if (!caller) return apiUnauthorized();

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return apiError("Invalid JSON body.");

  const name = String(raw.name ?? "").trim();
  if (!name) return apiError("name is required.");
  const phone = String(raw.phone ?? "").trim();
  const email = String(raw.email ?? "").trim();

  const admin = createAdminClient();

  const { data: guest, error } = await admin
    .from("guests")
    .insert({ org_id: caller.orgId, name, phone, email })
    .select("id")
    .single();
  if (error) return apiError(error.message, 500);

  // Optional first visit.
  const visit = raw.visit as Record<string, unknown> | undefined;
  if (visit && typeof visit === "object") {
    const visitNumber = Number(visit.visit_number);
    if (!Number.isInteger(visitNumber) || visitNumber < 1 || visitNumber > 4) {
      return apiError("visit.visit_number must be an integer from 1 to 4.");
    }

    let locationId: string | null = null;
    if (visit.location_id != null && visit.location_id !== "") {
      locationId = String(visit.location_id);
      const { data: loc } = await admin
        .from("locations")
        .select("id")
        .eq("id", locationId)
        .eq("org_id", caller.orgId)
        .maybeSingle();
      if (!loc) return apiError("visit.location_id is not in your organization.");
    }

    const visitDate = visit.visit_date != null && visit.visit_date !== "" ? String(visit.visit_date) : null;
    if (visitDate && !/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
      return apiError("visit.visit_date must be in YYYY-MM-DD format.");
    }

    const { error: visitError } = await admin.from("guest_visits").insert({
      guest_id: guest.id,
      org_id: caller.orgId,
      visit_number: visitNumber,
      visit_date: visitDate,
      location_id: locationId,
      incentive: String(visit.incentive ?? ""),
      notes: String(visit.notes ?? ""),
    });
    if (visitError) return apiError(visitError.message, 500);
  }

  return NextResponse.json({ ok: true, id: guest.id }, { status: 201 });
}
