import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { toastGet, TOAST_ORDERS_FULL_PATH } from "@/lib/toast";

type Conn = {
  org_id: string;
  restaurant_guid: string;
  restaurant_name: string;
};

// Monday (UTC) of the week containing nowMs, as YYYY-MM-DD.
function weekStartMonday(nowMs: number): string {
  const d = new Date(nowMs);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

const MAX_GUESTS = 500;

// Toast order shapes (defensive — only the fields we read). Amounts on Toast are
// decimal dollars.
type ToastCustomer = { firstName?: string; lastName?: string; email?: string; phone?: string };
type ToastCheck = { customer?: ToastCustomer; totalAmount?: number; amount?: number };
type ToastOrder = { checks?: ToastCheck[]; voided?: boolean };

// Sync every Toast restaurant connected to this org: check customers → Guests
// (new only, deduped), and last-7-day check totals → this week's Business
// Health, per restaurant (each restaurant maps to a Wingman location by name,
// else org-wide).
export async function syncToastOrg(orgId: string): Promise<{ guests: number; salesCents: number; error: string | null }> {
  const admin = createAdminClient();
  const { data: connRows } = await admin
    .from("toast_connections")
    .select("org_id, restaurant_guid, restaurant_name")
    .eq("org_id", orgId);
  const conns = (connRows ?? []) as Conn[];
  if (conns.length === 0) return { guests: 0, salesCents: 0, error: "Not connected to Toast." };

  const now = Date.now();

  // Existing guest keys (dedupe across all restaurants).
  const { data: existing } = await admin.from("guests").select("email, phone").eq("org_id", orgId);
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();
  for (const g of (existing ?? []) as { email: string; phone: string }[]) {
    if (g.email) seenEmail.add(g.email.toLowerCase());
    if (g.phone) seenPhone.add(g.phone.replace(/\D/g, ""));
  }

  // Wingman locations by name, for per-restaurant mapping.
  const { data: wLocs } = await admin.from("locations").select("id, name").eq("org_id", orgId);
  const nameToId = new Map<string, string>();
  for (const l of (wLocs ?? []) as { id: string; name: string }[]) nameToId.set(l.name.trim().toLowerCase(), l.id);

  const newGuests: { org_id: string; name: string; email: string; phone: string; source: string }[] = [];
  const buckets = new Map<string, { sales: number; checks: number }>(); // key: wingman location_id or "" (org-wide)
  let totalSalesCents = 0;
  const beginIso = new Date(now - 7 * 86400000).toISOString();
  const endIso = new Date(now).toISOString();
  let firstError: string | null = null;

  for (const conn of conns) {
    let restSalesCents = 0;
    let restChecks = 0;
    let restGuests = 0;
    try {
      let page = 1;
      for (;;) {
        const orders = await toastGet<ToastOrder[]>(TOAST_ORDERS_FULL_PATH, conn.restaurant_guid, {
          startDate: beginIso,
          endDate: endIso,
          pageSize: "100",
          page: String(page),
        });
        const list = Array.isArray(orders) ? orders : [];
        for (const o of list) {
          if (o.voided) continue;
          for (const chk of o.checks ?? []) {
            // Sales (decimal dollars → cents).
            const amt = chk.totalAmount ?? chk.amount ?? 0;
            if (amt > 0) {
              restSalesCents += Math.round(amt * 100);
              restChecks++;
            }
            // Customer → guest (new + deduped).
            const c = chk.customer;
            if (!c) continue;
            const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
            const email = (c.email ?? "").trim();
            const phone = (c.phone ?? "").trim();
            if (!name && !email && !phone) continue;
            const emailKey = email.toLowerCase();
            const phoneKey = phone.replace(/\D/g, "");
            if ((emailKey && seenEmail.has(emailKey)) || (phoneKey && seenPhone.has(phoneKey))) continue;
            if (emailKey) seenEmail.add(emailKey);
            if (phoneKey) seenPhone.add(phoneKey);
            newGuests.push({ org_id: orgId, name: name || email || phone, email, phone, source: "toast" });
            restGuests++;
          }
        }
        page++;
        if (list.length < 100 || newGuests.length >= MAX_GUESTS || page > 20) break;
      }

      totalSalesCents += restSalesCents;
      const target = nameToId.get((conn.restaurant_name ?? "").trim().toLowerCase()) ?? "";
      const b = buckets.get(target) ?? { sales: 0, checks: 0 };
      b.sales += restSalesCents;
      b.checks += restChecks;
      buckets.set(target, b);

      await admin
        .from("toast_connections")
        .update({ last_sync_at: new Date(now).toISOString(), last_sync_status: "ok", last_sync_guests: restGuests, last_sync_sales_cents: restSalesCents })
        .eq("org_id", orgId)
        .eq("restaurant_guid", conn.restaurant_guid);
    } catch (e) {
      const msg = String(e).slice(0, 200);
      firstError ??= msg;
      await admin
        .from("toast_connections")
        .update({ last_sync_at: new Date(now).toISOString(), last_sync_status: `error: ${msg}` })
        .eq("org_id", orgId)
        .eq("restaurant_guid", conn.restaurant_guid);
    }
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

  return { guests: importedGuests, salesCents: totalSalesCents, error: firstError };
}
