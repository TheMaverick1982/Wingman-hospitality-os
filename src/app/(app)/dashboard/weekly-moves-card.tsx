"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target, Check, Plus, Loader2, Pencil } from "lucide-react";
import { MAX_MOVES, MOVE_SUGGESTIONS, type Move } from "@/lib/weekly-moves";
import { saveWeeklyMoves, toggleWeeklyMove } from "./weekly-moves-actions";

// This week's 3-moves commitment. Owner picks up to three concrete moves; ticking
// them off through the week is the accountability. Loss-averse and finite —
// three things, not a bottomless list.
export function WeeklyMovesCard({ initialMoves, weekLabel }: { initialMoves: Move[]; weekLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(initialMoves.length === 0);
  const [drafts, setDrafts] = useState<string[]>(() => {
    const base = initialMoves.map((m) => m.text);
    while (base.length < MAX_MOVES) base.push("");
    return base.slice(0, MAX_MOVES);
  });
  const [error, setError] = useState<string | null>(null);

  const doneCount = initialMoves.filter((m) => m.done).length;

  const setDraft = (i: number, v: string) => setDrafts((d) => d.map((x, idx) => (idx === i ? v : x)));
  const fillFirstEmpty = (text: string) =>
    setDrafts((d) => {
      const i = d.findIndex((x) => x.trim() === "");
      if (i === -1) return d;
      return d.map((x, idx) => (idx === i ? text : x));
    });

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveWeeklyMoves(drafts);
      if (!res.ok) return setError(res.error ?? "Couldn't save.");
      setEditing(false);
      router.refresh();
    });
  };

  const toggle = (i: number) => {
    startTransition(async () => {
      const res = await toggleWeeklyMove(i);
      if (!res.ok) return setError(res.error ?? "Couldn't update.");
      router.refresh();
    });
  };

  const usedSuggestions = new Set(drafts.map((d) => d.trim()));

  return (
    <div className="bg-white border border-line rounded-[20px] p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Target size={17} className="text-brick" />
            <span className="text-[15px] font-bold text-ink">This week&rsquo;s 3 moves</span>
          </div>
          <p className="text-[13px] text-muted mt-0.5">
            {editing ? "Pick up to three things you'll actually get done this week." : `Week of ${weekLabel}`}
          </p>
        </div>
        {!editing && initialMoves.length > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[13px] font-semibold text-muted tabular-nums">{doneCount}/{initialMoves.length} done</span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-muted-2 hover:text-brick transition-colors"
              aria-label="Edit this week's moves"
            >
              <Pencil size={15} />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-4 flex flex-col gap-2.5">
          {drafts.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-muted-2 w-4 shrink-0">{i + 1}</span>
              <input
                value={d}
                onChange={(e) => setDraft(i, e.target.value)}
                placeholder={`Move ${i + 1}${i === 0 ? " (required)" : " (optional)"}`}
                className="flex-1 text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-brick"
              />
            </div>
          ))}

          <div className="flex flex-wrap gap-1.5 mt-1">
            {MOVE_SUGGESTIONS.filter((s) => !usedSuggestions.has(s)).slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => fillFirstEmpty(s)}
                className="flex items-center gap-1 text-[12px] text-charcoal-2 bg-paper border border-line rounded-full px-2.5 py-1 hover:border-brick transition-colors"
              >
                <Plus size={11} /> {s}
              </button>
            ))}
          </div>

          {error && <p className="text-[12.5px] text-brick-dark mt-1">{error}</p>}

          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="text-[13.5px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {pending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Lock in my 3 moves"}
            </button>
            {initialMoves.length > 0 && (
              <button type="button" onClick={() => setEditing(false)} className="text-[13.5px] font-semibold text-muted hover:text-ink">
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {initialMoves.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              disabled={pending}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 border text-left transition-colors ${
                m.done ? "bg-olive-tint border-olive/30" : "bg-paper border-line hover:border-brick"
              }`}
            >
              <span
                className={`shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center ${
                  m.done ? "bg-olive text-white" : "border-[1.5px] border-line-strong"
                }`}
              >
                {m.done && <Check size={13} strokeWidth={3} />}
              </span>
              <span className={`text-[14px] ${m.done ? "text-muted line-through" : "text-ink font-medium"}`}>{m.text}</span>
            </button>
          ))}
          {doneCount === initialMoves.length && initialMoves.length > 0 && (
            <p className="text-[13px] font-semibold text-[#15803d] mt-1">All three done — that&rsquo;s a week that moved the business. 💪</p>
          )}
        </div>
      )}
    </div>
  );
}
