"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, X, Trash2 } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { SHIFT_KINDS, KIND_LABEL } from "@/lib/shift-board";
import { postShiftNote, deleteShiftNote } from "./actions";

export type ShiftNoteRow = {
  id: string;
  kind: string;
  body: string;
  author: string;
  businessDay: string;
  locationName: string;
};

const KIND_TONE: Record<string, string> = {
  eightysix: "bg-danger-tint text-danger",
  staffing: "bg-gold-tint text-[#b45309]",
  note: "bg-brick-tint text-brick-dark",
};

function dayLabel(day: string, todayStr: string): string {
  if (day === todayStr) return "Today";
  const d = new Date(day + "T00:00:00");
  const yest = new Date(new Date(todayStr + "T00:00:00").getTime() - 86400000).toISOString().slice(0, 10);
  if (day === yest) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function ShiftClient({
  notes,
  canPost,
  todayStr,
  locations,
  defaultLocationId,
  showLocation,
}: {
  notes: ShiftNoteRow[];
  canPost: boolean;
  todayStr: string;
  locations: { id: string; name: string }[];
  defaultLocationId: string;
  showLocation: boolean;
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [kind, setKind] = useState<string>("eightysix");
  const [body, setBody] = useState("");
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function post() {
    setError(null);
    start(async () => {
      const res = await postShiftNote({ kind, body, locationId });
      if (res.error) setError(res.error);
      else {
        setBody("");
        setComposing(false);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!window.confirm("Remove this from the board?")) return;
    start(async () => {
      await deleteShiftNote(id);
      router.refresh();
    });
  }

  // Group notes by business day (already ordered newest-first).
  const groups: { day: string; items: ShiftNoteRow[] }[] = [];
  for (const n of notes) {
    const last = groups[groups.length - 1];
    if (last && last.day === n.businessDay) last.items.push(n);
    else groups.push({ day: n.businessDay, items: [n] });
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Shift board</h1>
          <p className="text-base text-muted max-w-xl">What the whole team needs to know today — 86&rsquo;d items, staffing, and shift notes. Clears itself each day.</p>
        </div>
        {canPost && !composing && (
          <Btn small icon={Plus} onClick={() => setComposing(true)}>
            Post to board
          </Btn>
        )}
      </div>

      {canPost && composing && (
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-semibold text-ink">New board post</div>
            <button type="button" onClick={() => setComposing(false)} className="text-muted-2 hover:text-ink"><X size={18} /></button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {SHIFT_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`text-[13px] font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                  kind === k.id ? "border-brick text-white bg-brick" : "border-line text-charcoal-2 hover:border-brick"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-muted-2 mb-2">{SHIFT_KINDS.find((k) => k.id === kind)?.hint}</p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="What should the team know?"
            className={`${inputClass} resize-y`}
          />
          {showLocation && locations.length > 1 && (
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={`${inputClass} mt-3`}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
          <div className="flex items-center justify-end gap-2 mt-3">
            {error && <span className="text-[12.5px] text-danger mr-auto">{error}</span>}
            <Btn small onClick={post} loading={pending} disabled={pending || body.trim().length < 1}>
              {pending ? "Posting…" : "Post"}
            </Btn>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-8 text-center">
          <Megaphone className="mx-auto text-muted-2 mb-2" size={24} />
          <p className="text-[15px] text-muted">
            {canPost ? "Nothing on the board yet. Post the first 86, staffing note, or shift heads-up." : "Nothing on the board right now — check back at the top of your shift."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.day}>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-2 mb-2">{dayLabel(g.day, todayStr)}</div>
              <div className="flex flex-col gap-2">
                {g.items.map((n) => (
                  <div key={n.id} className="bg-white border border-line rounded-xl p-3.5 flex items-start gap-3">
                    <span className={`shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5 ${KIND_TONE[n.kind] ?? KIND_TONE.note}`}>
                      {KIND_LABEL[n.kind] ?? "Note"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] text-ink leading-snug whitespace-pre-wrap">{n.body}</div>
                      <div className="text-[12px] text-muted-2 mt-0.5">
                        {n.author}
                        {showLocation ? ` · ${n.locationName}` : ""}
                      </div>
                    </div>
                    {canPost && (
                      <button type="button" onClick={() => remove(n.id)} disabled={pending} className="text-muted-2 hover:text-danger p-1 shrink-0" aria-label="Remove">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
