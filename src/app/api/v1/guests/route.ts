import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey, resolveApiLocation, apiUnauthorized, apiError } from "@/lib/api-auth";
import { consumeRateLimit, API_V1_LIMIT } from "@/lib/rate-limit";

// GET /api/v1/guests -> recent guests (with their visits) for this org.
export async function GET(request: NextRequest) {
  const caller = await authenticateApiKey(request);
  if (!caller) return apiUnauthorized();
  if (!(await consumeRateLimit(`apiv1:${caller.keyId}`, API_V1_LIMIT.max, API_V1_LIMIT.windowSeconds))) {
    return apiError("Rate limit exceeded. Slow down and retry shortly.", 429);
  }

  const loc = await resolveApiLocation(request, caller);
  if (loc.error) return loc.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("guests")
    .select("id, name, phone, email, source, referred_a_friend, created_at, guest_visits(visit_number, visit_date, location_id, incentive, notes, reaction, bill_total)")
    .eq("org_id", caller.orgId)
    .order("created_at", { ascending: false })
    .limit(loc.locationId ? 1000 : 200);
  if (error) return apiError(error.message, 500);

  // When scoped to a location, return only guests seen at that location.
  let guests = (data ?? []) as { guest_visits: { location_id: string | null }[] }[];
  if (loc.locationId) {
    guests = guests.filter((g) => (g.guest_visits ?? []).some((v) => v.location_id === loc.locationId)).slice(0, 200);
  }
  return NextResponse.json({ guests });
}

const REACTIONS = ["wowed", "delighted", "neutral", "let_down"];

// POST /api/v1/guests -> create a guest, optionally with a first visit.
// Body: {
//   name (required), phone?, email?,
//   source?           (e.g. "pos"; defaults to "api"),
//   captured_by?      (who/what logged them, e.g. a POS name),
//   referred_a_friend? (boolean),
//   visit?: { visit_number(1-4), visit_date?, location_id?, incentive?, notes?,
//             reaction?(wowed|delighted|neutral|let_down), bill_total?(number >= 0) }
// }
export async function POST(request: NextRequest) {
  const caller = await authenticateApiKey(request);
  if (!caller) return apiUnauthorized();
  if (!(await consumeRateLimit(`apiv1:${caller.keyId}`, API_V1_LIMIT.max, API_V1_LIMIT.windowSeconds))) {
    return apiError("Rate limit exceeded. Slow down and retry shortly.", 429);
  }

  const loc = await resolveApiLocation(request, caller);
  if (loc.error) return loc.error;

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return apiError("Invalid JSON body.");

  const name = String(raw.name ?? "").trim();
  if (!name) return apiError("name is required.");
  const phone = String(raw.phone ?? "").trim();
  const email = String(raw.email ?? "").trim();
  // Where this guest came from (tags the retention/source reporting). Defaults
  // to "api" so integration-created guests are distinguishable.
  const source = raw.source != null && String(raw.source).trim() !== "" ? String(raw.source).trim().slice(0, 40) : "api";
  const capturedBy = raw.captured_by != null && String(raw.captured_by).trim() !== "" ? String(raw.captured_by).trim().slice(0, 120) : null;
  const referredAFriend = raw.referred_a_friend === true;

  const admin = createAdminClient();

  const { data: guest, error } = await admin
    .from("guests")
    .insert({ org_id: caller.orgId, name, phone, email, source, captured_by: capturedBy, referred_a_friend: referredAFriend })
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

    // Location precedence: explicit visit.location_id (validated) wins; otherwise
    // fall back to the request's scope (the key's location, or the header). A
    // location-locked key rejects a visit that names a different location.
    let locationId: string | null = loc.locationId;
    if (visit.location_id != null && visit.location_id !== "") {
      const explicit = String(visit.location_id);
      if (caller.keyLocationId && explicit !== caller.keyLocationId) {
        return apiError("This key is locked to one location and can't log a visit at another.", 403);
      }
      const { data: locRow } = await admin
        .from("locations")
        .select("id")
        .eq("id", explicit)
        .eq("org_id", caller.orgId)
        .maybeSingle();
      if (!locRow) return apiError("visit.location_id is not in your organization.");
      locationId = explicit;
    }

    const visitDate = visit.visit_date != null && visit.visit_date !== "" ? String(visit.visit_date) : null;
    if (visitDate && !/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
      return apiError("visit.visit_date must be in YYYY-MM-DD format.");
    }

    let reaction: string | null = null;
    if (visit.reaction != null && visit.reaction !== "") {
      reaction = String(visit.reaction);
      if (!REACTIONS.includes(reaction)) {
        return apiError("visit.reaction must be one of: wowed, delighted, neutral, let_down.");
      }
    }

    let billTotal: number | null = null;
    if (visit.bill_total != null && visit.bill_total !== "") {
      const b = Number(visit.bill_total);
      if (!Number.isFinite(b) || b < 0) return apiError("visit.bill_total must be a non-negative number.");
      billTotal = b;
    }

    const { error: visitError } = await admin.from("guest_visits").insert({
      guest_id: guest.id,
      org_id: caller.orgId,
      visit_number: visitNumber,
      visit_date: visitDate,
      location_id: locationId,
      incentive: String(visit.incentive ?? ""),
      notes: String(visit.notes ?? ""),
      reaction,
      bill_total: billTotal,
    });
    if (visitError) return apiError(visitError.message, 500);
  }

  return NextResponse.json({ ok: true, id: guest.id }, { status: 201 });
}
