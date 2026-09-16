"use client";

import { useState, useTransition } from "react";
import { Sparkles, Mail } from "lucide-react";
import { setCultureRecapEnabled, previewCultureRecap } from "./actions";

// Render **bold** markers inline without dangerouslySetInnerHTML.
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
    seg.startsWith("**") && seg.endsWith("**") ? <strong key={i} className="text-ink">{seg.slice(2, -2)}</strong> : <span key={i}>{seg}</span>,
  );
}

export function CultureRecapCard({ enabled: initialEnabled }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [savingToggle, startToggle] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  const [monthLabel, setMonthLabel] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();

  function toggle(next: boolean) {
    setEnabled(next);
    startToggle(async () => {
      const res = await setCultureRecapEnabled(next);
      if (res.error) setEnabled(!next);
    });
  }

  function preview() {
    setPreviewError(null);
    startPreview(async () => {
      const res = await previewCultureRecap();
      if (res.error) setPreviewError(res.error);
      else {
        setSummary(res.summary ?? "");
        setMonthLabel(res.monthLabel ?? null);
      }
    });
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Mail size={16} className="text-brick shrink-0" />
            <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Monthly culture recap</div>
          </div>
          <p className="text-[13px] text-muted max-w-xl">
            On the 1st, Wingman AI-writes a recap of the month&rsquo;s recognition, the anonymous team pulse (and its
            trend), and the experiments you ran — and emails it to you and your managers. The month, on one page.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={savingToggle}
          onClick={() => toggle(!enabled)}
          className={`relative shrink-0 mt-1 h-6 w-11 rounded-full transition-colors disabled:opacity-60 ${enabled ? "bg-brick" : "bg-line-strong"}`}
        >
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : ""}`} />
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-line">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[13px] text-muted-2">See what this month&rsquo;s recap would say.</span>
          <button
            type="button"
            onClick={preview}
            disabled={previewing}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick border border-brick/40 rounded-full px-3 py-1.5 hover:bg-brick-tint disabled:opacity-50"
          >
            <Sparkles size={13} /> {previewing ? "Writing recap…" : summary ? "Refresh preview" : "Preview recap"}
          </button>
        </div>
        {previewError && <p className="text-sm text-danger mt-2">{previewError}</p>}
        {summary && (
          <div className="mt-3 rounded-xl bg-paper border border-line p-4">
            {monthLabel && <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2 mb-2">{monthLabel}</div>}
            <div className="text-[14px] text-charcoal-2 leading-relaxed flex flex-col gap-1">
              {summary.split("\n").filter((l) => l.trim()).map((line, i) => (
                <div key={i}>{renderInline(line)}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
