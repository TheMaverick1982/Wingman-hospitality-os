import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations } from "@/lib/data/locations";
import { getSectionAccess } from "@/lib/auth/permissions";
import { stageOf, type GuestWithVisits } from "@/lib/hospitality";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { Heart, RotateCcw, Receipt, GraduationCap, AlertTriangle, Briefcase } from "lucide-react";
import { ScheduleReportModalButton } from "./schedule-report-modal";
import { deleteReportSchedule } from "./actions";

const RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "qtr", label: "Qtr", days: 90 },
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
    supabase.from("spot_checks").select("scores").gte("occurred_on", cutoff),
    supabase.from("training_signoffs").select("id").gte("occurred_on", cutoff),
    supabase.from("culture_moments").select("id").gte("occurred_on", cutoff),
    supabase.from("candidates").select("id, recommendation").gte("occurred_on", cutoff),
    supabase.from("guests").select("id, guest_visits(visit_number, visit_date, location_id)"),
    supabase.from("report_schedules").select("*").order("created_at", { ascending: false }),
    getOrgLocations(),
  ]);

  const discountTotal = (discounts ?? []).reduce((s, d) => s + Number(d.amount), 0);
  const spotCheckAvg = spotChecks?.length
    ? spotChecks.reduce((s, sc) => s + sc.scores.reduce((a: number, b: number) => a + b, 0) / sc.scores.length, 0) / spotChecks.length
    : 0;
  const strongFitCount = (candidates ?? []).filter((c) => c.recommendation === "Strong fit").length;

  const newGuestsInRange = (guests ?? []).filter((g) =>
    g.guest_visits.some((v) => v.visit_number === 1 && v.visit_date && v.visit_date >= cutoff)
  ) as GuestWithVisits[];
  const returnedCount = newGuestsInRange.filter((g) => stageOf(g.guest_visits) >= 2).length;
  const retentionPct = newGuestsInRange.length > 0 ? Math.round((returnedCount / newGuestsInRange.length) * 100) : 0;

  const byLocation = locations.map((loc) => {
    const locDiscounts = (discounts ?? []).filter((d) => d.location_id === loc.id);
    const locGuests = newGuestsInRange.filter((g) => g.guest_visits.find((v) => v.visit_number === 1)?.location_id === loc.id);
    const locReturned = locGuests.filter((g) => stageOf(g.guest_visits) >= 2).length;
    return {
      name: loc.name,
      discountTotal: locDiscounts.reduce((s, d) => s + Number(d.amount), 0),
      retentionPct: locGuests.length > 0 ? Math.round((locReturned / locGuests.length) * 100) : 0,
      newGuests: locGuests.length,
    };
  });

  const sections = [
    { icon: RotateCcw, label: "Guest Bounce Back", value: `${retentionPct}%`, sub: `${newGuestsInRange.length} new guests, ${returnedCount} returned`, href: "/bounceback" },
    { icon: Receipt, label: "Service Recovery", value: `$${discountTotal.toFixed(0)}`, sub: `${(discounts ?? []).length} discounts logged`, href: "/recovery" },
    { icon: GraduationCap, label: "Training", value: (signoffs ?? []).length, sub: "sign-offs logged", href: "/training" },
    { icon: AlertTriangle, label: "Accountability", value: spotCheckAvg.toFixed(1), sub: "avg spot-check score", href: "/accountability" },
    { icon: Heart, label: "Culture", value: (momentCount ?? []).length, sub: "moments recognized", href: "/culture" },
    { icon: Briefcase, label: "Hiring", value: (candidates ?? []).length, sub: `${strongFitCount} strong fits`, href: "/hiring" },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1 text-ink">Reporting</h1>
          <p className="text-sm text-muted max-w-xl">
            A cross-section rollup of every part of Wingman, with exports and scheduled email
            reports.
          </p>
        </div>
        {isSuperAdmin && <ScheduleReportModalButton />}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-panel border border-line rounded-lg p-1">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/reporting?range=${r.key}`}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                activeRange.key === r.key ? "bg-brick text-white" : "text-muted hover:text-ink"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
        <ExportCsvButton
          filename="wingman-report.csv"
          headers={["Section", "Value", "Detail"]}
          rows={sections.map((s) => [s.label, s.value, s.sub])}
          label="Export report"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {sections.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <s.icon size={15} className="text-brick" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</span>
              </div>
              <div className="font-mono text-2xl font-semibold text-ink">{s.value}</div>
              <div className="text-xs text-muted mt-1">{s.sub}</div>
            </Card>
          </Link>
        ))}
      </div>

      {isSuperAdmin && locations.length > 1 && (
        <>
          <h3 className="font-display text-lg font-semibold mb-3 text-ink">By location</h3>
          <div className="bg-panel border border-line rounded-2xl overflow-hidden shadow-sm mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#fafafa] border-b border-line">
                  {["Location", "New guests", "Retention", "Discounts"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byLocation.map((l) => (
                  <tr key={l.name} className="border-b border-line hover:bg-[#fafafa] transition-colors">
                    <td className="px-5 py-3.5 text-ink">{l.name}</td>
                    <td className="px-5 py-3.5 text-muted">{l.newGuests}</td>
                    <td className="px-5 py-3.5">{l.retentionPct}%</td>
                    <td className="px-5 py-3.5 text-ink font-mono">${l.discountTotal.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isSuperAdmin && (
        <>
          <h3 className="font-display text-lg font-semibold mb-3 text-ink">Scheduled reports</h3>
          <div className="flex flex-col gap-2.5">
            {(schedules ?? []).map((s) => (
              <Card key={s.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-ink capitalize">{s.frequency}</span>
                  <span className="text-xs text-muted ml-2">{s.sections.join(", ")}</span>
                  {s.recipient_emails.length > 0 && (
                    <div className="text-xs text-muted mt-0.5">To: {s.recipient_emails.join(", ")}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone="gold">Send job not yet wired up</Pill>
                  <button onClick={() => deleteReportSchedule(s.id)} className="text-muted-2 hover:text-danger text-xs">
                    Remove
                  </button>
                </div>
              </Card>
            ))}
            {(schedules ?? []).length === 0 && <p className="text-sm text-muted">No scheduled reports yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}
