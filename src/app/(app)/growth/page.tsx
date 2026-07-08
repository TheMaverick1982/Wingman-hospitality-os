import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import { buildPhases, buildTrajectory, type GrowthFrequency } from "@/lib/growth-plan";
import { Pill } from "@/components/ui/pill";
import { GrowthPlanForm } from "./growth-plan-form";
import { PhaseComparisonChart, TrajectoryChart } from "./growth-plan-charts";

type GrowthPlanRow = {
  frequency: GrowthFrequency;
  current_customers: number;
  current_avg_sale: number;
  current_repurchase_frequency: number;
  uniform_pct: number;
  target_customers_pct: number;
  target_avg_sale_pct: number;
  target_frequency_pct: number;
};

const EMPTY_PLAN: GrowthPlanRow = {
  frequency: "monthly",
  current_customers: 0,
  current_avg_sale: 0,
  current_repurchase_frequency: 0,
  uniform_pct: 10,
  target_customers_pct: 20,
  target_avg_sale_pct: 20,
  target_frequency_pct: 20,
};

export default async function GrowthPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "growth") === "none") redirect("/dashboard");
  const canEdit = canEditSection(profile.accessRole, "growth");
  const isSuperAdmin = profile.accessRole === "super_admin";

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
  });

  const supabase = await createClient();
  let planQuery = supabase.from("growth_plans").select("*");
  planQuery = effectiveLocation ? planQuery.eq("location_id", effectiveLocation) : planQuery.is("location_id", null);

  const [{ data: planRow }, locations] = await Promise.all([planQuery.maybeSingle(), getOrgLocations()]);

  const plan = (planRow as GrowthPlanRow | null) ?? EMPTY_PLAN;
  const locationLabel = effectiveLocation ? (locations.find((l) => l.id === effectiveLocation)?.name ?? "Location") : "All locations";

  const baseline = {
    customers: Number(plan.current_customers),
    avgSale: Number(plan.current_avg_sale),
    repurchaseFrequency: Number(plan.current_repurchase_frequency),
  };
  const phases = buildPhases(
    baseline,
    Number(plan.uniform_pct),
    Number(plan.target_customers_pct),
    Number(plan.target_avg_sale_pct),
    Number(plan.target_frequency_pct)
  );
  const trajectory = buildTrajectory(
    baseline,
    Number(plan.target_customers_pct),
    Number(plan.target_avg_sale_pct),
    Number(plan.target_frequency_pct),
    12
  );

  const hasNumbers = baseline.customers > 0 && baseline.avgSale > 0 && baseline.repurchaseFrequency > 0;

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Revenue Growth Planner</h1>
          <p className="text-base text-muted">
            Total revenue = customers × average sale × repurchase frequency. Small gains in each compound into a much
            bigger total.
          </p>
        </div>
        {!canEdit && <Pill>View only</Pill>}
      </div>

      <div className="bg-brick-tint border border-[#CFE0FF] rounded-2xl p-6">
        <p className="text-sm text-brick-dark leading-relaxed">
          Most operators try to grow revenue by chasing one big number — more covers, a bigger check, a busier
          Saturday. This tool shows why that&apos;s the hard way: revenue is really three numbers multiplied
          together, so a <strong>10% lift in each</strong> compounds into a <strong>33% total gain</strong>, not
          30%. Enter your real numbers below, see exactly what a modest, sustainable push in each lever is worth,
          and set a target you can actually hold your team to — by location or across the whole group.
        </p>
      </div>

      {canEdit ? (
        <GrowthPlanForm
          locationId={effectiveLocation}
          locationLabel={locationLabel}
          initial={{
            frequency: plan.frequency,
            currentCustomers: Number(plan.current_customers),
            currentAvgSale: Number(plan.current_avg_sale),
            currentRepurchaseFrequency: Number(plan.current_repurchase_frequency),
            uniformPct: Number(plan.uniform_pct),
            targetCustomersPct: Number(plan.target_customers_pct),
            targetAvgSalePct: Number(plan.target_avg_sale_pct),
            targetFrequencyPct: Number(plan.target_frequency_pct),
          }}
        />
      ) : (
        <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-4">Your numbers — {locationLabel}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            <div>
              <div className="text-[13px] text-muted mb-1">Current # of customers</div>
              <div className="text-lg font-semibold text-ink tabular-nums">{baseline.customers}</div>
            </div>
            <div>
              <div className="text-[13px] text-muted mb-1">Current average $ per sale</div>
              <div className="text-lg font-semibold text-ink tabular-nums">${baseline.avgSale}</div>
            </div>
            <div>
              <div className="text-[13px] text-muted mb-1">Current repurchase frequency</div>
              <div className="text-lg font-semibold text-ink tabular-nums">{baseline.repurchaseFrequency}</div>
            </div>
          </div>
        </div>
      )}

      {!hasNumbers ? (
        <div className="bg-paper border border-line rounded-2xl p-10 text-center">
          <p className="text-sm text-muted">Enter your current numbers above to see your growth plan and projections.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-line">
                  {["Plan", "Customers", "Avg $ per sale", "Repurchase freq.", "Total", "vs. current"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[phases.current, phases.uniform, phases.target].map((p, i) => (
                  <tr key={p.label} className="border-b border-line last:border-b-0">
                    <td className="px-5 py-3.5 font-semibold text-ink">{p.label}</td>
                    <td className="px-5 py-3.5 text-muted tabular-nums">{p.customers.toFixed(1)}</td>
                    <td className="px-5 py-3.5 text-muted tabular-nums">${p.avgSale.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-muted tabular-nums">{p.repurchaseFrequency.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-ink font-semibold tabular-nums">
                      ${p.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums">
                      {i === 0 ? <span className="text-muted-2">—</span> : <span className="text-[#15803D] font-semibold">+{p.pctIncreaseVsBase.toFixed(1)}%</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <PhaseComparisonChart phases={[phases.current, phases.uniform, phases.target]} />
            <TrajectoryChart points={trajectory} frequency={plan.frequency} />
          </div>
        </>
      )}

      {isSuperAdmin && locations.length > 1 && (
        <p className="text-[13px] text-muted">
          Switch locations with the selector in the top bar — pick a location for its own plan, or &quot;All locations&quot; for an org-wide plan.
        </p>
      )}
    </>
  );
}
