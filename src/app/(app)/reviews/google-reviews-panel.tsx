"use client";

import { useState, useTransition } from "react";
import { Star, RefreshCw, Sparkles, Link2, ChevronDown, TrendingUp, ThumbsUp, AlertTriangle, X } from "lucide-react";
import {
  listConnectableGoogleLocations,
  connectGoogleLocation,
  refreshGoogleLocation,
  disconnectGoogleLocation,
  type ConnectableLocation,
} from "./google-actions";

export type ReviewInsightLite = {
  headline: string;
  sentiment: "excellent" | "strong" | "mixed" | "needs_attention";
  strengths: string[];
  improvements: string[];
  themes: { label: string; sentiment: "positive" | "negative" | "mixed"; mentions: number }[];
  actions: string[];
  trend: string;
};
export type GoogleLocationRow = {
  locationId: string;
  locationName: string;
  connected: boolean;
  title: string | null;
  averageRating: number | null;
  reviewCount: number;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  insight: ReviewInsightLite | null;
  insightGeneratedAt: string | null;
};
export type GoogleReviewLite = { id: string; reviewerName: string; stars: number; comment: string; reply: string | null; createdAt: string | null };

const SENTIMENT_LABEL: Record<ReviewInsightLite["sentiment"], { label: string; cls: string }> = {
  excellent: { label: "Excellent", cls: "bg-olive-tint text-[#4d7c0f]" },
  strong: { label: "Strong", cls: "bg-brick-tint text-brick-dark" },
  mixed: { label: "Mixed", cls: "bg-[#FDF3E1] text-[#B45309]" },
  needs_attention: { label: "Needs attention", cls: "bg-[#FEECEC] text-danger" },
};

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={13} className={i <= Math.round(n) ? "fill-[#F5A623] text-[#F5A623]" : "text-line-strong"} />
      ))}
    </span>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function GoogleReviewsPanel({
  configured,
  accountEmail,
  rows,
  reviewsByLocation,
  canManage,
}: {
  configured: boolean;
  accountEmail: string | null;
  rows: GoogleLocationRow[];
  reviewsByLocation: Record<string, GoogleReviewLite[]>;
  canManage: boolean;
}) {
  const connectedCount = rows.filter((r) => r.connected).length;

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-1">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
        <h2 className="text-[15px] font-semibold text-ink">Google reviews</h2>
      </div>
      <p className="text-[13px] text-muted mb-4 max-w-[680px]">
        Connect your Google Business Profile and Wingman pulls each location&rsquo;s reviews, then reads them for you — what guests love, where to improve, and concrete next moves. Refreshes weekly.
      </p>

      {!configured && (
        <div className="rounded-xl border border-line bg-paper px-4 py-3 text-[13px] text-muted-2">
          The Google reviews integration isn&rsquo;t switched on for your account yet. It&rsquo;ll appear here once it&rsquo;s enabled.
        </div>
      )}

      {configured && !accountEmail && canManage && (
        <a
          href="/api/integrations/google-business/connect"
          className="inline-flex items-center gap-2 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors"
        >
          <Link2 size={15} /> Connect Google
        </a>
      )}
      {configured && !accountEmail && !canManage && (
        <div className="rounded-xl border border-line bg-paper px-4 py-3 text-[13px] text-muted-2">No Google account connected yet. Ask an owner to connect it.</div>
      )}

      {configured && accountEmail && (
        <>
          <div className="text-[12.5px] text-muted-2 mb-3">
            Connected as <span className="font-medium text-charcoal-2">{accountEmail}</span> · {connectedCount} location{connectedCount === 1 ? "" : "s"} linked
          </div>
          <div className="flex flex-col gap-4">
            {rows.map((r) => (
              <LocationCard key={r.locationId} row={r} reviews={reviewsByLocation[r.locationId] ?? []} canManage={canManage} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function LocationCard({ row, reviews, canManage }: { row: GoogleLocationRow; reviews: GoogleReviewLite[]; canManage: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [options, setOptions] = useState<ConnectableLocation[] | null>(null);
  const [showReviews, setShowReviews] = useState(false);

  function openPicker() {
    setError(null);
    setPicking(true);
    start(async () => {
      const res = await listConnectableGoogleLocations();
      if (res.error) { setError(res.error); setPicking(false); return; }
      setOptions(res.locations ?? []);
    });
  }
  function choose(o: ConnectableLocation) {
    setError(null);
    start(async () => {
      const res = await connectGoogleLocation({ locationId: row.locationId, accountRowId: o.accountRowId, googleAccountId: o.googleAccountId, googleLocationId: o.googleLocationId, title: o.title });
      if (res.error) setError(res.error);
      setPicking(false);
    });
  }
  function refresh() {
    setError(null);
    start(async () => {
      const res = await refreshGoogleLocation(row.locationId);
      if (res.error) setError(res.error);
    });
  }
  function disconnect() {
    if (!confirm(`Disconnect Google reviews for ${row.locationName}? Cached reviews are removed; you can reconnect anytime.`)) return;
    start(async () => { await disconnectGoogleLocation(row.locationId); });
  }

  const ins = row.insight;

  return (
    <div className="rounded-2xl border border-line bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-ink">{row.locationName}</div>
          {row.connected ? (
            <div className="flex items-center gap-2 mt-0.5 text-[13px] text-muted-2">
              {row.averageRating != null && (<><span className="font-semibold text-ink tabular-nums">{row.averageRating.toFixed(1)}</span><Stars n={row.averageRating} /></>)}
              <span>· {row.reviewCount} review{row.reviewCount === 1 ? "" : "s"}</span>
              {ins && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${SENTIMENT_LABEL[ins.sentiment].cls}`}>{SENTIMENT_LABEL[ins.sentiment].label}</span>}
            </div>
          ) : (
            <div className="text-[13px] text-muted-2 mt-0.5">Not linked to a Google location yet.</div>
          )}
          {row.connected && <div className="text-[11.5px] text-muted-2 mt-0.5">Updated {timeAgo(row.lastSyncedAt)}{row.title ? ` · ${row.title}` : ""}</div>}
        </div>
        {canManage && (
          <div className="flex items-center gap-1.5 shrink-0">
            {row.connected ? (
              <>
                <button type="button" onClick={refresh} disabled={pending} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-charcoal-2 border border-line rounded-full px-3 py-1.5 hover:border-brick hover:text-brick disabled:opacity-50">
                  <RefreshCw size={13} className={pending ? "animate-spin" : ""} /> {pending ? "Syncing…" : "Refresh"}
                </button>
                <button type="button" onClick={disconnect} disabled={pending} className="text-muted-2 hover:text-danger p-1" title="Disconnect"><X size={15} /></button>
              </>
            ) : (
              <button type="button" onClick={openPicker} disabled={pending} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark disabled:opacity-50">
                <Link2 size={13} /> {pending ? "Loading…" : "Link a Google location"}
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-[12.5px] text-danger mt-2">{error}</p>}
      {row.lastSyncStatus && row.lastSyncStatus.startsWith("error") && !error && (
        <p className="text-[12.5px] text-danger mt-2">Last sync failed: {row.lastSyncStatus.replace(/^error:\s*/, "")}</p>
      )}

      {/* Location picker */}
      {picking && options && (
        <div className="mt-3 rounded-xl border border-line bg-paper p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12.5px] font-semibold text-ink">Which Google location is {row.locationName}?</div>
            <button onClick={() => setPicking(false)} className="text-muted-2 hover:text-ink"><X size={14} /></button>
          </div>
          {options.length === 0 ? (
            <p className="text-[12.5px] text-muted-2">No Google Business locations found on the connected account.</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto">
              {options.map((o) => (
                <button key={`${o.googleAccountId}/${o.googleLocationId}`} onClick={() => choose(o)} disabled={pending} className="text-left rounded-lg border border-line bg-white px-3 py-2 hover:border-brick disabled:opacity-50">
                  <div className="text-[13px] font-semibold text-ink">{o.title}</div>
                  {o.address && <div className="text-[11.5px] text-muted-2">{o.address}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI insight */}
      {row.connected && ins && (
        <div className="mt-3 rounded-xl border border-brick/20 bg-brick-tint/20 p-4">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-brick-dark mb-1.5"><Sparkles size={13} /> Wingman&rsquo;s read</div>
          <p className="text-[14px] text-ink font-medium mb-3">{ins.headline}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ins.strengths.length > 0 && (
              <InsightList icon={<ThumbsUp size={13} className="text-[#4d7c0f]" />} title="What guests love" items={ins.strengths} />
            )}
            {ins.improvements.length > 0 && (
              <InsightList icon={<AlertTriangle size={13} className="text-[#B45309]" />} title="Where to improve" items={ins.improvements} />
            )}
          </div>
          {ins.actions.length > 0 && (
            <div className="mt-3">
              <div className="text-[12px] font-semibold text-ink mb-1">Do this next</div>
              <ul className="list-disc pl-5 text-[13px] text-charcoal-2 space-y-0.5">{ins.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          {ins.themes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ins.themes.map((t, i) => (
                <span key={i} className={`text-[11.5px] font-medium px-2 py-0.5 rounded-full border ${t.sentiment === "positive" ? "border-olive/30 bg-olive-tint/40 text-[#4d7c0f]" : t.sentiment === "negative" ? "border-danger/20 bg-[#FEECEC] text-danger" : "border-line bg-paper text-muted-2"}`}>
                  {t.label}{t.mentions ? ` · ${t.mentions}` : ""}
                </span>
              ))}
            </div>
          )}
          {ins.trend && (
            <div className="mt-3 flex items-start gap-1.5 text-[12.5px] text-muted-2"><TrendingUp size={13} className="mt-0.5 shrink-0" /><span>{ins.trend}</span></div>
          )}
        </div>
      )}
      {row.connected && !ins && row.reviewCount > 0 && (
        <p className="text-[12.5px] text-muted-2 mt-3">Reviews synced — the AI read will appear on the next refresh.</p>
      )}
      {row.connected && row.reviewCount === 0 && row.lastSyncedAt && (
        <p className="text-[12.5px] text-muted-2 mt-3">No reviews on this Google location yet.</p>
      )}

      {/* Recent reviews */}
      {row.connected && reviews.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowReviews((v) => !v)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brick hover:text-brick-dark">
            <ChevronDown size={14} className={showReviews ? "rotate-180 transition-transform" : "transition-transform"} /> {showReviews ? "Hide" : "Show"} recent reviews
          </button>
          {showReviews && (
            <div className="mt-2 flex flex-col gap-2.5">
              {reviews.map((rv) => (
                <div key={rv.id} className="rounded-lg border border-line bg-paper/50 p-3">
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <Stars n={rv.stars} />
                    <span className="font-semibold text-ink">{rv.reviewerName}</span>
                    <span className="text-muted-2">· {timeAgo(rv.createdAt)}</span>
                  </div>
                  {rv.comment && <p className="text-[13px] text-charcoal-2 mt-1 whitespace-pre-line">{rv.comment}</p>}
                  {rv.reply && <p className="text-[12px] text-muted-2 mt-1.5 pl-3 border-l-2 border-line"><span className="font-semibold">Your reply:</span> {rv.reply}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InsightList({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink mb-1">{icon} {title}</div>
      <ul className="list-disc pl-5 text-[13px] text-charcoal-2 space-y-0.5">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
    </div>
  );
}
