"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import type { AiUsageSummary } from "@/lib/admin/ai-usage";
import { aiUsageForRange } from "./ai-usage-actions";

const usd = (n: number) => `$${n.toFixed(n > 0 && n < 1 ? 4 : 2)}`;
const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const PRESETS: { key: string; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "last_month", label: "Last month" },
  { key: "last_year", label: "Last year" },
  { key: "custom", label: "Custom range" },
];

// Platform-wide Anthropic (Claude) usage + cost, overall and per client, with a
// date-range selector. Reads the append-only ai_usage_events ledger.
export function AiUsageCard({ initial }: { initial: AiUsageSummary }) {
  const [summary, setSummary] = useState<AiUsageSummary>(initial);
  const [preset, setPreset] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pending, startTransition] = useTransition();

  const activeLabel = PRESETS.find((p) => p.key === preset)?.label ?? "All time";
  const clients = summary.byOrg.filter((r) => r.orgId).length;

  function load(nextPreset: string, s = start, e = end) {
    startTransition(async () => {
      const res = await aiUsageForRange(nextPreset, s || undefined, e || undefined);
      if (res.ok) setSummary(res.summary);
    });
  }

  function onPreset(next: string) {
    setPreset(next);
    if (next !== "custom") load(next);
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div className="flex items-center gap-2">
          <Sparkles size={17} className="text-brick" />
          <h2 className="text-[17px] font-semibold text-ink">AI usage &amp; cost</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={preset}
            onChange={(e) => onPreset(e.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-charcoal-2 outline-none focus:border-brick"
          >
            {PRESETS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          {preset === "custom" && (
            <>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-charcoal-2 outline-none focus:border-brick" />
              <span className="text-[13px] text-muted-2">to</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-charcoal-2 outline-none focus:border-brick" />
              <button type="button" onClick={() => load("custom")} disabled={pending || (!start && !end)} className="text-[13px] font-semibold text-white bg-brick rounded-lg px-3 py-1.5 hover:bg-brick-dark disabled:opacity-40 transition-colors">
                Apply
              </button>
            </>
          )}
        </div>
      </div>
      <p className="text-sm text-muted mb-5">
        What Wingman&rsquo;s AI features cost in Anthropic (Claude) API spend — overall and by client. Estimated at
        standard list pricing; your Anthropic invoice is the source of truth.
      </p>

      {summary.total.calls === 0 ? (
        <p className="text-sm text-muted">{pending ? "Loading…" : `No AI usage recorded for ${activeLabel.toLowerCase()}.`}</p>
      ) : (
        <div className={pending ? "opacity-50 transition-opacity" : "transition-opacity"}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Stat label={`Cost — ${activeLabel.toLowerCase()}`} value={usd(summary.total.costUsd)} />
            <Stat label="AI calls" value={compact(summary.total.calls)} />
            <Stat label="Tokens" value={`${compact(summary.total.inputTokens)} in · ${compact(summary.total.outputTokens)} out`} />
            <Stat label="Clients using AI" value={String(clients)} />
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
                {summary.byOrg.map((r) => (
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

          {summary.truncated && (
            <p className="text-[12px] text-muted-2 mt-3">Showing the most recent 100,000 events — totals may understate usage.</p>
          )}
        </div>
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
