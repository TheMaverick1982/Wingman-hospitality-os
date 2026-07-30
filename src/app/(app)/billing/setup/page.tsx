import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { effectiveMonthlyCents } from "@/lib/pricing";
import { isNativeIOS } from "@/lib/native/platform";

export const metadata: Metadata = {
  title: "Set up billing",
  robots: { index: false, follow: false },
};

export default async function BillingSetupPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  // App Review compliance (guideline 3.1.1): no external purchase surfaces in
  // the native iOS app. Billing is managed on the web.
  if (await isNativeIOS()) redirect("/settings");

  const supabase = await createClient();
  const [{ data: org }, { count: locationCount }] = await Promise.all([
    supabase.from("organizations").select("name, is_free_account, billing_status, custom_monthly_cents, custom_addl_location_cents, plan_first_cents, plan_addl_cents, card_brand, card_last4").eq("id", profile.orgId).maybeSingle(),
    supabase.from("locations").select("id", { count: "exact", head: true }).eq("org_id", profile.orgId),
  ]);

  const o = org as {
    name: string;
    is_free_account: boolean;
    billing_status: string;
    custom_monthly_cents: number | null;
    custom_addl_location_cents: number | null;
    plan_first_cents: number | null;
    plan_addl_cents: number | null;
    card_brand: string | null;
    card_last4: string | null;
  } | null;

  const price = await effectiveMonthlyCents(o, locationCount ?? 1);
  const hasCard = Boolean(o?.card_last4);

  return (
    <div className="max-w-xl w-full mx-auto">
      <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink mb-1.5">Set up billing</h1>
      <p className="text-[15px] text-muted mb-6">Add a payment method to keep {o?.name ?? "your account"} active.</p>

      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm mb-4">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-2 mb-2">Your plan</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[34px] font-bold tracking-[-0.02em] text-ink">${(price / 100).toFixed(0)}</span>
          <span className="text-muted">/ month</span>
        </div>
        <p className="text-[13px] text-muted-2 mt-1">
          {(locationCount ?? 1)} location{(locationCount ?? 1) === 1 ? "" : "s"} · billed monthly
        </p>
      </div>

      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-2 mb-4">Payment method</div>
        {hasCard ? (
          <p className="text-[15px] text-ink">
            {o?.card_brand ?? "Card"} ending in ····{o?.card_last4} on file.
          </p>
        ) : (
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-12 h-12 rounded-full bg-brick-tint flex items-center justify-center mb-4">
              <CreditCard size={22} className="text-brick" />
            </div>
            <p className="text-[15px] font-semibold text-ink mb-1">Card entry is being finalized</p>
            <p className="text-[14px] text-muted max-w-sm leading-relaxed">
              We&apos;re connecting our payment processor. You&apos;ll be able to add your card here shortly — no action
              needed right now, and your account stays active in the meantime.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
