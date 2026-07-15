import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABELS, type AccessRole } from "@/lib/auth/permissions";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { effectiveMonthlyCents, pricingLabel, getPlatformPricing } from "@/lib/pricing";
import { impersonateUser } from "../actions";
import { PricingForm } from "./pricing-form";
import { AffiliateForm } from "./affiliate-form";
import { BillingCard } from "./billing-card";
import { CouponCard } from "./coupon-card";
import { billingBadge, BILLING_TONE_CLASSES } from "@/lib/billing-label";
import { getOrgSetup, getOrgLogins, relativeTime } from "@/lib/admin/org-metrics";
import { CheckCircle2, Circle } from "lucide-react";

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const me = await requirePlatformSection("organizations");
  const canImpersonate = me.platformAccess.includes("client_login");
  const { orgId } = await params;
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, created_at, custom_monthly_cents, custom_addl_location_cents, plan_first_cents, plan_addl_cents, pricing_note, is_free_account, billing_status, card_brand, card_last4, coupon_code, trial_ends_at, referred_by_affiliate_id")
    .eq("id", orgId)
    .eq("is_platform", false)
    .maybeSingle();
  if (!org) notFound();

  // Approved affiliates, for manual referral attribution (offline intros).
  const { data: affiliateRows } = await admin
    .from("affiliates")
    .select("id, full_name, email, code")
    .eq("status", "approved")
    .order("full_name");
  const affiliates = ((affiliateRows ?? []) as { id: string; full_name: string; email: string; code: string | null }[]).map((a) => ({
    id: a.id,
    label: `${a.full_name || a.email}${a.code ? ` (${a.code})` : ""}`,
  }));

  const { data: redemption } = await admin
    .from("coupon_redemptions")
    .select("code, kind, percent_off, amount_off_cents, duration_months, trial_days, source, redeemed_at")
    .eq("org_id", orgId)
    .maybeSingle();

  const [{ data: locations }, { data: profiles }] = await Promise.all([
    admin.from("locations").select("id, name, created_at").eq("org_id", orgId).order("created_at"),
    admin
      .from("profiles")
      .select("id, full_name, access_role, location_id, locations!location_id(name)")
      .eq("org_id", orgId)
      .order("full_name"),
  ]);

  type ProfileRow = { id: string; full_name: string; access_role: AccessRole; location_id: string | null; locations: { name: string } | null };

  // Customer health: setup progress + login activity across the team.
  const memberIds = ((profiles ?? []) as unknown as ProfileRow[]).map((p) => p.id);
  const [setup, logins] = await Promise.all([getOrgSetup(admin, orgId), getOrgLogins(admin, memberIds)]);
  const setupPct = setup.total > 0 ? Math.round((setup.doneCount / setup.total) * 100) : 0;

  const billing = org as unknown as { is_free_account: boolean; billing_status: string; card_brand: string | null; card_last4: string | null };
  const pricing = org as unknown as {
    custom_monthly_cents: number | null;
    custom_addl_location_cents: number | null;
    plan_first_cents: number | null;
    plan_addl_cents: number | null;
    pricing_note: string | null;
  };
  const locCount = (locations ?? []).length || 1;
  const platformPricing = await getPlatformPricing();
  const effCents = await effectiveMonthlyCents(pricing, locCount);
  const kind = pricingLabel(pricing);
  const dollars = (c: number) => `$${(c / 100).toFixed(0)}`;
  const kindLabel = kind === "standard" ? "standard pricing" : kind === "flat" ? "flat custom price" : "custom per-location rate";
  const extra = locCount - 1;

  // Show the math so it stays clear (and auto-updates if their per-location rate changes).
  let effectiveLabel: string;
  if (kind === "flat") {
    effectiveLabel = `${dollars(effCents)}/mo · ${kindLabel} (flat — ignores location count)`;
  } else {
    // Standard orgs are grandfathered onto the rate locked at signup; only fall
    // back to the live platform price for never-locked (free/demo) orgs.
    const baseRate = pricing.plan_first_cents ?? platformPricing.firstCents;
    const addlRate = pricing.custom_addl_location_cents ?? pricing.plan_addl_cents ?? platformPricing.addlCents;
    const grandfathered = pricing.plan_first_cents != null && pricing.plan_first_cents !== platformPricing.firstCents;
    const breakdown =
      `${dollars(baseRate)} base` +
      (extra > 0 ? ` + ${extra} × ${dollars(addlRate)}/location` : "") +
      ` = ${dollars(effCents)}/mo`;
    effectiveLabel = `${breakdown} · ${kindLabel}${grandfathered ? ` · grandfathered (current list ${dollars(platformPricing.firstCents)})` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/organizations" className="inline-flex items-center gap-1.5 text-sm font-medium text-charcoal-2 mb-3">
          <ArrowLeft size={15} /> All organizations
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{org.name}</h1>
          {(() => {
            const b = billingBadge(billing.is_free_account, billing.billing_status);
            return <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full ${BILLING_TONE_CLASSES[b.tone]}`}>{b.label}</span>;
          })()}
        </div>
        <p className="text-sm text-muted mt-1">
          Created {org.created_at ? new Date(org.created_at).toLocaleDateString() : "—"}
        </p>
      </div>

      {/* Customer health — engagement at a glance */}
      <div className="bg-white border border-line rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-4">Customer health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
          <div>
            <div className="text-[12px] font-semibold text-muted-2 uppercase tracking-wide">Last login</div>
            <div className="text-lg font-bold text-ink mt-0.5">{relativeTime(logins.lastLogin)}</div>
            <div className="text-[12px] text-muted-2">{logins.lastLogin ? new Date(logins.lastLogin).toLocaleString() : "No one has signed in yet"}</div>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-muted-2 uppercase tracking-wide">Team activated</div>
            <div className="text-lg font-bold text-ink mt-0.5">
              {logins.activated} <span className="text-muted-2 font-medium">/ {logins.total}</span>
            </div>
            <div className="text-[12px] text-muted-2">members have logged in</div>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-muted-2 uppercase tracking-wide">Setup progress</div>
            <div className="text-lg font-bold text-ink mt-0.5">
              {setupPct}% <span className="text-muted-2 font-medium text-sm">· {setup.doneCount}/{setup.total} steps</span>
            </div>
            <div className="h-1.5 bg-paper rounded-full mt-2 overflow-hidden">
              <div className={`h-full rounded-full ${setupPct === 100 ? "bg-olive" : "bg-brick"}`} style={{ width: `${setupPct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-4 border-t border-[#F1F1F1]">
          {setup.steps.map((s) => (
            <span
              key={s.label}
              className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium px-2.5 py-1 rounded-full ${
                s.done ? "text-olive bg-olive-tint" : "text-muted-2 bg-paper"
              }`}
            >
              {s.done ? <CheckCircle2 size={13} /> : <Circle size={13} />} {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-line rounded-2xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-4">
            Locations ({(locations ?? []).length})
          </h2>
          <div className="flex flex-col gap-2">
            {(locations ?? []).map((loc) => (
              <div key={loc.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-paper">
                <span className="text-sm font-medium text-ink">{loc.name}</span>
                <span className="text-xs text-muted-2">
                  {loc.created_at ? new Date(loc.created_at).toLocaleDateString() : ""}
                </span>
              </div>
            ))}
            {(locations ?? []).length === 0 && <p className="text-sm text-muted">No locations yet.</p>}
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-4">
            Team members ({(profiles ?? []).length})
          </h2>
          <div className="flex flex-col gap-2">
            {((profiles ?? []) as unknown as ProfileRow[]).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-paper">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{p.full_name || "Unnamed"}</div>
                  <div className="text-xs text-muted-2">
                    {ROLE_LABELS[p.access_role]}
                    {p.locations?.name ? ` · ${p.locations.name}` : ""}
                  </div>
                </div>
                {canImpersonate && (
                  <form action={impersonateUser.bind(null, p.id)}>
                    <button type="submit" className="text-xs font-semibold text-brick shrink-0">
                      Log in as →
                    </button>
                  </form>
                )}
              </div>
            ))}
            {(profiles ?? []).length === 0 && <p className="text-sm text-muted">No team members yet.</p>}
          </div>
        </div>
      </div>

      <BillingCard
        orgId={org.id}
        isFree={billing.is_free_account}
        billingStatus={billing.billing_status}
        cardBrand={billing.card_brand}
        cardLast4={billing.card_last4}
      />

      <div className="bg-white border border-line rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-1">Custom pricing</h2>
        <p className="text-[13px] text-muted mb-4">
          Enterprise override for this organization only — never advertised or shown to other customers.
        </p>
        <PricingForm
          orgId={org.id}
          monthlyCents={pricing.custom_monthly_cents}
          addlCents={pricing.custom_addl_location_cents}
          note={pricing.pricing_note ?? ""}
          effectiveLabel={effectiveLabel}
          baseDollars={Math.round(platformPricing.firstCents / 100)}
        />
      </div>

      <div className="bg-white border border-line rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-1">Affiliate attribution</h2>
        <p className="text-[13px] text-muted mb-4">
          Credit an affiliate who made the intro when you signed this customer up manually. Their commission accrues from the next payment.
        </p>
        <AffiliateForm
          orgId={org.id}
          current={(org as unknown as { referred_by_affiliate_id: string | null }).referred_by_affiliate_id}
          affiliates={affiliates}
        />
      </div>

      <CouponCard
        orgId={org.id}
        redemption={(redemption as never) ?? null}
        trialEndsAt={(org as unknown as { trial_ends_at: string | null }).trial_ends_at}
      />
    </div>
  );
}
