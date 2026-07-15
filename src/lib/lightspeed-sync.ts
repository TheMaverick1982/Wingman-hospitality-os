import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lightspeedGet, refreshLightspeedToken } from "@/lib/lightspeed";

type Conn = {
  org_id: string;
  account_id: string;
  account_name: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
};

// Endpoint paths differ between Lightspeed products (Retail vs Restaurant), so
// they're env-overridable. {account} is substituted with the connected account
// id. Defaults target Lightspeed Retail's API shape.
const CUSTOMERS_PATH = process.env.LIGHTSPEED_CUSTOMERS_PATH ?? "/API/V3/Account/{account}/Customer.json";
const SALES_PATH = process.env.LIGHTSPEED_SALES_PATH ?? "/API/V3/Account/{account}/Sale.json";

function weekStartMonday(nowMs: number): string {
  const d = new Date(nowMs);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

const MAX_GUESTS = 500;

async function freshToken(admin: ReturnType<typeof createAdminClient>, conn: Conn): Promise<string> {
  const exp = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (exp && exp - Date.now() > 5 * 60000) return conn.access_token; // >5 min left
  if (!conn.refresh_token) return conn.access_token;
  const t = await refreshLightspeedToken(conn.refresh_token);
  if (t.access_token) {
    await admin
      .from("lightspeed_connections")
      .update({ access_token: t.access_token, refresh_token: t.refresh_token, token_expires_at: t.access_expires_at })
      .eq("org_id", conn.org_id)
      .eq("account_id", conn.account_id);
    return t.access_token;
  }
  return conn.access_token;
}

// Defensive extraction — Lightspeed shapes vary by product/version.
function pickEmail(c: Record<string, unknown>): string {
  const contact = (c.Contact ?? {}) as Record<string, unknown>;
  const emails = (contact.Emails ?? {}) as Record<string, unknown>;
  const e = emails.ContactEmail as { address?: string } | { address?: string }[] | undefined;
  const first = Array.isArray(e) ? e[0] : e;
  return (first?.address ?? (c.email as string) ?? "").toString().trim();
}
function pickPhone(c: Record<string, unknown>): string {
  const contact = (c.Contact ?? {}) as Record<string, unknown>;
  const phones = (contact.Phones ?? {}) as Record<string, unknown>;
  const p = phones.ContactPhone as { number?: string } | { number?: string }[] | undefined;
  const first = Array.isArray(p) ? p[0] : p;
  return (first?.number ?? (c.phone as string) ?? "").toString().trim();
}
function pickName(c: Record<string, unknown>): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
}
function asArray<T = Record<string, unknown>>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") return [v as T];
  return [];
}

// Sync every Lightspeed account connected to this org: customers → Guests (new
// only, deduped), and last-7-day sales → this week's Business Health, per
// account (mapped to a Wingman location by name, else org-wide).
export async function syncLightspeedOrg(orgId: string): Promise<{ guests: number; salesCents: number; error: string | null }> {
  const admin = createAdminClient();
  const { data: connRows } = await admin
    .from("lightspeed_connections")
    .select("org_id, account_id, account_name, access_token, refresh_token, token_expires_at")
    .eq("org_id", orgId);
  const conns = (connRows ?? []) as Conn[];
  if (conns.length === 0) return { guests: 0, salesCents: 0, error: "Not connected to Lightspeed." };

  const now = Date.now();

  const { data: existing } = await admin.from("guests").select("email, phone").eq("org_id", orgId);
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();
  for (const g of (existing ?? []) as { email: string; phone: string }[]) {
    if (g.email) seenEmail.add(g.email.toLowerCase());
    if (g.phone) seenPhone.add(g.phone.replace(/\D/g, ""));
  }

  const { data: wLocs } = await admin.from("locations").select("id, name").eq("org_id", orgId);
  const nameToId = new Map<string, string>();
  for (const l of (wLocs ?? []) as { id: string; name: string }[]) nameToId.set(l.name.trim().toLowerCase(), l.id);

  const newGuests: { org_id: string; name: string; email: string; phone: string; source: string }[] = [];
  const buckets = new Map<string, { sales: number; checks: number }>();
  let totalSalesCents = 0;
  const beginIso = new Date(now - 7 * 86400000).toISOString();
  let firstError: string | null = null;

  for (const conn of conns) {
    let acctSalesCents = 0;
    let acctChecks = 0;
    let acctGuests = 0;
    try {
      const token = await freshToken(admin, conn);
      const customersPath = CUSTOMERS_PATH.replace("{account}", conn.account_id);
      const salesPath = SALES_PATH.replace("{account}", conn.account_id);

      // --- Customers -> guests ---
      const custResp = await lightspeedGet<Record<string, unknown>>(customersPath, token, { limit: "100" });
      for (const c of asArray(custResp.Customer ?? custResp.customers ?? custResp.data)) {
        const rec = c as Record<string, unknown>;
        const name = pickName(rec);
        const email = pickEmail(rec);
        const phone = pickPhone(rec);
        if (!name && !email && !phone) continue;
        const emailKey = email.toLowerCase();
        const phoneKey = phone.replace(/\D/g, "");
        if ((emailKey && seenEmail.has(emailKey)) || (phoneKey && seenPhone.has(phoneKey))) continue;
        if (emailKey) seenEmail.add(emailKey);
        if (phoneKey) seenPhone.add(phoneKey);
        newGuests.push({ org_id: orgId, name: name || email || phone, email, phone, source: "lightspeed" });
        acctGuests++;
        if (newGuests.length >= MAX_GUESTS) break;
      }

      // --- Sales (last 7 days) -> sales ---
      const salesResp = await lightspeedGet<Record<string, unknown>>(salesPath, token, {
        limit: "100",
        // Many Lightspeed endpoints accept a time filter; harmless if ignored.
        timeStamp: `>,${beginIso}`,
      });
      for (const s of asArray(salesResp.Sale ?? salesResp.sales ?? salesResp.data)) {
        const rec = s as Record<string, unknown>;
        const total = Number(rec.total ?? rec.totalAmount ?? rec.calcTotal ?? 0);
        if (!Number.isFinite(total) || total <= 0) continue;
        acctSalesCents += Math.round(total * 100);
        acctChecks++;
      }

      totalSalesCents += acctSalesCents;
      const target = nameToId.get((conn.account_name ?? "").trim().toLowerCase()) ?? "";
      const b = buckets.get(target) ?? { sales: 0, checks: 0 };
      b.sales += acctSalesCents;
      b.checks += acctChecks;
      buckets.set(target, b);

      await admin
        .from("lightspeed_connections")
        .update({ last_sync_at: new Date(now).toISOString(), last_sync_status: "ok", last_sync_guests: acctGuests, last_sync_sales_cents: acctSalesCents })
        .eq("org_id", orgId)
        .eq("account_id", conn.account_id);
    } catch (e) {
      const msg = String(e).slice(0, 200);
      firstError ??= msg;
      await admin
        .from("lightspeed_connections")
        .update({ last_sync_at: new Date(now).toISOString(), last_sync_status: `error: ${msg}` })
        .eq("org_id", orgId)
        .eq("account_id", conn.account_id);
    }
  }

  let importedGuests = 0;
  if (newGuests.length > 0) {
    const { error } = await admin.from("guests").insert(newGuests.slice(0, MAX_GUESTS));
    if (!error) importedGuests = Math.min(newGuests.length, MAX_GUESTS);
  }

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
