import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import { buildPhases, buildTrajectory, type GrowthFrequency } from "@/lib/growth-plan";
import { Pill } from "@/components/ui/pill";
import { DeleteIconButton } from "@/components/ui/delete-icon-button";
import { GrowthPlanForm } from "./growth-plan-form";
import { ActualsForm } from "./actuals-form";
import { PhaseBreakdown, PhaseComparisonChart, TrajectoryChart, ActualsChart, ActualsGrowthChart, GoalGapAnalysis } from "./growth-plan-charts";
import { deleteGrowthEntry } from "./actions";

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

type GrowthPlanEntry = {
  id: string;
  period_date: string;
  customers: number;
  avg_sale: number;
  repurchase_frequency: number;
};

const EMPTY_PLAN: GrowthPlanRow = {
  frequency: "monthly",
  current_customers: 0,
  current_avg_sale: 0,
  current_repurchase_frequency: 0,
  uniform_pct: 10,
  target_customers_pct: 10,
  target_avg_sale_pct: 10,
  target_frequency_pct: 10,
};

const TABS = [
  { key: "plan", label: "Plan" },
  { key: "track", label: "Track Actuals" },
] as const;

export default async function GrowthPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; tab?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "growth", profile.permissionOverrides) === "none") redirect("/dashboard");
  const canEdit = canEditSection(profile.accessRole, "growth", profile.permissionOverrides);
  const isSuperAdmin = profile.accessRole === "super_admin";

  const { location, tab } = await searchParams;
  const activeTab = tab === "track" ? "track" : "plan";
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
  });

  const supabase = await createClient();
  let planQuery = supabase.from("growth_plans").select("*");
  planQuery = effectiveLocation ? planQuery.eq("location_id", effectiveLocation) : planQuery.is("location_id", null);
  let entriesQuery = supabase.from("growth_plan_entries").select("id, period_date, customers, avg_sale, repurchase_frequency").order("period_date");
  entriesQuery = effectiveLocation ? entriesQuery.eq("location_id", effectiveLocation) : entriesQuery.is("location_id", null);

  const [{ data: planRow }, { data: entriesData }, locations] = await Promise.all([planQuery.maybeSingle(), entriesQuery, getOrgLocations()]);

  const plan = (planRow as GrowthPlanRow | null) ?? EMPTY_PLAN;
  const entries = (entriesData ?? []) as GrowthPlanEntry[];
  const locationLabel =
    locations.length <= 1
      ? (locations[0]?.name ?? "Your location")
      : effectiveLocation
        ? (locations.find((l) => l.id === effectiveLocation)?.name ?? "Location")
        : "All locations";

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
  const locationQs = effectiveLocation ? `&location=${effectiveLocation}` : "";

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

      <div className="flex gap-1 bg-white border border-line rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/growth?tab=${t.key}${locationQs}`}
            className={`text-[13px] font-semibold px-3.5 py-2 rounded-[9px] transition-colors ${
              activeTab === t.key ? "bg-brick text-white" : "text-charcoal-2 hover:bg-paper"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "plan" ? (
        <>
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
              <PhaseBreakdown phases={[phases.current, phases.uniform, phases.target]} />

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
      ) : (
        <>
          {canEdit && <ActualsForm locationId={effectiveLocation} frequency={plan.frequency} />}

          {entries.length > 0 && (
            <>
              <ActualsChart
                entries={entries.map((e) => ({
                  periodDate: e.period_date,
                  total: Number(e.customers) * Number(e.avg_sale) * Number(e.repurchase_frequency),
                }))}
              />
              <ActualsGrowthChart
                entries={entries.map((e) => ({
                  periodDate: e.period_date,
                  total: Number(e.customers) * Number(e.avg_sale) * Number(e.repurchase_frequency),
                }))}
              />
            </>
          )}

          {entries.length > 0 && hasNumbers && (
            <GoalGapAnalysis
              latest={{
                customers: Number(entries[entries.length - 1].customers),
                avgSale: Number(entries[entries.length - 1].avg_sale),
                repurchaseFrequency: Number(entries[entries.length - 1].repurchase_frequency),
              }}
              target={{
                customers: phases.target.customers,
                avgSale: phases.target.avgSale,
                repurchaseFrequency: phases.target.repurchaseFrequency,
              }}
            />
          )}

          <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-line">
                  {["Period", "Customers", "Avg $ per sale", "Repurchase freq.", "Total", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...entries].reverse().map((e) => {
                  const total = Number(e.customers) * Number(e.avg_sale) * Number(e.repurchase_frequency);
                  return (
                    <tr key={e.id} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-3.5 text-ink font-medium">{e.period_date}</td>
                      <td className="px-5 py-3.5 text-muted tabular-nums">{Number(e.customers)}</td>
                      <td className="px-5 py-3.5 text-muted tabular-nums">${Number(e.avg_sale).toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-muted tabular-nums">{Number(e.repurchase_frequency).toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-ink font-semibold tabular-nums">
                        ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-5 py-3.5">{canEdit && <DeleteIconButton id={e.id} action={deleteGrowthEntry} />}</td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted">
                      No {plan.frequency === "weekly" ? "weekly" : "monthly"} numbers logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
