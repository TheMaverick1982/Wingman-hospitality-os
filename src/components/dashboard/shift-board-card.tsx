import Link from "next/link";
import { Megaphone } from "lucide-react";
import { KIND_LABEL } from "@/lib/shift-board";
import type { ShiftNote } from "@/lib/shift-board-data";

const KIND_TONE: Record<string, string> = {
  eightysix: "bg-danger-tint text-danger",
  staffing: "bg-gold-tint text-[#b45309]",
  note: "bg-brick-tint text-brick-dark",
};

// "Today on shift" — the day's board on everyone's dashboard. Renders nothing
// when the board is empty so it never sits blank.
export function ShiftBoardCard({ notes }: { notes: ShiftNote[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[16px] font-semibold tracking-[-0.01em] text-ink flex items-center gap-2">
          <Megaphone size={16} className="text-brick" /> Today on shift
        </div>
        <Link href="/shift" className="text-[12.5px] font-semibold text-charcoal-2 hover:text-brick">Open board</Link>
      </div>
      <div className="flex flex-col gap-2">
        {notes.map((n) => (
          <div key={n.id} className="flex items-start gap-2.5">
            <span className={`shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5 ${KIND_TONE[n.kind] ?? KIND_TONE.note}`}>
              {KIND_LABEL[n.kind] ?? "Note"}
            </span>
            <span className="text-[14px] text-ink leading-snug whitespace-pre-wrap">{n.body}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
