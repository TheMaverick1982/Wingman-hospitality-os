import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectiveMonthlyCents } from "@/lib/pricing";
import { markActive, markPastDue } from "@/lib/billing";
import { gpConfigured, gpChargeStored, GP_ENV } from "@/lib/global-payments";

// Recurring subscription charges (Global Payments). Runs daily and charges every
// org whose billing period has ended and that has a stored card. On approval it
// advances the period + sends a receipt (markActive); on decline it drops to
// past_due so the dunning cron takes over. Free accounts and orgs without a card
// are skipped. Provider-agnostic downstream: the webhook path stays valid too.
//
// Idempotency: current_period_end is only advanced on a successful charge, and
// we require it to be in the past, so a re-run the same day won't double-charge
// an org that already succeeded (its period is now a month out).
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!gpConfigured()) return NextResponse.json({ skipped: "global-payments-not-configured" });

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Cards on file, joined with their org's billing state. Only active/past_due
  // orgs with a due (or unset) period are charged.
  const { data: cards, error } = await admin
    .from("billing_payment_methods")
    .select("org_id, payment_token");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: string[] = [];
  for (const row of (cards ?? []) as { org_id: string; payment_token: string }[]) {
    const orgId = row.org_id;
    try {
      const { data: orgRow } = await admin
        .from("organizations")
        .select("name, is_free_account, billing_status, current_period_end, custom_monthly_cents, custom_addl_location_cents, plan_first_cents, plan_addl_cents, billed_by_group")
        .eq("id", orgId)
        .maybeSingle();
      const org = orgRow as
        | {
            name: string;
            is_free_account: boolean;
            billing_status: string;
            current_period_end: string | null;
            custom_monthly_cents: number | null;
            custom_addl_location_cents: number | null;
            plan_first_cents: number | null;
            plan_addl_cents: number | null;
            billed_by_group: boolean;
          }
        | null;
      if (!org || org.is_free_account) { results.push(`skip-free:${orgId}`); continue; }
      // Covered by a central franchise group — charged as part of the group roll-up, not individually.
      if (org.billed_by_group) { results.push(`skip-group:${orgId}`); continue; }
      if (org.billing_status === "canceled") { results.push(`skip-canceled:${orgId}`); continue; }
      // Not due yet.
      if (org.current_period_end && org.current_period_end > nowIso) { results.push(`not-due:${orgId}`); continue; }

      const { count } = await admin.from("locations").select("id", { count: "exact", head: true }).eq("org_id", orgId);
      const amountCents = await effectiveMonthlyCents(org, count ?? 1);
      if (!amountCents || amountCents <= 0) { results.push(`skip-zero:${orgId}`); continue; }

      const reference = `WM-${orgId.slice(0, 8)}-${nowIso.slice(0, 10)}`;
      const result = await gpChargeStored({ token: row.payment_token, amountCents, reference });
      await admin.from("billing_charges").insert({
        org_id: orgId,
        provider: "global_payments",
        environment: GP_ENV,
        transaction_id: result.transactionId || null,
        amount_cents: amountCents,
        status: result.status,
        approved: result.approved,
        reference,
      });

      if (result.approved) {
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await markActive(
          admin,
          orgId,
          { brand: result.brand ?? undefined, last4: result.last4 ?? undefined, periodEnd: periodEnd.toISOString() },
          { amountCents, invoiceNumber: result.transactionId || reference, paidAtIso: nowIso },
        );
        results.push(`charged:${orgId}`);
      } else {
        await markPastDue(admin, orgId, org.name);
        results.push(`declined:${orgId}`);
      }
    } catch (e) {
      try {
        await admin.from("billing_charges").insert({
          org_id: orgId,
          provider: "global_payments",
          environment: GP_ENV,
          amount_cents: 0,
          status: "ERROR",
          approved: false,
          error: e instanceof Error ? e.message.slice(0, 500) : "unknown",
        });
      } catch {
        /* logging the failure is best-effort */
      }
      results.push(`error:${orgId}`);
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
