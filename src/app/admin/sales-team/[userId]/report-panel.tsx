"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { generateRepReportAction } from "../actions";
import type { RepReport } from "@/lib/sales-cert";

export function ReportPanel({ userId, initial, initialAt }: { userId: string; initial: RepReport | null; initialAt: string | null }) {
  const [report, setReport] = useState<RepReport | null>(initial);
  const [at, setAt] = useState<string | null>(initialAt);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const run = () => {
    setErr(null);
    start(async () => {
      const res = await generateRepReportAction(userId);
      if (res.error) setErr(res.error);
      else if (res.report) { setReport(res.report); setAt(new Date().toISOString()); }
    });
  };

  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-brick" />
          <h2 className="text-[15px] font-semibold text-ink">AI coaching report</h2>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50"
        >
          {pending ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : report ? "Regenerate" : "Generate report"}
        </button>
      </div>

      {err && <p className="text-[13px] text-danger">{err}</p>}
      {!report && !err && <p className="text-[13px] text-muted-2">No report yet. Generate one from this rep&apos;s latest completed test.</p>}

      {report && (
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-charcoal-2 leading-[1.55]">{report.summary}</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#15803d] mb-1.5">Strengths</div>
              <ul className="flex flex-col gap-1.5">
                {report.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[13.5px] text-charcoal-2"><CheckCircle2 size={14} className="text-[#15803d] mt-0.5 shrink-0" />{s}</li>
                ))}
                {report.strengths.length === 0 && <li className="text-[13px] text-muted-2">—</li>}
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#b45309] mb-1.5">Gaps</div>
              <ul className="flex flex-col gap-1.5">
                {report.gaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[13.5px] text-charcoal-2"><AlertTriangle size={14} className="text-[#b45309] mt-0.5 shrink-0" />{g}</li>
                ))}
                {report.gaps.length === 0 && <li className="text-[13px] text-muted-2">—</li>}
              </ul>
            </div>
          </div>

          <div className={`rounded-xl px-4 py-3 ${report.needsMoreTraining ? "bg-gold-tint" : "bg-olive-tint"}`}>
            <div className={`text-[13px] font-semibold ${report.needsMoreTraining ? "text-[#b45309]" : "text-[#15803d]"}`}>
              {report.needsMoreTraining ? "Needs more training" : "Ready to sell"}
            </div>
            <div className="text-[13.5px] text-charcoal-2 mt-0.5">{report.recommendation}</div>
          </div>

          {at && <div className="text-[11.5px] text-muted-2">Generated {new Date(at).toLocaleString()}</div>}
        </div>
      )}
    </div>
  );
}
