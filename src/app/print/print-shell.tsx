"use client";

import { WingmanLogo } from "@/components/ui/wingman-logo";

// Wraps a printable document: a screen-only toolbar with a Print / Save-as-PDF
// button, and a branded header. Print CSS (in the print layout) hides the
// toolbar and sets page margins so the output is clean paper.
export function PrintShell({ title, subtitle, orgName, children }: { title: string; subtitle?: string; orgName: string; children: React.ReactNode }) {
  return (
    <div className="print-doc">
      <div className="no-print sticky top-0 flex items-center justify-between gap-3 bg-ink text-white px-5 py-3 mb-6 rounded-b-xl">
        <span className="text-[14px] font-semibold">Print preview — {title}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="text-[13px] font-semibold text-ink bg-white rounded-full px-4 py-2 hover:bg-[#efefef] transition-colors"
          >
            Print / Save as PDF
          </button>
          <button type="button" onClick={() => window.close()} className="text-[13px] font-semibold text-white/80 hover:text-white px-2">
            Close
          </button>
        </div>
      </div>

      <div className="doc-body">
        <header className="flex items-end justify-between gap-4 border-b-2 border-ink pb-4 mb-6">
          <div>
            <div className="text-[26px] font-bold tracking-[-0.02em] text-ink leading-tight">{title}</div>
            {subtitle && <div className="text-[14px] text-muted mt-1">{subtitle}</div>}
            <div className="text-[13px] text-muted-2 mt-1">{orgName}</div>
          </div>
          <WingmanLogo className="h-5 w-auto shrink-0" />
        </header>

        {children}

        <footer className="mt-10 pt-4 border-t border-line text-[11px] text-muted-2 flex justify-between">
          <span>Powered by Wingman</span>
          <span>Print it. Post it. Hold the standard.</span>
        </footer>
      </div>
    </div>
  );
}
