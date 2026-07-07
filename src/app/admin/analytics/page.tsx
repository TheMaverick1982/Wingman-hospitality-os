import { LineChart } from "lucide-react";

export default function AdminAnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Analytics</h1>
        <p className="text-sm text-muted mt-1">Site traffic and conversion metrics from Google Analytics.</p>
      </div>

      <div className="bg-white border border-line rounded-2xl p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-brick-tint flex items-center justify-center mx-auto mb-5">
          <LineChart size={22} className="text-brick" />
        </div>
        <p className="text-sm font-semibold text-ink mb-2">Google Analytics isn&apos;t connected yet</p>
        <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
          This panel will show traffic, signups, and conversion metrics once a GA4 property ID and
          service-account credentials are added.
        </p>
      </div>
    </div>
  );
}
