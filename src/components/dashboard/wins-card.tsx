import Link from "next/link";
import { PartyPopper } from "lucide-react";
import type { WinRow } from "@/lib/wins-data";
import { WinCelebrate } from "@/app/(app)/culture/win-celebrate";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// "Recent wins" — the team's latest wins & shout-outs on everyone's dashboard,
// with one-tap celebrate. Renders nothing when empty so it never sits blank.
export function WinsCard({ wins }: { wins: WinRow[] }) {
  if (wins.length === 0) return null;
  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="text-[16px] font-semibold tracking-[-0.01em] text-ink flex items-center gap-2">
          <PartyPopper size={16} className="text-brick" /> Recent wins
        </div>
        <Link href="/culture" className="text-[12.5px] font-semibold text-charcoal-2 hover:text-brick">
          Share a win
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        {wins.map((w) => (
          <div key={w.id} className="flex gap-3.5 items-start">
            <span className="shrink-0 w-9 h-9 rounded-full bg-brick-tint text-brick-dark flex items-center justify-center text-[13px] font-semibold">
              {initialsOf(w.author)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm leading-[1.45]">
                <span className="font-semibold text-ink">{w.author}</span>{" "}
                <span className="text-charcoal-2">
                  {w.kind === "win" ? "shared a win" : `recognized ${w.about}`}: {w.message}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs font-semibold text-brick-dark bg-brick-tint px-2.5 py-0.5 rounded-full">{w.tag}</span>
                <WinCelebrate momentId={w.id} initialCount={w.reactions} initialReacted={w.reactedByMe} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
