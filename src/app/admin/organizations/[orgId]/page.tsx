import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABELS, type AccessRole } from "@/lib/auth/permissions";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { effectiveMonthlyCents, pricingLabel, BASE_CENTS, ADDL_CENTS } from "@/lib/pricing";
import { impersonateUser } from "../actions";
import { PricingForm } from "./pricing-form";
import { BillingCard } from "./billing-card";
import { billingBadge, BILLING_TONE_CLASSES } from "@/lib/billing-label";

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
    .select("id, name, created_at, custom_monthly_cents, custom_addl_location_cents, pricing_note, is_free_account, billing_status, card_brand, card_last4")
    .eq("id", orgId)
    .eq("is_platform", false)
    .maybeSingle();
  if (!org) notFound();

  const [{ data: locations }, { data: profiles }] = await Promise.all([
    admin.from("locations").select("id, name, created_at").eq("org_id", orgId).order("created_at"),
    admin
      .from("profiles")
      .select("id, full_name, access_role, location_id, locations!location_id(name)")
      .eq("org_id", orgId)
      .order("full_name"),
  ]);

  type ProfileRow = { id: string; full_name: string; access_role: AccessRole; location_id: string | null; locations: { name: string } | null };

  const billing = org as unknown as { is_free_account: boolean; billing_status: string; card_brand: string | null; card_last4: string | null };
  const pricing = org as unknown as { custom_monthly_cents: number | null; custom_addl_location_cents: number | null; pricing_note: string | null };
  const locCount = (locations ?? []).length || 1;
  const effCents = effectiveMonthlyCents(pricing, locCount);
  const kind = pricingLabel(pricing);
  const dollars = (c: number) => `$${(c / 100).toFixed(0)}`;
  const kindLabel = kind === "standard" ? "standard pricing" : kind === "flat" ? "flat custom price" : "custom per-location rate";
  const extra = locCount - 1;

  // Show the math so it stays clear (and auto-updates if their per-location rate changes).
  let effectiveLabel: string;
  if (kind === "flat") {
    effectiveLabel = `${dollars(effCents)}/mo · ${kindLabel} (flat — ignores location count)`;
  } else {
    const addlRate = pricing.custom_addl_location_cents ?? ADDL_CENTS;
    const breakdown =
      `${dollars(BASE_CENTS)} base` +
      (extra > 0 ? ` + ${extra} × ${dollars(addlRate)}/location` : "") +
      ` = ${dollars(effCents)}/mo`;
    effectiveLabel = `${breakdown} · ${kindLabel}`;
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
        />
      </div>
    </div>
  );
}
