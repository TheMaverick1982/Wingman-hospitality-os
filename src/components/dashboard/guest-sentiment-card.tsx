import { Star } from "lucide-react";
import type { GuestSentiment } from "@/lib/guest-sentiment";

// "How guests are feeling" — a dashboard card for the whole team. Shows the
// average rating and recent positive shout-outs (server first name). Renders
// nothing until there's feedback, so it never sits empty.
export function GuestSentimentCard({ sentiment }: { sentiment: GuestSentiment }) {
  if (sentiment.count === 0) return null;
  const rounded = Math.round(sentiment.avg);

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[16px] font-semibold tracking-[-0.01em] text-ink">How guests are feeling</div>
        <span className="text-[12px] text-muted-2 tabular-nums">{sentiment.count} recent</span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-[30px] font-bold text-ink tabular-nums leading-none">{sentiment.avg.toFixed(1)}</span>
        <span className="inline-flex items-center gap-0.5" aria-label={`${sentiment.avg.toFixed(1)} out of 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={16} className={n <= rounded ? "text-gold fill-gold" : "text-line"} strokeWidth={2} />
          ))}
        </span>
        <span className="text-[13px] text-muted-2">avg from guests</span>
      </div>

      {sentiment.shoutouts.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2">Guest shout-outs</div>
          {sentiment.shoutouts.map((s, i) => (
            <div key={i} className="rounded-xl bg-olive-tint/50 border border-olive/20 p-3">
              {s.comment ? (
                <div className="text-[13.5px] text-charcoal-2 leading-snug italic">&ldquo;{s.comment}&rdquo;</div>
              ) : (
                <div className="text-[13.5px] text-charcoal-2 leading-snug">A guest left a 5-star review.</div>
              )}
              <div className="text-[12px] font-semibold text-olive mt-1">🎉 Nice work, {s.server}!</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
