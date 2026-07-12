"use server";

import { revalidatePath } from "next/cache";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { payableDateFrom } from "@/lib/sales-commissions";

async function guard() {
  return platformSectionActor("commissions");
}

// `nonce` increments on each successful record so the client can remount (and
// clear) the form via a key change — no setState-in-effect needed.
export type CommissionFormState = { error: string | null; ok: boolean; nonce: number };

export async function recordCommission(prev: CommissionFormState, formData: FormData): Promise<CommissionFormState> {
  const nonce = prev.nonce ?? 0;
  const fail = (error: string): CommissionFormState => ({ error, ok: false, nonce });

  const actor = await guard();
  if (!actor) return fail("Not authorized.");

  const repProfileId = String(formData.get("rep_profile_id") || "");
  if (!repProfileId) return fail("Pick a sales rep.");

  const kind = String(formData.get("kind") || "");
  if (!["activation", "tail", "other"].includes(kind)) return fail("Pick a commission type.");

  const dollars = Number(formData.get("amount"));
  if (!Number.isFinite(dollars) || dollars < 0) return fail("Enter a valid dollar amount.");
  const amount_cents = Math.round(dollars * 100);

  const label = String(formData.get("label") || "").trim();
  if (!label) return fail("Add a short label (e.g. \"Activation — Joe's Diner\").");

  const orgId = String(formData.get("org_id") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;
  // Expected pay date: what the owner typed, else the policy default (~30 days).
  const payableInput = String(formData.get("payable_on") || "").trim();
  const payable_on = /^\d{4}-\d{2}-\d{2}$/.test(payableInput) ? payableInput : payableDateFrom(Date.now());

  const admin = createAdminClient();
  const { error } = await admin.from("sales_commissions").insert({
    rep_profile_id: repProfileId,
    org_id: orgId,
    kind,
    label,
    amount_cents,
    note,
    payable_on,
    created_by: actor.userId,
  });
  if (error) return fail(error.message);

  revalidatePath("/admin/sales-commissions");
  revalidatePath("/admin/sales-training");
  return { error: null, ok: true, nonce: nonce + 1 };
}

async function setStatus(id: string, status: "owed" | "paid" | "void" | "denied") {
  const admin = createAdminClient();
  await admin
    .from("sales_commissions")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/admin/sales-commissions");
  revalidatePath("/admin/sales-training");
}

// Approve a rep's pending claim -> it becomes an owed commission.
export async function approveCommission(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") || "");
  if (id) await setStatus(id, "owed");
}

// Deny a rep's pending claim -> kept on record as denied, counts toward nothing.
export async function denyCommission(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") || "");
  if (id) await setStatus(id, "denied");
}

export async function markPaid(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") || "");
  if (id) await setStatus(id, "paid");
}

export async function markOwed(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") || "");
  if (id) await setStatus(id, "owed");
}

export async function voidCommission(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") || "");
  if (id) await setStatus(id, "void");
}

export async function deleteCommission(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const admin = createAdminClient();
  await admin.from("sales_commissions").delete().eq("id", id);
  revalidatePath("/admin/sales-commissions");
  revalidatePath("/admin/sales-training");
}

// Adjust the expected pay date on a line.
export async function setPayableDate(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") || "");
  const date = String(formData.get("payable_on") || "").trim();
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const admin = createAdminClient();
  await admin.from("sales_commissions").update({ payable_on: date }).eq("id", id);
  revalidatePath("/admin/sales-commissions");
  revalidatePath("/admin/sales-training");
}

// Mark every 'owed' row for one rep as paid — a one-click payout run.
export async function markAllPaidForRep(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const repProfileId = String(formData.get("rep_profile_id") || "");
  if (!repProfileId) return;
  const admin = createAdminClient();
  await admin
    .from("sales_commissions")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("rep_profile_id", repProfileId)
    .eq("status", "owed");
  revalidatePath("/admin/sales-commissions");
  revalidatePath("/admin/sales-training");
}
