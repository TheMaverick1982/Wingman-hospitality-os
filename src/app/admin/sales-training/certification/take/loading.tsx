import { Loader2 } from "lucide-react";

// Shown instantly while the take page loads — which, the first time after the
// playbook changes, includes generating a fresh test from the AI (~10-20s).
export default function Loading() {
  return (
    <div className="max-w-xl bg-white border border-line rounded-2xl p-8 shadow-sm flex items-center gap-4">
      <Loader2 size={22} className="text-brick animate-spin shrink-0" />
      <div>
        <div className="text-[15px] font-semibold text-ink">Building your test…</div>
        <div className="text-[13px] text-muted mt-0.5">Generating fresh questions from the current playbook. This can take up to 20 seconds the first time.</div>
      </div>
    </div>
  );
}
