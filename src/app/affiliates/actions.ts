"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/rate-limit";

export type ApplyState = { error: string | null; ok: boolean; message?: string };
export type AffiliateLoginState = { error: string | null };

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 15; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    if (error || users.length === 0) break;
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match.id;
    if (users.length < 200) break;
  }
  return null;
}

// Public affiliate application. Creates a login immediately (or links an
// existing Wingman account) and files a PENDING affiliate for admin review.
export async function applyAsAffiliate(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  if (!(await consumeRateLimit(`affiliate_apply:${await clientIp()}`, 5, 3600))) {
    return { error: "Too many applications from this connection. Please try again later.", ok: false };
  }

  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const promo = String(formData.get("promo") || "").trim();
  const paypalEmail = String(formData.get("paypalEmail") || "").trim();
  const agreed = formData.get("agree") === "on";

  if (!fullName || !email) return { error: "Name and email are required.", ok: false };
  if (password.length < 8) return { error: "Choose a password of at least 8 characters.", ok: false };
  if (!agreed) return { error: "Please accept the affiliate agreement to continue.", ok: false };

  const admin = createAdminClient();

  const { data: existing } = await admin.from("affiliates").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return { error: "You've already applied with this email. Log in to check your status.", ok: false };
  }

  // Create their login, or link an existing Wingman account.
  let userId: string | null = null;
  let linkedExisting = false;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created?.user) {
    userId = created.user.id;
  } else if (createErr) {
    userId = await findUserIdByEmail(admin, email);
    linkedExisting = Boolean(userId);
    if (!userId) return { error: createErr.message, ok: false };
  }

  const { error: insErr } = await admin.from("affiliates").insert({
    user_id: userId,
    email,
    full_name: fullName,
    promo_method: promo || null,
    paypal_email: paypalEmail || null,
    agreement_accepted_at: new Date().toISOString(),
    status: "pending",
  });
  if (insErr) return { error: insErr.message, ok: false };

  if (linkedExisting) {
    return {
      error: null,
      ok: true,
      message: "Application received! This email already has a Wingman login — sign in with your existing password to track your status.",
    };
  }

  // Brand-new login: sign them in and drop them on their dashboard (which shows
  // the "under review" state until an admin approves them).
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) {
    return { error: null, ok: true, message: "Application received! You can now log in to track your status." };
  }
  redirect("/affiliates/dashboard");
}

export async function affiliateLogin(_prev: AffiliateLoginState, formData: FormData): Promise<AffiliateLoginState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/affiliates/dashboard");
}

export async function affiliateLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/affiliates");
}
