import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations } from "@/lib/data/locations";
import { getSectionAccess } from "@/lib/auth/permissions";
import { stageOf, type GuestWithVisits } from "@/lib/hospitality";
import { StatTile } from "@/components/ui/stat-tile";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { Heart, RotateCcw, Receipt, GraduationCap, AlertTriangle, Briefcase } from "lucide-react";
import { ScheduleReportModalButton } from "./schedule-report-modal";
import { deleteReportSchedule } from "./actions";

const RANGES = [
  { key: "7d", label: "7D", days: 7, rangeLabel: "last 7 days" },
  { key: "30d", label: "30D", days: 30, rangeLabel: "last 30 days" },
  { key: "qtr", label: "Quarter", days: 90, rangeLabel: "this quarter" },
] as const;

function cutoffDate(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

export default async function ReportingPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "reporting") === "none") redirect("/dashboard");
  const isSuperAdmin = profile.accessRole === "super_admin";

  const { range: rangeParam } = await searchParams;
  const activeRange = RANGES.find((r) => r.key === rangeParam) ?? RANGES[1];
  const cutoff = cutoffDate(activeRange.days);

  const supabase = await createClient();
  const [
    { data: discounts },
    { data: spotChecks },
    { data: signoffs },
    { data: momentCount },
    { data: candidates },
    { data: guests },
    { data: schedules },
    locations,
  ] = await Promise.all([
    supabase.from("discounts").select("amount, location_id").gte("occurred_on", cutoff),
    supabase.from("spot_checks").select("scores, location_id").gte("occurred_on", cutoff),
    supabase.from("training_signoffs").select("id").gte("occurred_on", cutoff),
    supabase.from("culture_moments").select("id").gte("occurred_on", cutoff),
    supabase.from("candidates").select("id, recommendation").gte("occurred_on", cutoff),
    supabase.from("guests").select("id, referred_a_friend, guest_visits(visit_number, visit_date, location_id, reaction)"),
    supabase.from("report_schedules").select("*").order("created_at", { ascending: false }),
    getOrgLocations(),
  ]);

  const discountTotal = (discounts ?? []).reduce((s, d) => s + Number(d.amount), 0);
  const spotCheckAvg = spotChecks?.length
    ? spotChecks.reduce((s, sc) => s + sc.scores.reduce((a: number, b: number) => a + b, 0) / sc.scores.length, 0) / spotChecks.length
    : 0;
  const strongFitCount = (candidates ?? []).filter((c) => c.recommendation === "Strong fit").length;

  const allGuests = (guests ?? []) as (GuestWithVisits & { referred_a_friend?: boolean })[];
  const newGuestsInRange = allGuests.filter((g) =>
    g.guest_visits.some((v) => v.visit_number === 1 && v.visit_date && v.visit_date >= cutoff)
  );
  const returnedCount = newGuestsInRange.filter((g) => stageOf(g.guest_visits) >= 2).length;
  const retentionPct = newGuestsInRange.length > 0 ? Math.round((returnedCount / newGuestsInRange.length) * 100) : 0;

  const visitsInRange = allGuests.flatMap((g) => g.guest_visits).filter((v) => v.visit_date && v.visit_date >= cutoff);
  const positiveReactions = visitsInRange.filter((v) => v.reaction === "wowed" || v.reaction === "delighted").length;
  const flatReactions = visitsInRange.filter((v) => v.reaction === "neutral" || v.reaction === "let_down").length;
  const reactionRatioLabel = flatReactions > 0 ? `${(positiveReactions / flatReactions).toFixed(1)}:1` : positiveReactions > 0 ? "∞" : "—";

  const referredCount = allGuests.filter((g) => g.referred_a_friend).length;
  const referralRate = allGuests.length > 0 ? Math.round((referredCount / allGuests.length) * 100) : 0;

  const byLocation = locations.map((loc) => {
    const locDiscounts = (discounts ?? []).filter((d) => d.location_id === loc.id);
    const locGuests = newGuestsInRange.filter((g) => g.guest_visits.find((v) => v.visit_number === 1)?.location_id === loc.id);
    const locReturned = locGuests.filter((g) => stageOf(g.guest_visits) >= 2).length;
    const locSpotChecks = (spotChecks ?? []).filter((sc) => sc.location_id === loc.id);
    const locSpotCheckAvg = locSpotChecks.length
      ? locSpotChecks.reduce((s, sc) => s + sc.scores.reduce((a: number, b: number) => a + b, 0) / sc.scores.length, 0) / locSpotChecks.length
      : null;
    return {
      name: loc.name,
      discountTotal: locDiscounts.reduce((s, d) => s + Number(d.amount), 0),
      retentionPct: locGuests.length > 0 ? Math.round((locReturned / locGuests.length) * 100) : 0,
      newGuests: locGuests.length,
      spotCheckAvg: locSpotCheckAvg,
    };
  });

  const sections = [
    {
      icon: Heart,
      label: "Culture",
      href: "/culture",
      iconBg: "bg-[#FCE7F0]",
      iconFg: "text-[#BE185D]",
      rows: [{ label: "Culture moments", value: momentCount?.length ?? 0 }],
    },
    {
      icon: RotateCcw,
      label: "Guest Bounce Back",
      href: "/bounceback",
      iconBg: "bg-brick-tint",
      iconFg: "text-brick",
      rows: [
        { label: "New guests", value: newGuestsInRange.length },
        { label: "Won back", value: returnedCount },
        { label: "Referrals", value: referredCount },
      ],
    },
    {
      icon: Receipt,
      label: "Service Recovery",
      href: "/recovery",
      iconBg: "bg-[#FDF3E1]",
      iconFg: "text-[#B45309]",
      rows: [
        { label: "Comps logged", value: (discounts ?? []).length },
        { label: "Total spend", value: `$${discountTotal.toFixed(0)}` },
      ],
    },
    {
      icon: GraduationCap,
      label: "Training",
      href: "/training",
      iconBg: "bg-brick-tint",
      iconFg: "text-brick",
      rows: [{ label: "Standards signed off", value: (signoffs ?? []).length }],
    },
    {
      icon: AlertTriangle,
      label: "Accountability",
      href: "/accountability",
      iconBg: "bg-[#FDF3E1]",
      iconFg: "text-[#D97706]",
      rows: [
        { label: "Spot-checks", value: (spotChecks ?? []).length },
        { label: "Avg score", value: spotCheckAvg.toFixed(1) },
      ],
    },
    {
      icon: Briefcase,
      label: "Hiring",
      href: "/hiring",
      iconBg: "bg-[#E7F6EC]",
      iconFg: "text-[#15803D]",
      rows: [
        { label: "Candidates scored", value: (candidates ?? []).length },
        { label: "Strong fits", value: strongFitCount },
      ],
    },
  ];

  return (
    <>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Reporting</h1>
          <p className="text-base text-muted">Every section, one view — {activeRange.rangeLabel}.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1 bg-white border border-line rounded-xl p-1">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/reporting?range=${r.key}`}
                className={`text-[13px] font-semibold px-3.5 py-2 rounded-[9px] transition-colors ${
                  activeRange.key === r.key ? "bg-brick text-white" : "text-charcoal-2 hover:bg-paper"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
          {isSuperAdmin && <ScheduleReportModalButton />}
          <ExportCsvButton
            filename="wingman-report.csv"
            headers={["Section", "Metric", "Value"]}
            rows={sections.flatMap((s) => s.rows.map((r) => [s.label, r.label, r.value]))}
            label="Export report"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatTile label="Repeat rate" value={`${retentionPct}%`} sub="guests back for visit 2" />
        <StatTile label="Reaction ratio" value={reactionRatioLabel} sub="positive to flat" />
        <StatTile label="Recovery spend" value={`$${discountTotal.toFixed(0)}`} sub="all reasons tagged" />
        <StatTile label="Referral rate" value={`${referralRate}%`} sub="raving-fan index" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {sections.map((s) => (
          <Link key={s.label} href={s.href}>
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow h-full">
              <div className="flex items-center gap-2.5 mb-[18px]">
                <span className={`w-[34px] h-[34px] rounded-[10px] ${s.iconBg} ${s.iconFg} flex items-center justify-center`}>
                  <s.icon size={16} />
                </span>
                <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{s.label}</span>
              </div>
              <div className="flex flex-col gap-3">
                {s.rows.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3">
                    <span className="text-[13.5px] text-muted">{row.label}</span>
                    <span className="text-[15px] font-semibold tabular-nums text-ink">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {isSuperAdmin && locations.length > 1 && (
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#F1F1F1]">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">By location</span>
            <span className="text-[13px] font-semibold text-muted">{activeRange.rangeLabel}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAFAFA] text-left">
                {["Location", "New guests", "Repeat rate", "Recovery spend", "Accountability"].map((h) => (
                  <th key={h} className="px-6 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byLocation.map((l) => (
                <tr key={l.name} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-6 py-3.5 font-medium text-ink border-b border-[#F5F5F5]">{l.name}</td>
                  <td className="px-6 py-3.5 text-muted border-b border-[#F5F5F5] tabular-nums">{l.newGuests}</td>
                  <td className="px-6 py-3.5 text-ink border-b border-[#F5F5F5] tabular-nums">{l.retentionPct}%</td>
                  <td className="px-6 py-3.5 text-ink font-semibold border-b border-[#F5F5F5] tabular-nums">${l.discountTotal.toFixed(0)}</td>
                  <td className="px-6 py-3.5 text-ink border-b border-[#F5F5F5] tabular-nums">
                    {l.spotCheckAvg !== null ? `${l.spotCheckAvg.toFixed(1)}/5` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isSuperAdmin && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-[18px]">
            <div>
              <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Scheduled reports</span>
              <div className="text-[13px] text-muted mt-0.5">Delivered to Managers and Super Admins by email.</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {(schedules ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-3.5 p-4 border border-[#EDEDED] rounded-xl">
                <span className="w-9 h-9 rounded-[10px] bg-brick-tint text-brick flex items-center justify-center text-[15px] shrink-0">🗓</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-ink capitalize">{s.frequency}</span>
                  <span className="text-xs text-muted ml-2">{s.sections.join(", ")}</span>
                  {s.recipient_emails.length > 0 && (
                    <div className="text-xs text-muted mt-0.5">To: {s.recipient_emails.join(", ")}</div>
                  )}
                </div>
                <button onClick={() => deleteReportSchedule(s.id)} className="text-muted-2 hover:text-danger text-xs font-semibold shrink-0">
                  Remove
                </button>
              </div>
            ))}
            {(schedules ?? []).length === 0 && <p className="text-sm text-muted">No scheduled reports yet.</p>}
          </div>
        </div>
      )}
    </>
  );
}
