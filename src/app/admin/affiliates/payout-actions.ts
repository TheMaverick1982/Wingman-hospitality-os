"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { getAffiliateSettings } from "@/lib/affiliate";
import { createPayout, getPayoutStatus, paypalConfigured } from "@/lib/paypal";

export type PayoutActionState = { error: string | null };

const GOOD = new Set(["SUCCESS", "UNCLAIMED"]);
const BAD = new Set(["FAILED", "RETURNED", "BLOCKED", "REFUNDED", "REVERSED", "DENIED"]);

// Send an affiliate their owed (approved, unpaid) commissions via PayPal. This
// is the manual "send" gate — nothing goes out without this call.
export async function runPayout(affiliateId: string): Promise<PayoutActionState> {
  const me = await platformSectionActor("affiliates");
  if (!me) return { error: "Not authorized." };
  if (!paypalConfigured()) return { error: "PayPal isn't configured (set PAYPAL_CLIENT_ID/SECRET in Vercel)." };

  const admin = createAdminClient();
  const { data: aff } = await admin
    .from("affiliates")
    .select("status, paypal_email, full_name")
    .eq("id", affiliateId)
    .maybeSingle();
  const a = aff as { status: string; paypal_email: string | null; full_name: string } | null;
  if (!a) return { error: "Affiliate not found." };
  if (a.status !== "approved") return { error: "Affiliate isn't active." };
  if (!a.paypal_email) return { error: "This affiliate hasn't added a PayPal email yet." };

  // Approved, not-yet-paid commissions.
  const { data: comms } = await admin
    .from("affiliate_commissions")
    .select("id, amount_cents")
    .eq("affiliate_id", affiliateId)
    .eq("status", "approved")
    .is("payout_id", null);
  const rows = (comms ?? []) as { id: string; amount_cents: number }[];
  const total = rows.reduce((t, r) => t + r.amount_cents, 0);
  const ids = rows.map((r) => r.id);

  const settings = await getAffiliateSettings(admin);
  if (total < settings.min_payout_cents) {
    return { error: `Balance ($${(total / 100).toFixed(2)}) is below the $${(settings.min_payout_cents / 100).toFixed(0)} minimum.` };
  }

  // Create the payout record first, so its id is the idempotency key.
  const { data: payout, error: payErr } = await admin
    .from("affiliate_payouts")
    .insert({ affiliate_id: affiliateId, amount_cents: total, paypal_email: a.paypal_email, status: "processing", created_by: me.userId })
    .select("id")
    .single();
  if (payErr || !payout) return { error: payErr?.message ?? "Couldn't create the payout." };
  const payoutId = (payout as { id: string }).id;

  try {
    const { batchId } = await createPayout({
      senderBatchId: payoutId,
      receiverEmail: a.paypal_email,
      amountCents: total,
      note: `Wingman affiliate commission for ${a.full_name || a.paypal_email}`,
    });
    // Allocate the commissions to this payout and mark them paid (optimistic;
    // a failed/returned payout reverts them via syncPayoutStatus).
    await admin
      .from("affiliate_commissions")
      .update({ status: "paid", paid_at: new Date().toISOString(), payout_id: payoutId })
      .in("id", ids);
    await admin.from("affiliate_payouts").update({ paypal_batch_id: batchId }).eq("id", payoutId);
  } catch (err) {
    await admin
      .from("affiliate_payouts")
      .update({ status: "failed", error: err instanceof Error ? err.message : "PayPal error", completed_at: new Date().toISOString() })
      .eq("id", payoutId);
    return { error: err instanceof Error ? err.message : "PayPal payout failed." };
  }

  revalidatePath("/admin/affiliates");
  return { error: null };
}

// Reconcile a payout against PayPal. On terminal failure, revert its
// commissions to "approved" so they can be paid again.
export async function syncPayoutStatus(payoutId: string): Promise<PayoutActionState> {
  const me = await platformSectionActor("affiliates");
  if (!me) return { error: "Not authorized." };

  const admin = createAdminClient();
  const { data: payout } = await admin
    .from("affiliate_payouts")
    .select("id, status, paypal_batch_id")
    .eq("id", payoutId)
    .maybeSingle();
  const p = payout as { id: string; status: string; paypal_batch_id: string | null } | null;
  if (!p) return { error: "Payout not found." };
  if (p.status !== "processing") return { error: null };
  if (!p.paypal_batch_id) return { error: "No PayPal batch to check yet." };

  let state;
  try {
    state = await getPayoutStatus(p.paypal_batch_id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Status check failed." };
  }

  const item = state.itemStatus ?? "";
  if (GOOD.has(item)) {
    await admin.from("affiliate_payouts").update({ status: "success", completed_at: new Date().toISOString() }).eq("id", payoutId);
  } else if (BAD.has(item)) {
    await admin.from("affiliate_payouts").update({ status: "failed", error: `PayPal item ${item}`, completed_at: new Date().toISOString() }).eq("id", payoutId);
    // Return the money to "owed" so it can be re-paid.
    await admin
      .from("affiliate_commissions")
      .update({ status: "approved", paid_at: null, payout_id: null })
      .eq("payout_id", payoutId);
  }
  // else: still processing — leave as-is.

  revalidatePath("/admin/affiliates");
  return { error: null };
}
