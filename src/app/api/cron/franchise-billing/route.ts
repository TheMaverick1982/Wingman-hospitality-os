import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGroupBillingSummary } from "@/lib/franchise-billing";
import { getOrgOwnerEmails } from "@/lib/billing";
import { gpConfigured, gpChargeStored, GP_ENV } from "@/lib/global-payments";
import { sendEmail } from "@/lib/email";

// Monthly roll-up charge for CENTRAL franchise groups: the sum of every
// franchisee's effective price, billed once to the group's card (on the owner's
// org). Distributed groups are untouched (each franchisee pays their own via the
// normal per-org billing). Runs daily but dedupes to one charge per group per
// calendar month via the reference.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!gpConfigured()) return NextResponse.json({ skipped: "global-payments-not-configured" });

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const month = nowIso.slice(0, 7); // YYYY-MM

  const { data: groups } = await admin.from("franchise_groups").select("id, name").eq("billing_mode", "central");
  const results: string[] = [];

  for (const g of (groups ?? []) as { id: string; name: string }[]) {
    try {
      const summary = await getGroupBillingSummary(g.id);
      if (!summary || summary.totalMonthlyCents <= 0) { results.push(`skip-zero:${g.id}`); continue; }
      if (!summary.ownerOrgId || !summary.ownerHasCard) { results.push(`no-card:${g.id}`); continue; }

      const reference = `FRAN-${g.id.slice(0, 8)}-${month}`;
      // Dedupe: already charged this month?
      const { data: existing } = await admin
        .from("billing_charges")
        .select("id")
        .eq("org_id", summary.ownerOrgId)
        .eq("reference", reference)
        .eq("approved", true)
        .maybeSingle();
      if (existing) { results.push(`already:${g.id}`); continue; }

      const { data: pm } = await admin.from("billing_payment_methods").select("payment_token").eq("org_id", summary.ownerOrgId).maybeSingle();
      const token = (pm as { payment_token?: string } | null)?.payment_token;
      if (!token) { results.push(`no-card:${g.id}`); continue; }

      const result = await gpChargeStored({ token, amountCents: summary.totalMonthlyCents, reference });
      await admin.from("billing_charges").insert({
        org_id: summary.ownerOrgId,
        provider: "global_payments",
        environment: GP_ENV,
        transaction_id: result.transactionId || null,
        amount_cents: summary.totalMonthlyCents,
        status: result.status,
        approved: result.approved,
        reference,
      });

      if (result.approved) {
        const emails = await getOrgOwnerEmails(admin, summary.ownerOrgId);
        if (emails.length) {
          await sendEmail({
            to: emails,
            subject: `Wingman franchise receipt — $${(summary.totalMonthlyCents / 100).toFixed(2)} for ${g.name}`,
            html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:520px;"><h2 style="font-size:20px;">Franchise payment received</h2><p style="font-size:15px;line-height:1.55;color:#525252;">Your monthly franchise charge for <strong>${g.name}</strong> covering <strong>${summary.members.length}</strong> location${summary.members.length === 1 ? "" : "s"} has been processed: <strong>$${(summary.totalMonthlyCents / 100).toFixed(2)}</strong>. Thank you.</p></div>`,
          }).catch(() => {});
        }
        results.push(`charged:${g.id}`);
      } else {
        results.push(`declined:${g.id}`);
      }
    } catch (e) {
      results.push(`error:${g.id}:${e instanceof Error ? e.message.slice(0, 60) : ""}`);
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
