"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Check } from "lucide-react";
import { updateCoreValues, type CoreValueInput } from "./actions";

type Row = { id: string | null; title: string; description: string; key: string };

let tmpSeq = 0;
const newRow = (): Row => ({ id: null, title: "", description: "", key: `new-${tmpSeq++}` });

export function CoreValuesEditor({ values }: { values: { id: string; title: string; description: string }[] }) {
  const initial: Row[] = values.length
    ? values.map((v) => ({ id: v.id, title: v.title, description: v.description, key: v.id }))
    : [newRow()];
  const [rows, setRows] = useState<Row[]>(initial);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function add() {
    setRows((r) => [...r, newRow()]);
  }
  function remove(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function cancel() {
    setRows(initial);
    setEditing(false);
    setMsg(null);
  }
  function save() {
    setMsg(null);
    const payload: CoreValueInput[] = rows
      .map((r) => ({ id: r.id, title: r.title.trim(), description: r.description.trim() }))
      .filter((r) => r.title);
    if (payload.length === 0) {
      setMsg("Add at least one value with a name.");
      return;
    }
    start(async () => {
      const res = await updateCoreValues(payload);
      if (res.error) {
        setMsg(res.error);
        return;
      }
      setEditing(false);
      setMsg(null);
    });
  }

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Core values</div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[13px] font-semibold text-charcoal-2 hover:text-brick transition-colors"
          >
            Edit
          </button>
        </div>
        {values.length === 0 ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full text-left bg-white border border-dashed border-line rounded-2xl p-6 text-[14px] text-muted hover:border-brick transition-colors"
          >
            Add your core values — the handful of things your team is known for. <span className="font-semibold text-brick">Add values →</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {values.map((v, i) => (
              <div key={v.id} className="bg-white border border-line rounded-2xl p-6 shadow-sm">
                <div className="w-9 h-9 rounded-[10px] bg-brick-tint text-brick flex items-center justify-center text-[15px] font-bold mb-4">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="text-base font-semibold tracking-[-0.01em] text-ink mb-1.5">{v.title}</div>
                <div className="text-[13px] text-muted leading-[1.45]">{v.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Core values</div>
      </div>
      <p className="text-[12.5px] text-muted mb-4">
        The handful of things your team is known for. These show on every role guide and ground the AI. Removing a value
        also removes it from your universal hiring criteria.
      </p>
      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={row.key} className="bg-white border border-line rounded-2xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-1 pt-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="text-muted-2 hover:text-ink disabled:opacity-30">
                  <ArrowUp size={15} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" className="text-muted-2 hover:text-ink disabled:opacity-30">
                  <ArrowDown size={15} />
                </button>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <input
                  value={row.title}
                  onChange={(e) => set(i, { title: e.target.value })}
                  maxLength={80}
                  placeholder="Value name — e.g. Ownership"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] font-semibold text-ink outline-none focus:border-brick"
                />
                <textarea
                  value={row.description}
                  onChange={(e) => set(i, { description: e.target.value })}
                  maxLength={400}
                  rows={2}
                  placeholder="One line on what it means in practice."
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-charcoal-2 outline-none focus:border-brick resize-y"
                />
              </div>
              <button type="button" onClick={() => remove(i)} aria-label="Remove value" className="text-muted-2 hover:text-danger pt-1">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brick border border-brick/40 rounded-full px-3.5 py-1.5 hover:bg-brick-tint transition-colors"
      >
        <Plus size={14} /> Add a value
      </button>
      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50"
        >
          <Check size={14} /> {pending ? "Saving…" : "Save values"}
        </button>
        <button type="button" onClick={cancel} disabled={pending} className="text-[13px] font-semibold text-muted-2 hover:text-ink">
          Cancel
        </button>
        {msg && <span className="text-[12.5px] font-semibold text-danger">{msg}</span>}
      </div>
    </div>
  );
}
