import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { cloverGet, refreshCloverToken } from "@/lib/clover";

type Conn = {
  org_id: string;
  merchant_id: string;
  merchant_name: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
};

// Monday (UTC) of the week containing nowMs, as YYYY-MM-DD.
function weekStartMonday(nowMs: number): string {
  const d = new Date(nowMs);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

const MAX_GUESTS = 500;

// Clover access tokens are short-lived (~30 min), so we refresh on nearly every
// run. The refresh token rotates — persist the new pair before using it.
async function freshToken(admin: ReturnType<typeof createAdminClient>, conn: Conn): Promise<string> {
  const exp = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (exp && exp - Date.now() > 5 * 60000) return conn.access_token; // >5 min left
  if (!conn.refresh_token) return conn.access_token;
  const t = await refreshCloverToken(conn.refresh_token);
  if (t.access_token) {
    await admin
      .from("clover_connections")
      .update({ access_token: t.access_token, refresh_token: t.refresh_token, token_expires_at: t.access_expires_at, refresh_expires_at: t.refresh_expires_at })
      .eq("org_id", conn.org_id)
      .eq("merchant_id", conn.merchant_id);
    return t.access_token;
  }
  return conn.access_token;
}

type CloverCustomer = {
  firstName?: string;
  lastName?: string;
  emailAddresses?: { elements?: { emailAddress?: string }[] };
  phoneNumbers?: { elements?: { phoneNumber?: string }[] };
};
type CloverPayment = { amount?: number; result?: string; createdTime?: number };

// Sync every Clover store connected to this org: customers → Guests (new only,
// deduped), and last-7-day payments → this week's Business Health, per store
// (each Clover merchant maps to a Wingman location by name, else org-wide).
export async function syncCloverOrg(orgId: string): Promise<{ guests: number; salesCents: number; error: string | null }> {
  const admin = createAdminClient();
  const { data: connRows } = await admin
    .from("clover_connections")
    .select("org_id, merchant_id, merchant_name, access_token, refresh_token, token_expires_at")
    .eq("org_id", orgId);
  const conns = (connRows ?? []) as Conn[];
  if (conns.length === 0) return { guests: 0, salesCents: 0, error: "Not connected to Clover." };

  const now = Date.now();

  // Existing guest keys (dedupe across all stores).
  const { data: existing } = await admin.from("guests").select("email, phone").eq("org_id", orgId);
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();
  for (const g of (existing ?? []) as { email: string; phone: string }[]) {
    if (g.email) seenEmail.add(g.email.toLowerCase());
    if (g.phone) seenPhone.add(g.phone.replace(/\D/g, ""));
  }

  // Wingman locations by name, for per-store mapping.
  const { data: wLocs } = await admin.from("locations").select("id, name").eq("org_id", orgId);
  const nameToId = new Map<string, string>();
  for (const l of (wLocs ?? []) as { id: string; name: string }[]) nameToId.set(l.name.trim().toLowerCase(), l.id);

  const newGuests: { org_id: string; name: string; email: string; phone: string; source: string }[] = [];
  const buckets = new Map<string, { sales: number; checks: number }>(); // key: wingman location_id or "" (org-wide)
  let totalSalesCents = 0;
  const beginMs = now - 7 * 86400000;
  let firstError: string | null = null;

  for (const conn of conns) {
    let merchantSales = 0;
    let merchantChecks = 0;
    let merchantGuests = 0;
    try {
      const token = await freshToken(admin, conn);

      // --- Customers -> guests ---
      let offset = 0;
      let pages = 0;
      for (;;) {
        const page = await cloverGet<{ elements?: CloverCustomer[] }>(`/v3/merchants/${conn.merchant_id}/customers`, token, {
          limit: "100",
          offset: String(offset),
          expand: "emailAddresses,phoneNumbers",
        });
        const els = page.elements ?? [];
        for (const c of els) {
          const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
          const email = (c.emailAddresses?.elements?.[0]?.emailAddress ?? "").trim();
          const phone = (c.phoneNumbers?.elements?.[0]?.phoneNumber ?? "").trim();
          if (!name && !email && !phone) continue;
          const emailKey = email.toLowerCase();
          const phoneKey = phone.replace(/\D/g, "");
          if ((emailKey && seenEmail.has(emailKey)) || (phoneKey && seenPhone.has(phoneKey))) continue;
          if (emailKey) seenEmail.add(emailKey);
          if (phoneKey) seenPhone.add(phoneKey);
          newGuests.push({ org_id: orgId, name: name || email || phone, email, phone, source: "clover" });
          merchantGuests++;
          if (newGuests.length >= MAX_GUESTS) break;
        }
        offset += els.length;
        pages++;
        if (els.length < 100 || newGuests.length >= MAX_GUESTS || pages >= 10) break;
      }

      // --- Payments (last 7 days) -> sales ---
      let poffset = 0;
      let ppages = 0;
      for (;;) {
        const page = await cloverGet<{ elements?: CloverPayment[] }>(`/v3/merchants/${conn.merchant_id}/payments`, token, {
          filter: `createdTime>=${beginMs}`,
          limit: "100",
          offset: String(poffset),
        });
        const els = page.elements ?? [];
        for (const p of els) {
          if (p.result && p.result !== "SUCCESS") continue;
          merchantSales += p.amount ?? 0;
          merchantChecks++;
        }
        poffset += els.length;
        ppages++;
        if (els.length < 100 || ppages >= 20) break;
      }

      totalSalesCents += merchantSales;
      const target = nameToId.get((conn.merchant_name ?? "").trim().toLowerCase()) ?? "";
      const b = buckets.get(target) ?? { sales: 0, checks: 0 };
      b.sales += merchantSales;
      b.checks += merchantChecks;
      buckets.set(target, b);

      await admin
        .from("clover_connections")
        .update({ last_sync_at: new Date(now).toISOString(), last_sync_status: "ok", last_sync_guests: merchantGuests, last_sync_sales_cents: merchantSales })
        .eq("org_id", orgId)
        .eq("merchant_id", conn.merchant_id);
    } catch (e) {
      const msg = String(e).slice(0, 200);
      firstError ??= msg;
      await admin
        .from("clover_connections")
        .update({ last_sync_at: new Date(now).toISOString(), last_sync_status: `error: ${msg}` })
        .eq("org_id", orgId)
        .eq("merchant_id", conn.merchant_id);
    }
  }

  // Insert new guests (bounded).
  let importedGuests = 0;
  if (newGuests.length > 0) {
    const { error } = await admin.from("guests").insert(newGuests);
    if (!error) importedGuests = newGuests.length;
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

  return { guests: importedGuests, salesCents: totalSalesCents, error: firstError };
}
