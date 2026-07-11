"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { generateAffiliateCode, referralLink, siteUrl } from "@/lib/affiliate";
import { mirrorAffiliateToCrm } from "@/lib/crm-affiliate";
import { sendEmail } from "@/lib/email";

export type AdminAffState = { error: string | null };

export async function approveAffiliate(affiliateId: string): Promise<AdminAffState> {
  const me = await platformSectionActor("affiliates");
  if (!me) return { error: "Not authorized." };
  if (!affiliateId) return { error: "Missing affiliate." };

  const admin = createAdminClient();
  const { data: aff } = await admin
    .from("affiliates")
    .select("id, full_name, email, code")
    .eq("id", affiliateId)
    .maybeSingle();
  if (!aff) return { error: "Affiliate not found." };
  const a = aff as { full_name: string; email: string; code: string | null };

  const code = a.code ?? (await generateAffiliateCode(admin, a.full_name || a.email));
  const { error } = await admin
    .from("affiliates")
    .update({ status: "approved", code, approved_at: new Date().toISOString() })
    .eq("id", affiliateId);
  if (error) return { error: error.message };

  await mirrorAffiliateToCrm({ email: a.email, name: a.full_name, statusTag: "aff:approved" }, admin);

  const link = referralLink(code);
  try {
    await sendEmail({
      to: [a.email],
      subject: "You're approved as a Wingman affiliate 🎉",
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:520px;">
        <p style="font-size:16px;">Welcome aboard! Your Wingman affiliate account is approved.</p>
        <p style="font-size:15px;color:#525252;">Your referral link:</p>
        <p style="font-size:15px;"><a href="${link}" style="color:#0a6cff;font-weight:600;">${link}</a></p>
        <p style="font-size:15px;color:#525252;">Log in any time to grab your link, add your PayPal email, and track referrals: <a href="${siteUrl()}/affiliates/login" style="color:#0a6cff;">${siteUrl()}/affiliates/login</a></p>
      </div>`,
    });
  } catch {
    /* email is best-effort */
  }

  revalidatePath("/admin/affiliates");
  return { error: null };
}

export async function rejectAffiliate(affiliateId: string): Promise<AdminAffState> {
  const me = await platformSectionActor("affiliates");
  if (!me) return { error: "Not authorized." };
  if (!affiliateId) return { error: "Missing affiliate." };

  const admin = createAdminClient();
  const { data: aff } = await admin.from("affiliates").select("email, full_name").eq("id", affiliateId).maybeSingle();
  const { error } = await admin.from("affiliates").update({ status: "rejected" }).eq("id", affiliateId);
  if (error) return { error: error.message };

  const a = aff as { email: string; full_name: string } | null;
  if (a) await mirrorAffiliateToCrm({ email: a.email, name: a.full_name, statusTag: "aff:rejected" }, admin);

  revalidatePath("/admin/affiliates");
  return { error: null };
}

export async function setAffiliateStatus(affiliateId: string, status: "approved" | "suspended"): Promise<AdminAffState> {
  const me = await platformSectionActor("affiliates");
  if (!me) return { error: "Not authorized." };
  if (!affiliateId) return { error: "Missing affiliate." };

  const admin = createAdminClient();
  const { data: aff } = await admin.from("affiliates").select("email, full_name").eq("id", affiliateId).maybeSingle();
  const { error } = await admin.from("affiliates").update({ status }).eq("id", affiliateId);
  if (error) return { error: error.message };

  const a = aff as { email: string; full_name: string } | null;
  if (a) await mirrorAffiliateToCrm({ email: a.email, name: a.full_name, statusTag: status === "suspended" ? "aff:suspended" : "aff:approved" }, admin);

  revalidatePath("/admin/affiliates");
  return { error: null };
}

// Per-affiliate overrides (null = fall back to the program default).
export async function updateAffiliateTerms(
  affiliateId: string,
  commissionPct: number | null,
  cookieDays: number | null
): Promise<AdminAffState> {
  const me = await platformSectionActor("affiliates");
  if (!me) return { error: "Not authorized." };
  if (!affiliateId) return { error: "Missing affiliate." };

  if (commissionPct !== null && (commissionPct < 0 || commissionPct > 100)) return { error: "Commission must be 0–100%." };
  if (cookieDays !== null && (cookieDays < 1 || cookieDays > 365)) return { error: "Cookie window must be 1–365 days." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("affiliates")
    .update({ commission_pct: commissionPct, cookie_days: cookieDays })
    .eq("id", affiliateId);
  if (error) return { error: error.message };

  revalidatePath("/admin/affiliates");
  return { error: null };
}

export async function updateProgramSettings(_prev: AdminAffState, formData: FormData): Promise<AdminAffState> {
  const me = await platformSectionActor("affiliates");
  if (!me) return { error: "Not authorized." };

  const pct = Number(formData.get("commissionPct"));
  const term = Number(formData.get("termMonths"));
  const cookie = Number(formData.get("cookieDays"));
  const minPayout = Number(formData.get("minPayout"));

  if (![pct, term, cookie, minPayout].every(Number.isFinite)) return { error: "All fields must be numbers." };
  if (pct < 0 || pct > 100) return { error: "Commission must be 0–100%." };
  if (term < 1 || term > 120) return { error: "Term must be 1–120 months." };
  if (cookie < 1 || cookie > 365) return { error: "Cookie window must be 1–365 days." };
  if (minPayout < 0) return { error: "Minimum payout can't be negative." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("affiliate_program_settings")
    .update({
      default_commission_pct: pct,
      default_term_months: Math.round(term),
      default_cookie_days: Math.round(cookie),
      min_payout_cents: Math.round(minPayout * 100),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { error: error.message };

  revalidatePath("/admin/affiliates");
  return { error: null };
}
