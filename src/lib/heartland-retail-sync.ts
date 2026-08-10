import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll, type HeartlandCustomer, type HeartlandTicket, type HeartlandLocation } from "@/lib/heartland-retail";

type Conn = {
  org_id: string;
  account_host: string;
  account_name: string;
  access_token: string;
};

// Monday (UTC) of the week containing nowMs, as YYYY-MM-DD.
function weekStartMonday(nowMs: number): string {
  const d = new Date(nowMs);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

const MAX_GUESTS = 500;

// Sync one connected Heartland Retail account (org + host): customers → Guests
// (new only, deduped by email/phone), and last-7-day completed tickets → this
// week's Business Health, bucketed per Heartland location (each maps to a Wingman
// location by name, else org-wide). Guards everything — a failure records
// last_sync_status = 'error: ...' and never throws.
export async function syncHeartland(orgId: string, host: string): Promise<{ guests: number; salesCents: number; error: string | null }> {
  const admin = createAdminClient();
  const now = Date.now();

  // Token is read ONLY here, via the service-role client. Never leaves the server.
  const { data: connRow } = await admin
    .from("heartland_retail_connections")
    .select("org_id, account_host, account_name, access_token")
    .eq("org_id", orgId)
    .eq("account_host", host)
    .maybeSingle();
  const conn = connRow as Conn | null;
  if (!conn) return { guests: 0, salesCents: 0, error: "Not connected to Heartland Retail." };

  try {
    const token = conn.access_token;

    // Existing guest keys (dedupe across the whole org).
    const { data: existing } = await admin.from("guests").select("email, phone").eq("org_id", orgId);
    const seenEmail = new Set<string>();
    const seenPhone = new Set<string>();
    for (const g of (existing ?? []) as { email: string; phone: string }[]) {
      if (g.email) seenEmail.add(g.email.toLowerCase());
      if (g.phone) seenPhone.add(g.phone.replace(/\D/g, ""));
    }

    // Wingman locations by name, for per-location mapping.
    const { data: wLocs } = await admin.from("locations").select("id, name").eq("org_id", orgId);
    const nameToId = new Map<string, string>();
    for (const l of (wLocs ?? []) as { id: string; name: string }[]) nameToId.set(l.name.trim().toLowerCase(), l.id);

    // Heartland location id → Wingman location id (via matching names).
    const hLocs = await fetchAll<HeartlandLocation>(host, token, "/api/locations");
    const heartlandLocToWingman = new Map<string, string>();
    for (const hl of hLocs) {
      const wId = nameToId.get((hl.name ?? "").trim().toLowerCase());
      if (wId && hl.id != null) heartlandLocToWingman.set(String(hl.id), wId);
    }

    // --- Customers -> guests (new + deduped) ---
    const newGuests: { org_id: string; name: string; email: string; phone: string; source: string }[] = [];
    let guestsFound = 0;
    const customers = await fetchAll<HeartlandCustomer>(host, token, "/api/customers");
    for (const c of customers) {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
      const email = (c.email ?? "").trim();
      const phone = (c.phone ?? "").trim();
      if (!name && !email && !phone) continue;
      const emailKey = email.toLowerCase();
      const phoneKey = phone.replace(/\D/g, "");
      if ((emailKey && seenEmail.has(emailKey)) || (phoneKey && seenPhone.has(phoneKey))) continue;
      if (emailKey) seenEmail.add(emailKey);
      if (phoneKey) seenPhone.add(phoneKey);
      newGuests.push({ org_id: orgId, name: name || email || phone, email, phone, source: "heartland" });
      guestsFound++;
      if (newGuests.length >= MAX_GUESTS) break;
    }

    // --- Completed tickets (last 7 days) -> sales, bucketed per location ---
    const beginIso = new Date(now - 7 * 86400000).toISOString();
    const buckets = new Map<string, { sales: number; checks: number }>(); // key: wingman location_id or "" (org-wide)
    let totalSalesCents = 0;
    const tickets = await fetchAll<HeartlandTicket>(host, token, "/api/sales/tickets", {
      // Advanced filter: only tickets completed since the window start. Harmless
      // if the account ignores it (we still gate on status/completed_at below).
      params: { "~[completed_at][$gte]": beginIso },
    });
    for (const t of tickets) {
      if (t.status !== "complete") continue;
      const total = Number(t.total ?? 0);
      if (!Number.isFinite(total) || total <= 0) continue;
      const cents = Math.round(total * 100);
      totalSalesCents += cents;
      const target = t.source_location_id != null ? (heartlandLocToWingman.get(String(t.source_location_id)) ?? "") : "";
      const b = buckets.get(target) ?? { sales: 0, checks: 0 };
      b.sales += cents;
      b.checks++;
      buckets.set(target, b);
    }

    // Insert new guests (bounded).
    let importedGuests = 0;
    if (newGuests.length > 0) {
      const { error } = await admin.from("guests").insert(newGuests.slice(0, MAX_GUESTS));
      if (!error) importedGuests = Math.min(newGuests.length, MAX_GUESTS);
    }

    // Upsert one weekly Business Health row per location bucket. Only touch
    // sales/checks so manually entered labor for the week is preserved.
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
      .from("heartland_retail_connections")
      .update({ last_sync_at: new Date(now).toISOString(), last_sync_status: "ok", last_sync_guests: guestsFound, last_sync_sales_cents: totalSalesCents })
      .eq("org_id", orgId)
      .eq("account_host", host);

    return { guests: importedGuests, salesCents: totalSalesCents, error: null };
  } catch (e) {
    const msg = String(e).slice(0, 200);
    await admin
      .from("heartland_retail_connections")
      .update({ last_sync_at: new Date(now).toISOString(), last_sync_status: `error: ${msg}` })
      .eq("org_id", orgId)
      .eq("account_host", host);
    return { guests: 0, salesCents: 0, error: msg };
  }
}
