import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { canEditSection } from "@/lib/auth/permissions";
import { aggregateBy, type Discount } from "@/lib/hospitality";
import { StatTile } from "@/components/ui/stat-tile";
import { Pill } from "@/components/ui/pill";
import { DeleteIconButton } from "@/components/ui/delete-icon-button";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { DiscountModalButton } from "./discount-modal";
import { RevenueForm } from "./revenue-form";
import { deleteDiscount } from "./actions";

const CATEGORY_COLORS = ["bg-[#DC2626]", "bg-[#D97706]", "bg-[#D97706]", "bg-brick", "bg-muted-2"];

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const isSuperAdmin = profile.accessRole === "super_admin";
  const canEdit = canEditSection(profile.accessRole, "recovery", profile.permissionOverrides);

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
  const maxCategoryTotal = byCategory.length > 0 ? byCategory[0][1].total : 1;
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Every comp has a reason</h1>
          <p className="text-base text-muted">
            Tag every discount and recovery so patterns surface instead of hiding in the POS.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatTile label="Recovery spend" value={`$${discountTotal}`} sub="this period" />
        <StatTile label="Comps logged" value={discounts.length} sub="all with a reason" />
        <StatTile
          label="Discount rate"
          value={`${discountPct}%`}
          sub="target 3–4% of revenue"
          trend={Number(discountPct) > 4 ? "Above target" : "On target"}
          trendTone={Number(discountPct) > 4 ? "down" : "up"}
        />
        {isSuperAdmin ? (
          <RevenueForm initialValue={totalRevenue} />
        ) : (
          <StatTile label="Total revenue" value={`$${totalRevenue}`} sub="this period" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-5">
        <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Top reasons</div>
          <div className="text-[13px] text-muted mb-6">This period, by comp value.</div>
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted">Nothing logged yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {byCategory.map(([cat, v], i) => (
                <div key={cat}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm font-medium text-ink">{cat}</span>
                    <span className="text-[13px] font-semibold text-muted tabular-nums">${v.total}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#F1F1F1] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
                      style={{ width: `${Math.round((v.total / maxCategoryTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-4">By staff member</div>
          <div className="flex flex-col gap-2.5">
            {byServer.length === 0 && <p className="text-sm text-muted">Nothing logged yet.</p>}
            {byServer.map(([name, v]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-charcoal-2">{name}</span>
                <span className="tabular-nums text-muted">
                  {v.count} · ${v.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <ExportCsvButton
          filename="service-recovery.csv"
          headers={["Date", "Location", "Server", "Category", "Reason", "Amount"]}
          rows={discounts.map((d) => [d.occurred_on, locationName(d.location_id), d.server_name, d.category, d.reason, d.amount])}
          label="Export log"
        />
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#FAFAFA] border-b border-line">
              {["Date", "Location", "Server", "Category", "Reason", "Amount", ""].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {discounts.map((d) => (
              <tr key={d.id} className="border-b border-line hover:bg-[#FAFAFA] transition-colors">
                <td className="px-5 py-3.5 text-muted">{d.occurred_on}</td>
                <td className="px-5 py-3.5 text-muted">{locationName(d.location_id)}</td>
                <td className="px-5 py-3.5 text-ink">{d.server_name}</td>
                <td className="px-5 py-3.5">
                  <Pill tone="brick">{d.category}</Pill>
                </td>
                <td className="px-5 py-3.5 text-charcoal-2">{d.reason}</td>
                <td className="px-5 py-3.5 text-ink font-semibold tabular-nums">${d.amount}</td>
                <td className="px-5 py-3.5">{canEdit && <DeleteIconButton id={d.id} action={deleteDiscount} />}</td>
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
    </>
  );
}
