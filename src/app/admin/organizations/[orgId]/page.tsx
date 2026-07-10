import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABELS, type AccessRole } from "@/lib/auth/permissions";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { effectiveMonthlyCents, pricingLabel } from "@/lib/pricing";
import { impersonateUser } from "../actions";
import { PricingForm } from "./pricing-form";

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
    .select("id, name, created_at, custom_monthly_cents, custom_addl_location_cents, pricing_note")
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

  const pricing = org as unknown as { custom_monthly_cents: number | null; custom_addl_location_cents: number | null; pricing_note: string | null };
  const locCount = (locations ?? []).length || 1;
  const effCents = effectiveMonthlyCents(pricing, locCount);
  const kind = pricingLabel(pricing);
  const effectiveLabel = `$${(effCents / 100).toFixed(0)}/mo · ${kind === "standard" ? "standard pricing" : kind === "flat" ? "flat custom price" : "custom per-location rate"}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/organizations" className="inline-flex items-center gap-1.5 text-sm font-medium text-charcoal-2 mb-3">
          <ArrowLeft size={15} /> All organizations
        </Link>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{org.name}</h1>
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
