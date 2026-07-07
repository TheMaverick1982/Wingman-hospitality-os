import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { canEditSection } from "@/lib/auth/permissions";
import { aggregateBy, type Discount } from "@/lib/hospitality";
import { Stat } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { DeleteIconButton } from "@/components/ui/delete-icon-button";
import { Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { DiscountModalButton } from "./discount-modal";
import { RevenueForm } from "./revenue-form";
import { deleteDiscount } from "./actions";

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const isSuperAdmin = profile.accessRole === "super_admin";
  const canEdit = canEditSection(profile.accessRole, "recovery");

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
  });

  const supabase = await createClient();
  let query = supabase.from("discounts").select("*").order("occurred_on", { ascending: false });
  if (effectiveLocation) query = query.eq("location_id", effectiveLocation);

  const [{ data: org }, { data: discountsData }, locations] = await Promise.all([
    supabase.from("organizations").select("total_revenue").single(),
    query,
    getOrgLocations(),
  ]);

  const discounts = (discountsData ?? []) as Discount[];
  const discountTotal = discounts.reduce((s, d) => s + Number(d.amount), 0);
  const totalRevenue = Number(org?.total_revenue ?? 0);
  const discountPct = totalRevenue > 0 ? ((discountTotal / totalRevenue) * 100).toFixed(1) : "0.0";
  const byCategory = aggregateBy(discounts, (d) => d.category, (d) => Number(d.amount));
  const byServer = aggregateBy(discounts, (d) => d.server_name, (d) => Number(d.amount));
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1 text-ink">Service Recovery</h1>
          <p className="text-sm text-muted">
            We don&apos;t rely on discounts to fix experiences. We fix the experience — and track why
            discounts happened.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!canEdit && <Pill>View only</Pill>}
          {canEdit && (
            <DiscountModalButton
              locations={locations}
              isGm={isSuperAdmin}
              lockedLocationName={profile.locationName}
              defaultLocationId={effectiveLocation ?? profile.locationId}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <Stat
          label="Discount rate this period"
          value={`${discountPct}%`}
          sub="Target 3–4%"
          tone={Number(discountPct) > 4 ? "danger" : "olive"}
          icon={Number(discountPct) > 4 ? TrendingUp : TrendingDown}
        />
        <Stat label="Total discounted" value={`$${discountTotal}`} sub={`${discounts.length} logged incidents`} tone="brick" icon={Receipt} />
        {isSuperAdmin ? (
          <RevenueForm initialValue={totalRevenue} />
        ) : (
          <Stat label="Total revenue this period" value={`$${totalRevenue}`} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-3 text-ink">Top issues</h3>
          <div className="flex flex-col gap-2.5">
            {byCategory.length === 0 && <p className="text-sm text-muted">Nothing logged yet.</p>}
            {byCategory.map(([cat, v]) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <span className="text-charcoal-2">{cat}</span>
                <span className="font-mono text-muted">
                  {v.count} · ${v.total}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-3 text-ink">By staff member</h3>
          <div className="flex flex-col gap-2.5">
            {byServer.length === 0 && <p className="text-sm text-muted">Nothing logged yet.</p>}
            {byServer.map(([name, v]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-charcoal-2">{name}</span>
                <span className="font-mono text-muted">
                  {v.count} · ${v.total}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-end mb-3">
        <ExportCsvButton
          filename="service-recovery.csv"
          headers={["Date", "Location", "Server", "Category", "Reason", "Amount"]}
          rows={discounts.map((d) => [d.occurred_on, locationName(d.location_id), d.server_name, d.category, d.reason, d.amount])}
          label="Export log"
        />
      </div>

      <div className="bg-panel border border-line rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#fafafa] border-b border-line">
              {["Date", "Location", "Server", "Category", "Reason", "Amount", ""].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {discounts.map((d) => (
              <tr key={d.id} className="border-b border-line hover:bg-[#fafafa] transition-colors">
                <td className="px-5 py-3.5 text-muted">{d.occurred_on}</td>
                <td className="px-5 py-3.5 text-muted">{locationName(d.location_id)}</td>
                <td className="px-5 py-3.5 text-ink">{d.server_name}</td>
                <td className="px-5 py-3.5">
                  <Pill tone="brick">{d.category}</Pill>
                </td>
                <td className="px-5 py-3.5 text-charcoal-2">{d.reason}</td>
                <td className="px-5 py-3.5 text-ink font-mono">${d.amount}</td>
                <td className="px-5 py-3.5">
                  {canEdit && <DeleteIconButton id={d.id} action={deleteDiscount} />}
                </td>
              </tr>
            ))}
            {discounts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-muted">
                  No discounts logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
