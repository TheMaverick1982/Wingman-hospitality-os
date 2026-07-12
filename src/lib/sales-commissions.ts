import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------------
// Sales commission ledger helpers. Entries are recorded by an admin (billing
// isn't connected yet, so nothing auto-accrues). Both the owner and the rep read
// the same rows — the owner sees everyone in /admin/sales-commissions; a rep
// sees only their own inside the Sales Training section.
// -----------------------------------------------------------------------------

// Standard plan (mirrors the "How you're paid" section of the playbook).
export const ACTIVATION_BONUS_CENTS = 12500; // $125 per location activated
export const TAIL_PCT = 5; // 5% of monthly revenue for the recurring tail

export type CommissionKind = "activation" | "tail" | "other";
// pending = a rep's claim awaiting owner approval; denied = owner rejected it.
export type CommissionStatus = "pending" | "owed" | "paid" | "void" | "denied";

export type SalesCommission = {
  id: string;
  rep_profile_id: string;
  org_id: string | null;
  kind: CommissionKind;
  label: string;
  amount_cents: number;
  status: CommissionStatus;
  note: string | null;
  created_at: string;
  paid_at: string | null;
};

export type RepTotals = { owedCents: number; paidCents: number };

export function totalsFor(rows: Pick<SalesCommission, "amount_cents" | "status">[]): RepTotals {
  let owedCents = 0;
  let paidCents = 0;
  for (const r of rows) {
    if (r.status === "owed") owedCents += r.amount_cents;
    else if (r.status === "paid") paidCents += r.amount_cents;
  }
  return { owedCents, paidCents };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// The rep's own ledger rows, newest first. Safe for a rep to call for their own
// id — the page that uses it is already gated to that logged-in rep.
export async function commissionsForRep(admin: SupabaseClient, repProfileId: string): Promise<SalesCommission[]> {
  const { data } = await admin
    .from("sales_commissions")
    .select("id, rep_profile_id, org_id, kind, label, amount_cents, status, note, created_at, paid_at")
    .eq("rep_profile_id", repProfileId)
    .order("created_at", { ascending: false });
  return (data ?? []) as SalesCommission[];
}
