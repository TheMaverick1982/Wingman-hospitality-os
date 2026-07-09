import { LineChart } from "lucide-react";
import { getGaMeasurementId } from "@/lib/data/platform-settings";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { GaSettingsForm } from "./ga-settings-form";

export default async function AdminAnalyticsPage() {
  await requirePlatformSection("analytics");
  const gaMeasurementId = await getGaMeasurementId();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Analytics</h1>
        <p className="text-sm text-muted mt-1">Site traffic and conversion metrics from Google Analytics.</p>
      </div>

      <div className="bg-white border border-line rounded-2xl p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-4">Tracking code</h2>
        <p className="text-sm text-muted mb-5 max-w-lg">
          Paste your GA4 Measurement ID (found in Google Analytics under Admin → Data Streams → your
          stream) to start tracking visits across the whole site.
        </p>
        <GaSettingsForm currentValue={gaMeasurementId} />
      </div>

      <div className="bg-white border border-line rounded-2xl p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-brick-tint flex items-center justify-center mx-auto mb-5">
          <LineChart size={22} className="text-brick" />
        </div>
        <p className="text-sm font-semibold text-ink mb-2">Metrics dashboard isn&apos;t connected yet</p>
        <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
          Traffic, signups, and conversion charts here will need a GA4 service-account connection
          to pull data via the Analytics API. The tracking code above just gets data flowing into
          your GA4 property in the meantime — view it directly on analytics.google.com.
        </p>
      </div>
    </div>
  );
}
