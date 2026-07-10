import { LineChart } from "lucide-react";
import { getGaMeasurementId } from "@/lib/data/platform-settings";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { ga4Configured, getAnalytics, type AnalyticsData } from "@/lib/ga4";
import { GaSettingsForm } from "./ga-settings-form";
import { AnalyticsDashboard } from "./analytics-dashboard";

export const maxDuration = 60;

const REPORT_DAYS = 28;

export default async function AdminAnalyticsPage() {
  await requirePlatformSection("analytics");
  const gaMeasurementId = await getGaMeasurementId();

  let data: AnalyticsData | null = null;
  let loadError: string | null = null;
  if (ga4Configured()) {
    try {
      data = await getAnalytics(REPORT_DAYS);
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

      {data ? (
        <AnalyticsDashboard data={data} days={REPORT_DAYS} />
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
