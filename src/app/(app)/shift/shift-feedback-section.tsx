"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareHeart, Check, Trash2, Plus } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { SHIFT_FEEDBACK_FIELDS } from "@/lib/shift-feedback";
import { postShiftFeedback, deleteShiftFeedback } from "./actions";

export type ShiftFeedbackRow = {
  id: string;
  author: string;
  department: string;
  wentWell: string;
  improve: string;
  guestNotes: string;
  businessDay: string;
  locationName: string;
};

function dayLabel(day: string, todayStr: string): string {
  if (day === todayStr) return "Today";
  const yest = new Date(new Date(todayStr + "T00:00:00").getTime() - 86400000).toISOString().slice(0, 10);
  if (day === yest) return "Yesterday";
  return new Date(day + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const FIELD_LABEL: Record<string, string> = {
  wentWell: "What went well",
  improve: "What could be better",
  guestNotes: "Anything guests said",
};

export function ShiftFeedbackSection({
  canReadFeedback,
  alreadySubmitted,
  submitLocationId,
  feedback,
  todayStr,
  showLocation,
}: {
  canReadFeedback: boolean;
  alreadySubmitted: boolean;
  submitLocationId: string;
  feedback: ShiftFeedbackRow[];
  todayStr: string;
  showLocation: boolean;
}) {
  const router = useRouter();
  const [wentWell, setWentWell] = useState("");
  const [improve, setImprove] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [done, setDone] = useState(false);
  const [reopened, setReopened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const values: Record<string, string> = { wentWell, improve, guestNotes };
  const setters: Record<string, (v: string) => void> = { wentWell: setWentWell, improve: setImprove, guestNotes: setGuestNotes };
  const empty = !wentWell.trim() && !improve.trim() && !guestNotes.trim();

  function submit() {
    setError(null);
    start(async () => {
      const res = await postShiftFeedback({ wentWell, improve, guestNotes, locationId: submitLocationId });
      if (res.error) setError(res.error);
      else {
        setWentWell("");
        setImprove("");
        setGuestNotes("");
        setDone(true);
        setReopened(false);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!window.confirm("Remove this reflection from the feed?")) return;
    start(async () => {
      await deleteShiftFeedback(id);
      router.refresh();
    });
  }

  // Show the compact "you're checked in" state when they've submitted today (on
  // load) or just did — with an "Add another" for doubles / an afterthought.
  const showConfirmation = (alreadySubmitted || done) && !reopened;

  const groups: { day: string; items: ShiftFeedbackRow[] }[] = [];
  for (const f of feedback) {
    const last = groups[groups.length - 1];
    if (last && last.day === f.businessDay) last.items.push(f);
    else groups.push({ day: f.businessDay, items: [f] });
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="border-t border-line pt-8">
        <h2 className="text-[22px] font-bold tracking-[-0.01em] text-ink mb-1 flex items-center gap-2">
          <MessageSquareHeart size={20} className="text-brick" /> How was your shift?
        </h2>
        <p className="text-[15px] text-muted max-w-xl">
          A 30-second reflection at the end of your shift. It goes straight to your managers so the next shift runs better.
        </p>
      </div>

      {showConfirmation ? (
        <div className="bg-olive-tint rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-olive text-white flex items-center justify-center shrink-0">
            <Check size={16} />
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-[#15803d]">Thanks — your managers got it.</div>
            <div className="text-[13px] text-[#15803d]">You&rsquo;ve checked in today.</div>
          </div>
          <button
            type="button"
            onClick={() => { setDone(false); setReopened(true); }}
            className="text-[13px] font-semibold text-[#15803d] hover:underline inline-flex items-center gap-1 shrink-0"
          >
            <Plus size={14} /> Add another
          </button>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          {SHIFT_FEEDBACK_FIELDS.map((f) => (
            <div key={f.id}>
              <label className="text-[13.5px] font-semibold text-ink block mb-1.5">{f.label}</label>
              <textarea
                value={values[f.id]}
                onChange={(e) => setters[f.id](e.target.value)}
                rows={2}
                placeholder={f.placeholder}
                className={`${inputClass} resize-y`}
              />
            </div>
          ))}
          <div className="flex items-center justify-end gap-2">
            {error && <span className="text-[12.5px] text-danger mr-auto">{error}</span>}
            <Btn small onClick={submit} loading={pending} disabled={pending || empty}>
              {pending ? "Sending…" : "Send to managers"}
            </Btn>
          </div>
        </div>
      )}

      {canReadFeedback && (
        <div className="flex flex-col gap-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-2">Team feedback</div>
          {feedback.length === 0 ? (
            <div className="bg-white border border-line rounded-2xl p-8 text-center">
              <MessageSquareHeart className="mx-auto text-muted-2 mb-2" size={24} />
              <p className="text-[15px] text-muted">No post-shift feedback yet. It shows up here as your team checks in.</p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.day}>
                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-2 mb-2">{dayLabel(g.day, todayStr)}</div>
                <div className="flex flex-col gap-2">
                  {g.items.map((f) => (
                    <div key={f.id} className="bg-white border border-line rounded-xl p-4 flex items-start gap-3">
                      <div className="min-w-0 flex-1 flex flex-col gap-2">
                        <div className="text-[13px] font-semibold text-ink">
                          {f.author}
                          {f.department ? <span className="text-muted-2 font-normal"> · {f.department}</span> : ""}
                          {showLocation ? <span className="text-muted-2 font-normal"> · {f.locationName}</span> : ""}
                        </div>
                        {([["wentWell", f.wentWell], ["improve", f.improve], ["guestNotes", f.guestNotes]] as const)
                          .filter(([, v]) => v.trim().length > 0)
                          .map(([k, v]) => (
                            <div key={k}>
                              <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-2">{FIELD_LABEL[k]}</div>
                              <div className="text-[14px] text-ink leading-snug whitespace-pre-wrap">{v}</div>
                            </div>
                          ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(f.id)}
                        disabled={pending}
                        className="text-muted-2 hover:text-danger p-1 shrink-0"
                        aria-label="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
