import Link from "next/link";
import { LineChart, BookOpen } from "lucide-react";
import { getGaMeasurementId } from "@/lib/data/platform-settings";
import { listPublished } from "@/lib/playbook";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { ga4Configured, getAnalytics, type AnalyticsData, type DateRange } from "@/lib/ga4";
import { GaSettingsForm } from "./ga-settings-form";
import { AnalyticsDashboard } from "./analytics-dashboard";
import { DateRangePicker } from "./date-range-picker";

export const maxDuration = 60;

const isDate = (s?: string) => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));

// Resolve the selected range from the URL: a custom start/end, else a days preset.
function resolveRange(sp: { days?: string; start?: string; end?: string }): {
  range: DateRange;
  label: string;
  preset: string;
  start: string;
  end: string;
} {
  if (isDate(sp.start) && isDate(sp.end)) {
    return { range: { startDate: sp.start!, endDate: sp.end! }, label: `${sp.start} – ${sp.end}`, preset: "custom", start: sp.start!, end: sp.end! };
  }
  const days = [7, 28, 90].includes(Number(sp.days)) ? Number(sp.days) : 28;
  return { range: { startDate: `${days}daysAgo`, endDate: "today" }, label: `Last ${days} days`, preset: String(days), start: "", end: "" };
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; start?: string; end?: string }>;
}) {
  await requirePlatformSection("analytics");
  const gaMeasurementId = await getGaMeasurementId();
  const playbookPosts = [...(await listPublished())].sort((a, b) => b.views - a.views);
  const playbookViews = playbookPosts.reduce((s, p) => s + p.views, 0);
  const { range, label, preset, start, end } = resolveRange(await searchParams);

  const connected = ga4Configured();
  let data: AnalyticsData | null = null;
  let loadError: string | null = null;
  if (connected) {
    try {
      data = await getAnalytics(range);
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Couldn't load analytics.";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Analytics</h1>
        <p className="text-sm text-muted mt-1">Site traffic and conversion metrics from Google Analytics.</p>
      </div>

      {connected && <DateRangePicker preset={preset} start={start} end={end} />}

      {data ? (
        <AnalyticsDashboard data={data} rangeLabel={label} />
      ) : (
        <div className="bg-white border border-line rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-brick-tint flex items-center justify-center mx-auto mb-5">
            <LineChart size={22} className="text-brick" />
          </div>
          {loadError ? (
            <>
              <p className="text-sm font-semibold text-ink mb-2">Couldn&apos;t load analytics</p>
              <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">{loadError}</p>
              <p className="text-[13px] text-muted-2 max-w-md mx-auto leading-relaxed mt-3">
                Check that the service account has <span className="font-semibold">Viewer</span> access to this GA4
                property, the Analytics Data API is enabled, and <span className="font-mono">GA4_PROPERTY_ID</span> is the
                numeric property id.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-ink mb-2">Metrics dashboard isn&apos;t connected yet</p>
              <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
                Add <span className="font-mono">GA4_SERVICE_ACCOUNT_JSON</span> and{" "}
                <span className="font-mono">GA4_PROPERTY_ID</span> in Vercel to pull traffic charts in here. The tracking
                code above already sends data to your GA4 property — view it on analytics.google.com meanwhile.
              </p>
            </>
          )}
        </div>
      )}

      {/* The Playbook — traffic by post (from our own view counter, no GA4 needed) */}
      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-brick" />
            <h2 className="text-[15px] font-semibold text-ink">The Playbook — traffic by post</h2>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-2">Total views</div>
            <div className="text-[20px] font-bold text-ink tabular-nums leading-tight">{playbookViews.toLocaleString()}</div>
          </div>
        </div>
        {playbookPosts.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-2">No published posts yet. Publish from The Playbook to start tracking traffic here.</div>
        ) : (
          <div className="divide-y divide-line">
            {playbookPosts.map((p) => (
              <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/playbook/${p.slug}`} target="_blank" className="text-[14px] font-semibold text-ink hover:text-brick truncate block">{p.title}</Link>
                  <div className="text-[12px] text-muted-2">{p.category}{p.publishedAt ? ` · ${new Date(p.publishedAt).toLocaleDateString()}` : ""}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[16px] font-bold text-ink tabular-nums">{p.views.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-2">view{p.views === 1 ? "" : "s"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-line rounded-2xl p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-4">Tracking code</h2>
        <p className="text-sm text-muted mb-5 max-w-lg">
          Paste your GA4 Measurement ID (found in Google Analytics under Admin → Data Streams → your
          stream) to start tracking visits across the whole site.
        </p>
        <GaSettingsForm currentValue={gaMeasurementId} />
      </div>
    </div>
  );
}
