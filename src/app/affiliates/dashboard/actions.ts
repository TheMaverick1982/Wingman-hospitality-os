"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAffiliateForUser } from "@/lib/affiliate";

export type PayoutState = { error: string | null; ok: boolean };

// Affiliate updates their own PayPal email + attribution window. Ownership is
// verified via the signed-in user's affiliate row; the write uses the admin
// client (bypassing RLS) but only ever touches the caller's own record.
export async function updateAffiliateSettings(_prev: PayoutState, formData: FormData): Promise<PayoutState> {
  const supabase = await createClient();
  const affiliate = await getAffiliateForUser(supabase);
  if (!affiliate) return { error: "Not signed in as an affiliate.", ok: false };

  const paypalEmail = String(formData.get("paypalEmail") || "").trim();
  const cookieRaw = String(formData.get("cookieDays") || "").trim();

  let cookieDays: number | null = null;
  if (cookieRaw) {
    const n = Number(cookieRaw);
    if (!Number.isFinite(n) || n < 1 || n > 365) return { error: "Cookie window must be between 1 and 365 days.", ok: false };
    cookieDays = Math.round(n);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("affiliates")
    .update({ paypal_email: paypalEmail || null, cookie_days: cookieDays })
    .eq("id", affiliate.id);
  if (error) return { error: error.message, ok: false };

  revalidatePath("/affiliates/dashboard");
  return { error: null, ok: true };
}
