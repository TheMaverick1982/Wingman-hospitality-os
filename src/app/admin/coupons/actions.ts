"use server";

import { revalidatePath } from "next/cache";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCode } from "@/lib/coupons";

async function guard() {
  return platformSectionActor("coupons");
}

export type CouponFormState = { error: string | null; ok: boolean };

export async function createCoupon(_prev: CouponFormState, formData: FormData): Promise<CouponFormState> {
  if (!(await guard())) return { error: "Not authorized.", ok: false };

  const code = normalizeCode(String(formData.get("code") || ""));
  if (!code) return { error: "Enter a code.", ok: false };
  const description = String(formData.get("description") || "").trim() || null;
  const kind = String(formData.get("kind") || "");
  if (!["one_time", "recurring", "trial"].includes(kind)) return { error: "Pick a coupon type.", ok: false };

  const row: Record<string, unknown> = { code, description, kind };

  if (kind === "trial") {
    const days = Math.round(Number(formData.get("trial_days")));
    if (!Number.isFinite(days) || days < 1 || days > 365) return { error: "Trial length must be 1–365 days.", ok: false };
    row.trial_days = days;
  } else {
    const discountType = String(formData.get("discount_type") || "");
    if (discountType === "percent") {
      const pct = Math.round(Number(formData.get("percent_off")));
      if (!Number.isFinite(pct) || pct < 1 || pct > 100) return { error: "Percent off must be 1–100.", ok: false };
      row.percent_off = pct;
    } else if (discountType === "amount") {
      const dollars = Number(formData.get("amount_off"));
      if (!Number.isFinite(dollars) || dollars <= 0) return { error: "Enter a dollar amount off.", ok: false };
      row.amount_off_cents = Math.round(dollars * 100);
    } else {
      return { error: "Choose percent or dollar off.", ok: false };
    }
    if (kind === "recurring") {
      const durationForever = String(formData.get("duration") || "forever") === "forever";
      if (!durationForever) {
        const months = Math.round(Number(formData.get("duration_months")));
        if (!Number.isFinite(months) || months < 1) return { error: "Enter the number of months.", ok: false };
        row.duration_months = months;
      }
    }
  }

  const maxRaw = Number(formData.get("max_redemptions"));
  if (Number.isFinite(maxRaw) && maxRaw > 0) row.max_redemptions = Math.round(maxRaw);
  const expires = String(formData.get("expires_at") || "").trim();
  if (expires) {
    const d = new Date(expires);
    if (!Number.isNaN(d.getTime())) row.expires_at = d.toISOString();
  }

  const admin = createAdminClient();
  const { error } = await admin.from("coupons").insert(row);
  if (error) {
    if (error.code === "23505") return { error: `Code "${code}" already exists.`, ok: false };
    return { error: error.message, ok: false };
  }
  revalidatePath("/admin/coupons");
  return { error: null, ok: true };
}

export async function toggleCoupon(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "true";
  if (!id) return;
  const admin = createAdminClient();
  await admin.from("coupons").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/coupons");
}

export async function deleteCoupon(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const admin = createAdminClient();
  await admin.from("coupons").delete().eq("id", id);
  revalidatePath("/admin/coupons");
}
