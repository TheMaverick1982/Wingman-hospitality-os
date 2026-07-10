import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// -----------------------------------------------------------------------------
// Affiliate program helpers (Phase 1).
// -----------------------------------------------------------------------------

export const REF_COOKIE = "wingman_ref";

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app";
}

export function referralLink(code: string): string {
  return `${siteUrl()}/r/${code}`;
}

export type AffiliateSettings = {
  default_commission_pct: number;
  default_term_months: number;
  default_cookie_days: number;
  min_payout_cents: number;
};

export type Affiliate = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  code: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  commission_pct: number | null;
  cookie_days: number | null;
  paypal_email: string | null;
  promo_method: string | null;
  created_at: string;
  approved_at: string | null;
};

export async function getAffiliateSettings(admin: SupabaseClient): Promise<AffiliateSettings> {
  const { data } = await admin
    .from("affiliate_program_settings")
    .select("default_commission_pct, default_term_months, default_cookie_days, min_payout_cents")
    .eq("id", 1)
    .maybeSingle();
  return (
    (data as AffiliateSettings) ?? {
      default_commission_pct: 20,
      default_term_months: 12,
      default_cookie_days: 60,
      min_payout_cents: 5000,
    }
  );
}

export function effectiveCookieDays(a: Pick<Affiliate, "cookie_days">, s: AffiliateSettings): number {
  return a.cookie_days ?? s.default_cookie_days;
}

export function effectiveCommissionPct(a: Pick<Affiliate, "commission_pct">, s: AffiliateSettings): number {
  return a.commission_pct ?? s.default_commission_pct;
}

// Build a unique, human-friendly referral code from a name (falls back to
// random). Retries on collision.
export async function generateAffiliateCode(admin: SupabaseClient, fullName: string): Promise<string> {
  const base =
    fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 14) || "wing";
  for (let i = 0; i < 25; i++) {
    const suffix = i === 0 ? "" : String(1000 + Math.floor((i * 7919) % 9000)); // deterministic-ish, avoids Math.random import concerns
    const code = `${base}${suffix}`;
    const { data } = await admin.from("affiliates").select("id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  return `${base}${Date.now().toString(36).slice(-4)}`;
}

// The affiliate row for the currently signed-in user (via RLS), or null. Used by
// the affiliate dashboard.
export async function getAffiliateForUser(supabase: SupabaseClient): Promise<Affiliate | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("affiliates").select("*").eq("user_id", user.id).maybeSingle();
  return (data as Affiliate) ?? null;
}

// Attribute a newly created org to an affiliate, if the visitor carries a valid
// first-click ref cookie and the org isn't already attributed. Idempotent.
// `refCode` comes from the request cookie; pass null to no-op.
export async function attributeOrgToAffiliate(refCode: string | null | undefined, orgId: string): Promise<boolean> {
  if (!refCode) return false;
  const admin = createAdminClient();

  const { data: aff } = await admin
    .from("affiliates")
    .select("id, status")
    .eq("code", refCode)
    .maybeSingle();
  if (!aff || (aff as { status: string }).status !== "approved") return false;
  const affiliateId = (aff as { id: string }).id;

  // Don't overwrite an existing attribution (first-click wins).
  const { data: org } = await admin.from("organizations").select("referred_by_affiliate_id").eq("id", orgId).maybeSingle();
  if (!org) return false;
  if ((org as { referred_by_affiliate_id: string | null }).referred_by_affiliate_id) return false;

  await admin.from("organizations").update({ referred_by_affiliate_id: affiliateId }).eq("id", orgId);
  await admin.from("affiliate_referrals").insert({ affiliate_id: affiliateId, org_id: orgId });
  return true;
}

// Call right after a new org is created for the signed-in user: reads the
// first-click ref cookie, resolves the user's org, and attributes it. Safe to
// call from server actions and server components (cookie deletion is
// best-effort, since components can't always mutate cookies).
export async function captureReferralForCurrentUser(supabase: SupabaseClient): Promise<void> {
  const cookieStore = await cookies();
  const refCode = cookieStore.get(REF_COOKIE)?.value;
  if (!refCode) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  const orgId = (prof as { org_id: string } | null)?.org_id;
  if (!orgId) return;

  const attributed = await attributeOrgToAffiliate(refCode, orgId);
  if (attributed) {
    try {
      cookieStore.delete(REF_COOKIE);
    } catch {
      /* server components can't mutate cookies; harmless — attribution is idempotent */
    }
  }
}
