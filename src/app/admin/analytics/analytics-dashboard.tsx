import type { AnalyticsData } from "@/lib/ga4";

export function AnalyticsDashboard({ data, rangeLabel }: { data: AnalyticsData; rangeLabel: string }) {
  const tiles = [
    { label: "Active users", value: data.totals.users.toLocaleString() },
    { label: "Sessions", value: data.totals.sessions.toLocaleString() },
    { label: "Page views", value: data.totals.views.toLocaleString() },
    { label: "Engagement rate", value: `${data.totals.engagementRate}%` },
  ];
  const maxDaily = Math.max(1, ...data.daily.map((d) => d.users));
  const maxPage = Math.max(1, ...data.topPages.map((p) => p.views));
  const maxChan = Math.max(1, ...data.channels.map((c) => c.sessions));

  return (
    <div className="flex flex-col gap-6">
      <div className="text-[13px] text-muted-2">{rangeLabel} · live from Google Analytics</div>

      {/* Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white border border-line rounded-2xl p-5">
            <div className="text-[28px] font-bold tracking-[-0.02em] text-ink">{t.value}</div>
            <div className="text-[13px] text-muted-2 mt-0.5">{t.label}</div>
          </div>
        ))}
      </div>

      {/* Daily users chart */}
      <div className="bg-white border border-line rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-5">Active users per day</h2>
        {data.daily.length === 0 ? (
          <p className="text-sm text-muted">No data for this period yet.</p>
        ) : (
          <div className="flex items-end gap-[3px] h-44">
            {data.daily.map((d, i) => (
              <div key={i} className="flex-1 h-full flex flex-col items-center justify-end group" title={`${d.date}: ${d.users}`}>
                {/* The count above each bar. Hidden past ~5 weeks of bars, where the
                    columns get too thin for the numbers not to collide (hover still
                    shows the exact value). */}
                {data.daily.length <= 35 && (
                  <span className="text-[10px] font-semibold text-charcoal-2 tabular-nums leading-none mb-1">{d.users}</span>
                )}
                <div
                  className="w-full rounded-t bg-brick/80 group-hover:bg-brick transition-colors"
                  style={{ height: `${Math.max(2, (d.users / maxDaily) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        )}
        {data.daily.length > 0 && (
          <div className="flex justify-between text-[11px] text-muted-2 mt-2">
            <span>{data.daily[0]?.date}</span>
            <span>{data.daily[data.daily.length - 1]?.date}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top pages */}
        <div className="bg-white border border-line rounded-2xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-4">Top pages</h2>
          <div className="flex flex-col gap-3">
            {data.topPages.length === 0 ? (
              <p className="text-sm text-muted">No data yet.</p>
            ) : (
              data.topPages.map((p) => (
                <div key={p.path}>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-[13px] text-ink truncate font-mono">{p.path}</span>
                    <span className="text-[13px] text-muted-2 shrink-0">{p.views.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-paper overflow-hidden">
                    <div className="h-full rounded-full bg-brick/70" style={{ width: `${(p.views / maxPage) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Channels */}
        <div className="bg-white border border-line rounded-2xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-4">Traffic sources</h2>
          <div className="flex flex-col gap-3">
            {data.channels.length === 0 ? (
              <p className="text-sm text-muted">No data yet.</p>
            ) : (
              data.channels.map((c) => (
                <div key={c.channel}>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-[13px] text-ink truncate">{c.channel}</span>
                    <span className="text-[13px] text-muted-2 shrink-0">{c.sessions.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-paper overflow-hidden">
                    <div className="h-full rounded-full bg-olive/60" style={{ width: `${(c.sessions / maxChan) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
