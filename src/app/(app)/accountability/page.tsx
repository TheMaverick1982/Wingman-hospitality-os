import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { aggregateBy, computeSpotCheckAverages, stageOf, type Discount, type SpotCheck } from "@/lib/hospitality";
import { computeCoachingFlags } from "@/lib/coaching-flags";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { DailyCheckModalButton } from "./daily-check-modal";
import { SpotCheckModalButton } from "./spot-check-modal";
import { SPOT_CHECK_DIMENSIONS } from "@/lib/constants";

export default async function AccountabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const isGm = profile.accessRole === "gm";

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
  });

  const supabase = await createClient();

  let discountsQ = supabase.from("discounts").select("*");
  let spotChecksQ = supabase.from("spot_checks").select("*").order("occurred_on", { ascending: false });
  let dailyChecksQ = supabase.from("daily_checklists").select("*").order("occurred_on", { ascending: false });
  if (effectiveLocation) {
    discountsQ = discountsQ.eq("location_id", effectiveLocation);
    spotChecksQ = spotChecksQ.eq("location_id", effectiveLocation);
    dailyChecksQ = dailyChecksQ.eq("location_id", effectiveLocation);
  }

  const [{ data: discountsData }, { data: spotChecksData }, { data: dailyChecksData }, { data: guests }, locations] =
    await Promise.all([
      discountsQ,
      spotChecksQ,
      dailyChecksQ,
      supabase.from("guests").select("id, guest_visits(visit_number, visit_date, location_id, incentive, notes)"),
      getOrgLocations(),
    ]);

  const discounts = (discountsData ?? []) as Discount[];
  const spotChecks = (spotChecksData ?? []) as (SpotCheck & { id: string; department: string; occurred_on: string; felt_like_transaction: boolean; notes: string })[];
  const dailyChecks = dailyChecksData ?? [];

  const { data: org } = await supabase.from("organizations").select("total_revenue").single();
  const discountTotal = discounts.reduce((s, d) => s + Number(d.amount), 0);
  const revenue = Number(org?.total_revenue ?? 0);
  const discountPct = revenue > 0 ? ((discountTotal / revenue) * 100).toFixed(1) : "0.0";
  const byCategory = aggregateBy(discounts, (d) => d.category, (d) => Number(d.amount));
  const guestsAwaitingFollowUp = (guests ?? []).filter((g) => stageOf(g.guest_visits) === 1).length;
  const staffAverages = computeSpotCheckAverages(spotChecks);
  const flags = computeCoachingFlags({
    discountPct,
    byCategory,
    guestsAwaitingFollowUp,
    staffAverages,
    lastDailyCheck: dailyChecks[0],
  });

  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1 text-ink">Accountability</h1>
          <p className="text-sm text-muted max-w-xl">
            Standards only matter if someone checks. This is where intention becomes follow-through.
          </p>
        </div>
        <div className="flex gap-2">
          <DailyCheckModalButton
            locations={locations}
            isGm={isGm}
            lockedLocationName={profile.locationName}
            defaultLocationId={effectiveLocation ?? profile.locationId}
          />
          <SpotCheckModalButton
            locations={locations}
            isGm={isGm}
            lockedLocationName={profile.locationName}
            defaultLocationId={effectiveLocation ?? profile.locationId}
          />
        </div>
      </div>

      {flags.length > 0 ? (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-brick" />
            <h3 className="font-display text-lg font-semibold text-ink">Needs attention right now</h3>
          </div>
          <div className="flex flex-col gap-2">
            {flags.map((f, i) => (
              <div key={i} className={`flex items-start gap-2 p-3 rounded-lg ${f.tone === "brick" ? "bg-brick-tint" : "bg-gold-tint"}`}>
                <span className={`text-sm ${f.tone === "brick" ? "text-brick-dark" : "text-[#8A5D18]"}`}>{f.text}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="bg-olive-tint rounded-[10px] p-5 mb-6 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-[#354328]" />
          <span className="text-sm font-medium text-[#354328]">Nothing flagged right now — standards are holding.</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 mb-6">
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-1 text-ink">Manager daily checklist</h3>
          <p className="text-xs mb-4 text-muted">The floor-level accountability standard, logged once per shift.</p>
          <div className="flex flex-col gap-2">
            {dailyChecks.slice(0, 5).map((dc) => {
              const doneCount = dc.checked.filter(Boolean).length;
              return (
                <div key={dc.id} className="flex items-center justify-between py-2.5 text-sm border-b border-line">
                  <div>
                    <span className="font-semibold text-ink">{dc.manager_name}</span>
                    <span className="text-muted"> — {locationName(dc.location_id)} · {dc.occurred_on}</span>
                  </div>
                  <Pill tone={doneCount === dc.checked.length ? "olive" : "gold"}>
                    {doneCount}/{dc.checked.length}
                  </Pill>
                </div>
              );
            })}
            {dailyChecks.length === 0 && <p className="text-sm text-muted">No checklists logged yet.</p>}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-1 text-ink">Spot-check averages</h3>
          <p className="text-xs mb-4 text-muted">Average score across all logged observations, per staff member.</p>
          <div className="flex flex-col gap-2.5">
            {staffAverages.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-charcoal-2">{s.name}</span>
                <span className={`font-mono font-semibold ${s.avg < 3.5 ? "text-brick" : "text-olive"}`}>{s.avg.toFixed(1)} / 5</span>
              </div>
            ))}
            {staffAverages.length === 0 && <p className="text-sm text-muted">No spot-checks logged yet.</p>}
          </div>
        </Card>
      </div>

      <h3 className="font-display text-lg font-semibold mb-3 text-ink">Spot-check log</h3>
      <div className="flex flex-col gap-3">
        {spotChecks.map((sc) => {
          const avg = sc.scores.reduce((a, b) => a + b, 0) / sc.scores.length;
          return (
            <Card key={sc.id} className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{sc.staff_name}</span>
                  <Pill>{sc.department}</Pill>
                  <Pill tone={avg >= 4 ? "olive" : avg >= 3 ? "gold" : "brick"}>{avg.toFixed(1)}/5</Pill>
                </div>
                <span className="text-xs text-muted">{sc.occurred_on}</span>
              </div>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {SPOT_CHECK_DIMENSIONS.map((d, i) => (
                  <div key={d} className="text-center">
                    <div className="text-xs mb-1 leading-tight text-muted">{d}</div>
                    <div className="font-mono text-lg font-semibold text-ink">{sc.scores[i]}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-1 text-charcoal-2">{sc.notes}</p>
              <p className={`text-xs font-semibold ${sc.felt_like_transaction ? "text-brick" : "text-olive"}`}>
                {sc.felt_like_transaction ? "Felt like a transaction — run it again" : "Felt like an experience"}
              </p>
            </Card>
          );
        })}
        {spotChecks.length === 0 && <p className="text-sm text-muted">No spot-checks logged yet.</p>}
      </div>
    </div>
  );
}
