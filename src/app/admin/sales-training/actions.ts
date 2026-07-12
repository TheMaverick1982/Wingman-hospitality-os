"use server";

import { revalidatePath } from "next/cache";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { payableDateFrom } from "@/lib/sales-commissions";

// nonce increments on each successful claim so the form can remount + clear.
export type ClaimState = { error: string | null; ok: boolean; nonce: number };

// A sales rep claims a commission for an account they closed. The claim always
// belongs to the logged-in rep (they can't claim for someone else) and lands as
// 'pending' for the owner to approve or deny — so nothing counts until it's been
// checked. Gated on the sales_training section, which reps have.
export async function claimCommission(prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const nonce = prev.nonce ?? 0;
  const fail = (error: string): ClaimState => ({ error, ok: false, nonce });

  const actor = await platformSectionActor("sales_training");
  if (!actor) return fail("Not authorized.");

  const kind = String(formData.get("kind") || "");
  if (!["activation", "tail", "other"].includes(kind)) return fail("Pick a commission type.");

  const dollars = Number(formData.get("amount"));
  if (!Number.isFinite(dollars) || dollars < 0) return fail("Enter a valid dollar amount.");
  const amount_cents = Math.round(dollars * 100);

  const label = String(formData.get("label") || "").trim();
  if (!label) return fail("Add a short label (e.g. the account name).");

  const orgId = String(formData.get("org_id") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;

  const admin = createAdminClient();
  const { error } = await admin.from("sales_commissions").insert({
    rep_profile_id: actor.userId, // always the claiming rep
    org_id: orgId,
    kind,
    label,
    amount_cents,
    status: "pending", // awaits owner approval
    note,
    payable_on: payableDateFrom(Date.now()), // policy default; owner can adjust
    created_by: actor.userId,
  });
  if (error) return fail(error.message);

  revalidatePath("/admin/sales-training");
  revalidatePath("/admin/sales-commissions");
  return { error: null, ok: true, nonce: nonce + 1 };
}
