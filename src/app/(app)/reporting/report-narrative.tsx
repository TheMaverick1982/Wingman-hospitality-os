"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { generateReportNarrative, type NarrativeState } from "./actions";

const initial: NarrativeState = { error: null, text: null };

// On-demand AI briefing of the current report. Generated on click (not on every
// page load) so it never adds latency or cost unless the owner asks for it.
export function ReportNarrative({ snapshot }: { snapshot: string }) {
  const [state, action, pending] = useActionState(generateReportNarrative, initial);

  return (
    <div className="bg-[#0A0A0A] rounded-2xl p-6 text-white">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-[10px] bg-white/10 flex items-center justify-center text-[#4D97FF]">
            <Sparkles size={16} />
          </span>
          <span className="text-[15px] font-semibold">AI briefing</span>
        </div>
        <form action={action}>
          <input type="hidden" name="snapshot" value={snapshot} />
          <button
            type="submit"
            disabled={pending}
            className="text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark transition-colors disabled:opacity-60 inline-flex items-center gap-2"
          >
            {pending && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            {pending ? "Reading your numbers…" : state.text ? "Regenerate" : "Summarize this report"}
          </button>
        </form>
      </div>

      {state.text ? (
        <p className="text-[14.5px] leading-[1.6] text-[#e5e5e5] mt-4 whitespace-pre-wrap">{state.text}</p>
      ) : (
        <p className="text-[13.5px] text-[#a1a1a1] mt-3">
          Get a 15-second read on what moved, what&rsquo;s slipping, and the one thing to focus on this week — written from your live numbers.
        </p>
      )}
      {state.error && <p className="text-[13px] text-[#ff9b8f] mt-3">{state.error}</p>}
    </div>
  );
}
