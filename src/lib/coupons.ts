import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// Coupon codes — one-time discount, recurring discount, or free trial. Stored
// processor-agnostically so the billing integration (added when a processor is
// connected) can map them to e.g. Stripe coupons + trial_period_days.

export type CouponKind = "one_time" | "recurring" | "trial";

export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  kind: CouponKind;
  percent_off: number | null;
  amount_off_cents: number | null;
  duration_months: number | null;
  trial_days: number | null;
  max_redemptions: number | null;
  redeemed_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

// Human-readable summary of a coupon's terms.
export function describeCoupon(c: Pick<Coupon, "kind" | "percent_off" | "amount_off_cents" | "duration_months" | "trial_days">): string {
  if (c.kind === "trial") return `${c.trial_days}-day free trial`;
  const off = c.percent_off != null ? `${c.percent_off}% off` : c.amount_off_cents != null ? `$${(c.amount_off_cents / 100).toFixed(2).replace(/\.00$/, "")} off` : "discount";
  if (c.kind === "one_time") return `${off} the first charge`;
  const dur = c.duration_months ? ` for ${c.duration_months} month${c.duration_months === 1 ? "" : "s"}` : " (every charge)";
  return `${off}${dur}`;
}

// Look up + validate a code for redemption. Returns the coupon or a reason.
export async function validateCoupon(code: string, adminArg?: Admin): Promise<{ coupon?: Coupon; error?: string }> {
  const admin = adminArg ?? createAdminClient();
  const norm = normalizeCode(code);
  if (!norm) return { error: "Enter a code." };
  const { data } = await admin.from("coupons").select("*").eq("code", norm).maybeSingle();
  const c = data as Coupon | null;
  if (!c) return { error: "That code isn't valid." };
  if (!c.active) return { error: "That code is no longer active." };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { error: "That code has expired." };
  if (c.max_redemptions != null && c.redeemed_count >= c.max_redemptions) return { error: "That code has been fully redeemed." };
  return { coupon: c };
}

// Redeem a coupon for an org: record a snapshot, bump the count, and stamp the
// org (coupon_code + trial_ends_at for trials). Idempotent-ish: a new redeem
// replaces the org's previous coupon. Best-effort caller decides on error.
export async function redeemCouponForOrg(
  code: string,
  orgId: string,
  source: "signup" | "admin",
  adminArg?: Admin
): Promise<{ ok: boolean; error?: string; coupon?: Coupon }> {
  const admin = adminArg ?? createAdminClient();
  const { coupon, error } = await validateCoupon(code, admin);
  if (error || !coupon) return { ok: false, error: error ?? "Invalid code." };

  const now = new Date();
  const trialEnds = coupon.kind === "trial" && coupon.trial_days ? new Date(now.getTime() + coupon.trial_days * 86400000).toISOString() : null;

  // Replace any existing redemption for this org.
  const { data: prior } = await admin.from("coupon_redemptions").select("id").eq("org_id", orgId).maybeSingle();
  const row = {
    coupon_id: coupon.id,
    org_id: orgId,
    code: coupon.code,
    kind: coupon.kind,
    percent_off: coupon.percent_off,
    amount_off_cents: coupon.amount_off_cents,
    duration_months: coupon.duration_months,
    trial_days: coupon.trial_days,
    source,
    redeemed_at: now.toISOString(),
  };
  if ((prior as { id: string } | null)?.id) {
    await admin.from("coupon_redemptions").update(row).eq("org_id", orgId);
  } else {
    await admin.from("coupon_redemptions").insert(row);
    await admin.from("coupons").update({ redeemed_count: coupon.redeemed_count + 1, updated_at: now.toISOString() }).eq("id", coupon.id);
  }

  const orgUpdate: Record<string, unknown> = { coupon_code: coupon.code };
  if (trialEnds) orgUpdate.trial_ends_at = trialEnds;
  await admin.from("organizations").update(orgUpdate).eq("id", orgId);

  return { ok: true, coupon };
}
