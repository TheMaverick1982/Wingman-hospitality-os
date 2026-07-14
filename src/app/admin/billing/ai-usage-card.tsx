import { Sparkles } from "lucide-react";
import type { AiUsageSummary } from "@/lib/admin/ai-usage";

const usd = (n: number) => `$${n.toFixed(n > 0 && n < 1 ? 4 : 2)}`;
const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// Platform-wide Anthropic (Claude) usage + cost, overall and per client. Reads
// from the append-only ai_usage_events ledger — every AI feature records its
// token usage there. Costs are computed at Anthropic's standard list price.
export function AiUsageCard({ summary }: { summary: AiUsageSummary }) {
  const { total, last30, byOrg, truncated } = summary;

  return (
    <div className="bg-white border border-line rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={17} className="text-brick" />
        <h2 className="text-[17px] font-semibold text-ink">AI usage &amp; cost</h2>
      </div>
      <p className="text-sm text-muted mb-5">
        What Wingman&rsquo;s AI features cost in Anthropic (Claude) API spend — overall and by client. Estimated at
        standard list pricing; your Anthropic invoice is the source of truth.
      </p>

      {total.calls === 0 ? (
        <p className="text-sm text-muted">No AI usage recorded yet. Numbers appear here as customers use AI features.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Stat label="Cost — all time" value={usd(total.costUsd)} />
            <Stat label="Cost — last 30 days" value={usd(last30.costUsd)} />
            <Stat label="AI calls — all time" value={compact(total.calls)} />
            <Stat label="Tokens — all time" value={`${compact(total.inputTokens)} in · ${compact(total.outputTokens)} out`} />
          </div>

          <div className="text-xs font-semibold uppercase tracking-wide text-muted-2 mb-2">By client</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-2 border-b border-line">
                  <th className="py-2 pr-3 font-semibold">Client</th>
                  <th className="py-2 px-3 font-semibold text-right">Calls</th>
                  <th className="py-2 px-3 font-semibold text-right">Input</th>
                  <th className="py-2 px-3 font-semibold text-right">Output</th>
                  <th className="py-2 pl-3 font-semibold text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {byOrg.map((r) => (
                  <tr key={r.orgId ?? "__internal__"} className="border-b border-line/60 last:border-0">
                    <td className="py-2 pr-3 text-ink">
                      {r.orgName}
                      {!r.orgId && <span className="ml-2 text-[11px] text-muted-2">not billable to a client</span>}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-charcoal-2">{compact(r.calls)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-charcoal-2">{compact(r.inputTokens)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-charcoal-2">{compact(r.outputTokens)}</td>
                    <td className="py-2 pl-3 text-right tabular-nums font-semibold text-ink">{usd(r.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {truncated && (
            <p className="text-[12px] text-muted-2 mt-3">
              Showing the most recent 100,000 events — totals may understate all-time usage.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-2">{label}</div>
      <div className="text-lg font-bold text-ink mt-1 tabular-nums">{value}</div>
    </div>
  );
}
