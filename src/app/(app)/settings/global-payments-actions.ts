"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { effectiveMonthlyCents } from "@/lib/pricing";
import { markActive, markPastDue } from "@/lib/billing";
import {
  gpConfigured,
  gpIsSandbox,
  GP_ENV,
  gpStoreTestCard,
  gpStoreCardFromSingleUseToken,
  gpChargeStored,
  gpDeleteStoredCard,
  type StoredCard,
} from "@/lib/global-payments";

async function owner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return null;
  return profile;
}

// Persist a freshly-stored GP token as the org's card on file. Mirrors the
// display bits onto organizations.card_brand/last4 so the existing billing UI
// ("card on file") reflects it. The secret token lives only in the deny-all
// billing_payment_methods table.
async function persistCard(orgId: string, userId: string, card: StoredCard) {
  const admin = createAdminClient();
  await admin.from("billing_payment_methods").upsert(
    {
      org_id: orgId,
      provider: "global_payments",
      environment: GP_ENV,
      payment_token: card.token,
      card_brand: card.brand,
      card_last4: card.last4,
      card_exp_month: card.expMonth,
      card_exp_year: card.expYear,
      connected_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );
  await admin
    .from("organizations")
    .update({ card_brand: card.brand ?? "Card", card_last4: card.last4 })
    .eq("id", orgId);
}

// SANDBOX validation: store one of GP's published test cards as the org's card
// on file, exercising the real /payment-methods endpoint end-to-end. This is
// the billing equivalent of the Square "test with sandbox token" path — it
// proves the store→charge loop before a live card capture is wired.
export async function saveTestCard(
  _prev: { error: string | null; ok?: boolean },
  formData: FormData,
): Promise<{ error: string | null; ok?: boolean }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can manage billing." };
  if (!gpConfigured()) return { error: "Global Payments isn't configured yet (missing GP_APP_ID / GP_APP_KEY)." };
  if (!gpIsSandbox()) return { error: "Test cards can only be saved in the sandbox environment." };

  const number = String(formData.get("number") ?? "").replace(/\s+/g, "");
  const exp = String(formData.get("exp") ?? "").trim(); // MM/YY
  const cvv = String(formData.get("cvv") ?? "").trim();
  const m = exp.match(/^(\d{1,2})\s*\/\s*(\d{2,4})$/);
  if (!number || !m) return { error: "Enter a test card number and expiry as MM/YY." };
  const expMonth = Number(m[1]);
  const expYear = Number(m[2].length === 2 ? `20${m[2]}` : m[2]);

  try {
    const card = await gpStoreTestCard({
      number,
      expMonth,
      expYear,
      cvv: cvv || undefined,
      name: profile.fullName ?? undefined,
      reference: profile.orgId,
    });
    await persistCard(profile.orgId, profile.userId, card);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not store the card." };
  }
  revalidatePath("/settings");
  return { error: null, ok: true };
}

// PRODUCTION path: store a card from a browser single-use token (hosted fields).
// The raw PAN never reaches our servers. Called by the client card form once the
// hosted-fields library returns a single-use token.
export async function saveCardFromToken(singleUseToken: string): Promise<{ error: string | null; ok?: boolean }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can manage billing." };
  if (!gpConfigured()) return { error: "Global Payments isn't configured yet." };
  if (!singleUseToken) return { error: "Missing card token." };
  try {
    const card = await gpStoreCardFromSingleUseToken(singleUseToken, profile.orgId);
    await persistCard(profile.orgId, profile.userId, card);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not store the card." };
  }
  revalidatePath("/settings");
  return { error: null, ok: true };
}

// Run a real charge against the stored card for this org's monthly amount. In
// sandbox this validates the whole billing pipeline: charge → receipt → active.
export async function chargeNow(): Promise<{ error: string | null; ok?: boolean; amountCents?: number; status?: string }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can run a charge." };
  const admin = createAdminClient();

  const { data: pm } = await admin
    .from("billing_payment_methods")
    .select("payment_token")
    .eq("org_id", profile.orgId)
    .maybeSingle();
  const token = (pm as { payment_token?: string } | null)?.payment_token;
  if (!token) return { error: "No card on file to charge. Add a card first." };

  const { data: org } = await admin
    .from("organizations")
    .select("name, is_free_account, custom_monthly_cents, custom_addl_location_cents, plan_first_cents, plan_addl_cents")
    .eq("id", profile.orgId)
    .maybeSingle();
  const orgRow = org as
    | {
        name: string;
        is_free_account: boolean;
        custom_monthly_cents: number | null;
        custom_addl_location_cents: number | null;
        plan_first_cents: number | null;
        plan_addl_cents: number | null;
      }
    | null;

  const { count } = await admin.from("locations").select("id", { count: "exact", head: true }).eq("org_id", profile.orgId);
  let amountCents = orgRow && !orgRow.is_free_account ? await effectiveMonthlyCents(orgRow, count ?? 1) : 0;
  if (!amountCents || amountCents <= 0) amountCents = 100; // $1.00 sandbox smoke charge

  const reference = `WM-${profile.orgId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}`;
  const nowIso = new Date().toISOString();

  try {
    const result = await gpChargeStored({ token, amountCents, reference });
    await admin.from("billing_charges").insert({
      org_id: profile.orgId,
      provider: "global_payments",
      environment: GP_ENV,
      transaction_id: result.transactionId || null,
      amount_cents: amountCents,
      status: result.status,
      approved: result.approved,
      reference,
    });

    if (result.approved) {
      // Advance the billing period a month and send the branded receipt.
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await markActive(
        admin,
        profile.orgId,
        { brand: result.brand ?? undefined, last4: result.last4 ?? undefined, periodEnd: periodEnd.toISOString() },
        { amountCents, invoiceNumber: result.transactionId || reference, paidAtIso: nowIso },
      );
      revalidatePath("/settings");
      return { error: null, ok: true, amountCents, status: result.status };
    }
    // Declined — move to past due so dunning picks it up.
    await markPastDue(admin, profile.orgId, orgRow?.name ?? "your organization");
    revalidatePath("/settings");
    return { error: `Charge ${result.status.toLowerCase()}.`, amountCents, status: result.status };
  } catch (e) {
    await admin.from("billing_charges").insert({
      org_id: profile.orgId,
      provider: "global_payments",
      environment: GP_ENV,
      amount_cents: amountCents,
      status: "ERROR",
      approved: false,
      reference,
      error: e instanceof Error ? e.message.slice(0, 500) : "unknown",
    });
    return { error: e instanceof Error ? e.message : "Charge failed." };
  }
}

export async function removeBillingCard(): Promise<{ error: string | null }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can manage billing." };
  const admin = createAdminClient();
  const { data: pm } = await admin
    .from("billing_payment_methods")
    .select("payment_token")
    .eq("org_id", profile.orgId)
    .maybeSingle();
  const token = (pm as { payment_token?: string } | null)?.payment_token;
  if (token) await gpDeleteStoredCard(token);
  await admin.from("billing_payment_methods").delete().eq("org_id", profile.orgId);
  await admin.from("organizations").update({ card_brand: null, card_last4: null }).eq("id", profile.orgId);
  revalidatePath("/settings");
  return { error: null };
}
