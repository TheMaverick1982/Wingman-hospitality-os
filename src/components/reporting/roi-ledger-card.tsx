import Link from "next/link";
import { TrendingUp, AlertTriangle, ArrowRight } from "lucide-react";
import { type RoiLedger, formatMoney } from "@/lib/roi-ledger";

// The money translation of their guest work: value captured (regulars won back)
// vs. value on the table (one-and-done first-timers). Ties each side to the
// action that moves it.
export function RoiLedgerCard({ roi }: { roi: RoiLedger }) {
  const hasData = roi.returnedRegulars > 0 || roi.atRiskFirstTimers > 0;

  return (
    <div className="bg-white border border-line rounded-[20px] p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp size={17} className="text-olive" />
        <h2 className="text-[17px] font-bold text-ink">Your retention ROI</h2>
      </div>
      <p className="text-[13px] text-muted mb-5 max-w-2xl">
        Dollars tied to the guest work you&rsquo;ve actually logged — and what&rsquo;s still on the table. Uses your
        average check{roi.usingDefaultCheck ? " (a default until you set yours)" : ""} and the same model as our public ROI calculator.
      </p>

      {!hasData ? (
        <div className="bg-paper border border-line rounded-2xl p-5 text-[13.5px] text-muted">
          Start logging first-time guests in <Link href="/bounceback" className="text-brick font-semibold">Guest Bounce Back</Link> and
          this fills in with the real dollar value of the regulars you bring back.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Captured */}
          <div className="bg-olive-tint rounded-2xl p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#4d7c0f]">Value you&rsquo;ve captured</div>
            <div className="text-[30px] font-bold text-[#3f6212] tabular-nums leading-tight mt-1">{formatMoney(roi.capturedAnnual)}<span className="text-[15px] font-semibold text-[#4d7c0f]">/yr</span></div>
            <p className="text-[12.5px] text-[#4d7c0f] mt-1.5 leading-snug">
              {roi.returnedRegulars} first-timer{roi.returnedRegulars === 1 ? "" : "s"} you&rsquo;ve turned into repeat guests, each worth ~{formatMoney(roi.perRegularAnnual)}/yr. This is the system working.
            </p>
          </div>

          {/* On the table */}
          <div className="bg-gold-tint rounded-2xl p-5">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[#B45309]">
              <AlertTriangle size={13} /> On the table
            </div>
            <div className="text-[30px] font-bold text-[#92400e] tabular-nums leading-tight mt-1">{formatMoney(roi.atRiskAnnual)}<span className="text-[15px] font-semibold text-[#B45309]">/yr</span></div>
            <p className="text-[12.5px] text-[#B45309] mt-1.5 leading-snug">
              {roi.atRiskFirstTimers} one-and-done first-timer{roi.atRiskFirstTimers === 1 ? "" : "s"} who haven&rsquo;t come back. Convert even {Math.round(roi.convertShare * 100)}% and that&rsquo;s <strong>{formatMoney(roi.convertUpsideAnnual)}/yr</strong>.
            </p>
          </div>
        </div>
      )}

      {roi.atRiskFirstTimers > 0 && (
        <Link
          href="/bounceback"
          className="mt-4 flex items-center gap-3 rounded-xl px-4 py-3 bg-brick-tint hover:brightness-[0.98] transition-[filter]"
        >
          <span className="text-[13px] text-brick-dark flex-1">
            <span className="font-semibold">Your move:</span> work the win-back list in Guest Bounce Back — a text or a small offer brings a chunk of these back.
          </span>
          <ArrowRight size={15} className="text-brick-dark shrink-0" />
        </Link>
      )}

      {roi.usingDefaultCheck && hasData && (
        <p className="text-[11.5px] text-muted-2 mt-3">
          Using a ${roi.avgCheck} average check. <Link href="/growth" className="text-brick font-semibold">Set your real check</Link> in the Revenue Growth Planner to sharpen these numbers.
        </p>
      )}
    </div>
  );
}
