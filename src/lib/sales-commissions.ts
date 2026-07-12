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
  payable_on: string | null; // expected pay date (YYYY-MM-DD)
};

const COMMISSION_COLUMNS = "id, rep_profile_id, org_id, kind, label, amount_cents, status, note, created_at, paid_at, payable_on";

// How many days after a commission is recorded it becomes payable, per policy
// (paid once the account clears its first paid month — roughly a month out).
export const PAYABLE_AFTER_DAYS = 30;

// A payable date `days` out from `fromMs`, as YYYY-MM-DD. Caller passes the base
// time so this stays pure/testable (no clock read in here).
export function payableDateFrom(fromMs: number, days = PAYABLE_AFTER_DAYS): string {
  return new Date(fromMs + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// A date-only string is "due" when it's today or earlier. `todayIso` is the
// caller's YYYY-MM-DD so comparison is a plain string compare.
export function isDue(payableOn: string | null, todayIso: string): boolean {
  return !!payableOn && payableOn <= todayIso;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  // Parse as a local date (avoid TZ shifting a date-only value back a day).
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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
    .select(COMMISSION_COLUMNS)
    .eq("rep_profile_id", repProfileId)
    .order("created_at", { ascending: false });
  return (data ?? []) as SalesCommission[];
}
