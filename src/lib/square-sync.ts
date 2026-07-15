import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { squareGet, refreshAccessToken } from "@/lib/square";

type Connection = {
  org_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
};

// Monday (UTC) of the week containing `nowMs`, as YYYY-MM-DD — the period_date
// business_health_metrics keys a weekly row on.
function weekStartMonday(nowMs: number): string {
  const d = new Date(nowMs);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

// Refresh the token if it expires within 7 days, and persist the new one.
async function ensureFreshToken(admin: ReturnType<typeof createAdminClient>, conn: Connection): Promise<string> {
  const exp = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (exp && exp - Date.now() > 7 * 86400000) return conn.access_token;
  if (!conn.refresh_token) return conn.access_token;
  try {
    const t = await refreshAccessToken(conn.refresh_token);
    if (t.access_token) {
      await admin
        .from("square_connections")
        .update({ access_token: t.access_token, refresh_token: t.refresh_token, token_expires_at: t.expires_at })
        .eq("org_id", conn.org_id);
      return t.access_token;
    }
  } catch (e) {
    console.error("square token refresh failed", e);
  }
  return conn.access_token;
}

type SquareCustomer = { given_name?: string; family_name?: string; company_name?: string; email_address?: string; phone_number?: string };
type SquarePayment = { amount_money?: { amount?: number }; status?: string };
type SquareLocation = { id: string; name?: string };

// Import up to this many new guests per run, to bound runtime.
const MAX_GUESTS = 500;

// Pull Square customers into guests (new only, deduped by email/phone) and sum
// the last 7 days of payments into this week's Business Health row.
export async function syncSquareOrg(orgId: string): Promise<{ guests: number; salesCents: number; error: string | null }> {
  const admin = createAdminClient();
  const { data: connRow } = await admin
    .from("square_connections")
    .select("org_id, access_token, refresh_token, token_expires_at")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!connRow) return { guests: 0, salesCents: 0, error: "Not connected to Square." };
  const conn = connRow as Connection;

  const now = Date.now();
  let token: string;
  try {
    token = await ensureFreshToken(admin, conn);
  } catch (e) {
    return { guests: 0, salesCents: 0, error: String(e).slice(0, 200) };
  }

  let importedGuests = 0;
  let salesCents = 0;
  try {
    // --- Customers -> guests -------------------------------------------------
    const { data: existing } = await admin.from("guests").select("email, phone").eq("org_id", orgId);
    const seenEmail = new Set<string>();
    const seenPhone = new Set<string>();
    for (const g of (existing ?? []) as { email: string; phone: string }[]) {
      if (g.email) seenEmail.add(g.email.toLowerCase());
      if (g.phone) seenPhone.add(g.phone.replace(/\D/g, ""));
    }

    const newGuests: { org_id: string; name: string; email: string; phone: string; source: string }[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const params: Record<string, string> = { limit: "100" };
      if (cursor) params.cursor = cursor;
      const page = await squareGet<{ customers?: SquareCustomer[]; cursor?: string }>("/v2/customers", token, params);
      for (const c of page.customers ?? []) {
        const name = [c.given_name, c.family_name].filter(Boolean).join(" ").trim() || c.company_name?.trim() || "";
        const email = (c.email_address ?? "").trim();
        const phone = (c.phone_number ?? "").trim();
        if (!name && !email && !phone) continue;
        const emailKey = email.toLowerCase();
        const phoneKey = phone.replace(/\D/g, "");
        if ((emailKey && seenEmail.has(emailKey)) || (phoneKey && seenPhone.has(phoneKey))) continue;
        if (emailKey) seenEmail.add(emailKey);
        if (phoneKey) seenPhone.add(phoneKey);
        newGuests.push({ org_id: orgId, name: name || email || phone, email, phone, source: "square" });
        if (newGuests.length >= MAX_GUESTS) break;
      }
      cursor = page.cursor;
      pages++;
    } while (cursor && newGuests.length < MAX_GUESTS && pages < 10);

    if (newGuests.length > 0) {
      const { error } = await admin.from("guests").insert(newGuests);
      if (!error) importedGuests = newGuests.length;
    }

    // --- Payments (last 7 days) -> Business Health, per location ------------
    // Map each Square location to a Wingman location by name so multi-location
    // merchants get per-store sales; anything unmatched aggregates org-wide.
    const beginIso = new Date(now - 7 * 86400000).toISOString();
    const { data: wLocs } = await admin.from("locations").select("id, name").eq("org_id", orgId);
    const nameToId = new Map<string, string>();
    for (const l of (wLocs ?? []) as { id: string; name: string }[]) nameToId.set(l.name.trim().toLowerCase(), l.id);

    let squareLocs: SquareLocation[] = [];
    try {
      const ld = await squareGet<{ locations?: SquareLocation[] }>("/v2/locations", token);
      squareLocs = ld.locations ?? [];
    } catch {
      squareLocs = [];
    }

    // bucket key: Wingman location_id, or "" for the org-wide (null) bucket.
    const buckets = new Map<string, { sales: number; checks: number }>();
    for (const loc of squareLocs) {
      let locCents = 0;
      let locChecks = 0;
      let pcursor: string | undefined;
      let ppages = 0;
      do {
        const params: Record<string, string> = { location_id: loc.id, begin_time: beginIso, limit: "100" };
        if (pcursor) params.cursor = pcursor;
        const pg = await squareGet<{ payments?: SquarePayment[]; cursor?: string }>("/v2/payments", token, params);
        for (const p of pg.payments ?? []) {
          if (p.status && p.status !== "COMPLETED" && p.status !== "APPROVED") continue;
          locCents += p.amount_money?.amount ?? 0;
          locChecks++;
        }
        pcursor = pg.cursor;
        ppages++;
      } while (pcursor && ppages < 20);
      salesCents += locCents;
      const target = nameToId.get((loc.name ?? "").trim().toLowerCase()) ?? "";
      const b = buckets.get(target) ?? { sales: 0, checks: 0 };
      b.sales += locCents;
      b.checks += locChecks;
      buckets.set(target, b);
    }

    // Upsert one weekly Business Health row per bucket. Manual select-then-write
    // (partial unique index), and only touch sales/checks so manually entered
    // labor for the week is preserved.
    const period = weekStartMonday(now);
    for (const [locId, b] of buckets) {
      if (b.sales <= 0 && b.checks <= 0) continue;
      const dollars = Math.round(b.sales) / 100;
      const wLocId = locId || null;
      let q = admin.from("business_health_metrics").select("id").eq("org_id", orgId).eq("period_date", period);
      q = wLocId ? q.eq("location_id", wLocId) : q.is("location_id", null);
      const { data: existingRow } = await q.maybeSingle();
      if (existingRow) {
        await admin.from("business_health_metrics").update({ net_sales: dollars, checks: b.checks }).eq("id", (existingRow as { id: string }).id);
      } else {
        await admin.from("business_health_metrics").insert({ org_id: orgId, location_id: wLocId, period_date: period, net_sales: dollars, checks: b.checks });
      }
    }

    await admin
      .from("square_connections")
      .update({ last_sync_at: new Date(now).toISOString(), last_sync_status: "ok", last_sync_guests: importedGuests, last_sync_sales_cents: salesCents })
      .eq("org_id", orgId);

    return { guests: importedGuests, salesCents, error: null };
  } catch (e) {
    const msg = String(e).slice(0, 200);
    await admin.from("square_connections").update({ last_sync_at: new Date(now).toISOString(), last_sync_status: `error: ${msg}` }).eq("org_id", orgId);
    return { guests: importedGuests, salesCents, error: msg };
  }
}
