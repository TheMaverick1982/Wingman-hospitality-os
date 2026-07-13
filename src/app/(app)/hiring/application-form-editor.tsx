"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import {
  BUILTIN_FIELDS,
  CUSTOM_FIELD_TYPES,
  builtinSetting,
  type ApplicationFormConfig,
  type BuiltinKey,
  type CustomField,
  type CustomFieldType,
} from "@/lib/application-form";
import { updateApplicationForm } from "./applicant-actions";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brick";

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? "bg-brick" : "bg-line-strong"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function newField(): CustomField {
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : `f${Math.round(performance.now())}`;
  return { id, label: "", type: "short_text", required: false };
}

export function ApplicationFormEditor({ initial }: { initial: ApplicationFormConfig }) {
  const [builtins, setBuiltins] = useState(initial.builtins ?? {});
  const [custom, setCustom] = useState<CustomField[]>(initial.custom ?? []);
  const [headline, setHeadline] = useState(initial.headline ?? "");
  const [intro, setIntro] = useState(initial.intro ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function setBuiltin(key: BuiltinKey, patch: Partial<{ enabled: boolean; required: boolean; label: string }>) {
    setBuiltins((b) => {
      const cur = builtinSetting({ builtins: b, custom: [] }, key);
      return { ...b, [key]: { enabled: cur.enabled, required: cur.required, label: cur.label, ...patch } };
    });
  }

  function updateField(id: string, patch: Partial<CustomField>) {
    setCustom((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
  function move(id: string, dir: -1 | 1) {
    setCustom((list) => {
      const i = list.findIndex((f) => f.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function save() {
    setErr(null); setMsg(null);
    const config: ApplicationFormConfig = { headline: headline.trim() || undefined, intro: intro.trim() || undefined, builtins, custom };
    start(async () => {
      const res = await updateApplicationForm(config);
      if (res.error) setErr(res.error);
      else { setMsg("Saved. Your application form is updated."); setTimeout(() => setMsg(null), 3000); }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Headline + intro */}
      <div className="flex flex-col gap-3">
        <div className="text-[13px] font-semibold text-ink">Form heading</div>
        <div className="grid grid-cols-1 gap-2.5">
          <div>
            <label className="text-[12px] font-semibold text-charcoal-2 block mb-1">Headline <span className="font-normal text-muted-2">(optional — defaults to “Join the [name] team”)</span></label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Join our team" className={input} />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-charcoal-2 block mb-1">Intro line <span className="font-normal text-muted-2">(optional)</span></label>
            <input value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Tell us a bit about you — it only takes a minute." className={input} />
          </div>
        </div>
      </div>

      {/* Built-in fields */}
      <div className="flex flex-col gap-2">
        <div className="text-[13px] font-semibold text-ink">Standard fields</div>
        <p className="text-[12px] text-muted-2">Your name is always asked. Turn the rest on or off, mark them required, and rename any label.</p>
        <div className="border border-line rounded-xl divide-y divide-line overflow-hidden">
          {BUILTIN_FIELDS.map((f) => {
            const s = builtinSetting({ builtins, custom: [] }, f.key);
            return (
              <div key={f.key} className="flex items-center gap-3 px-3.5 py-3 flex-wrap">
                <Toggle on={s.enabled} onChange={() => setBuiltin(f.key, { enabled: !s.enabled })} label={`Show ${f.defaultLabel}`} />
                <input
                  value={s.label}
                  onChange={(e) => setBuiltin(f.key, { label: e.target.value })}
                  disabled={!s.enabled}
                  className={`${input} flex-1 min-w-[160px] disabled:opacity-50`}
                />
                <label className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${s.enabled ? "text-charcoal-2" : "text-muted-2"}`}>
                  <input type="checkbox" checked={s.required} disabled={!s.enabled} onChange={(e) => setBuiltin(f.key, { required: e.target.checked })} className="accent-brick" />
                  Required
                </label>
              </div>
            );
          })}
        </div>
        <p className="text-[12px] text-muted-2">Tip: we always ask for an email or phone (at least one) so you can reach applicants.</p>
      </div>

      {/* Custom questions */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-semibold text-ink">Your custom questions</div>
          <button onClick={() => setCustom((l) => [...l, newField()])} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick hover:text-brick-dark">
            <Plus size={14} /> Add a question
          </button>
        </div>
        {custom.length === 0 ? (
          <p className="text-[12.5px] text-muted-2 border border-dashed border-line rounded-xl px-3.5 py-4 text-center">
            No custom questions yet. Add things like “Do you have a food handler’s card?” or “Which shifts can you work?”
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {custom.map((f, i) => (
              <div key={f.id} className="border border-line rounded-xl p-3 flex flex-col gap-2.5 bg-paper/40">
                <div className="flex items-start gap-2">
                  <GripVertical size={16} className="text-muted-2 mt-2.5 shrink-0" />
                  <div className="flex-1 flex flex-col gap-2.5">
                    <input value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} placeholder="Question label (e.g. Do you have reliable transportation?)" className={input} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={f.type}
                        onChange={(e) => {
                          const type = e.target.value as CustomFieldType;
                          updateField(f.id, { type, options: type === "dropdown" ? (f.options ?? ["", ""]) : undefined });
                        }}
                        className={`${input} w-auto`}
                      >
                        {CUSTOM_FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <label className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-charcoal-2">
                        <input type="checkbox" checked={f.required} onChange={(e) => updateField(f.id, { required: e.target.checked })} className="accent-brick" />
                        Required
                      </label>
                      <div className="ml-auto flex items-center gap-1">
                        <button onClick={() => move(f.id, -1)} disabled={i === 0} className="text-muted-2 hover:text-ink disabled:opacity-30 p-1"><ChevronUp size={15} /></button>
                        <button onClick={() => move(f.id, 1)} disabled={i === custom.length - 1} className="text-muted-2 hover:text-ink disabled:opacity-30 p-1"><ChevronDown size={15} /></button>
                        <button onClick={() => setCustom((l) => l.filter((x) => x.id !== f.id))} className="text-muted-2 hover:text-danger p-1"><Trash2 size={15} /></button>
                      </div>
                    </div>
                    {f.type === "dropdown" && (
                      <div className="flex flex-col gap-1.5 pl-1">
                        <div className="text-[11.5px] font-semibold text-muted-2 uppercase tracking-wide">Choices</div>
                        {(f.options ?? []).map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              value={opt}
                              onChange={(e) => updateField(f.id, { options: (f.options ?? []).map((o, k) => (k === oi ? e.target.value : o)) })}
                              placeholder={`Choice ${oi + 1}`}
                              className={`${input} flex-1`}
                            />
                            <button onClick={() => updateField(f.id, { options: (f.options ?? []).filter((_, k) => k !== oi) })} className="text-muted-2 hover:text-danger p-1"><Trash2 size={13} /></button>
                          </div>
                        ))}
                        <button onClick={() => updateField(f.id, { options: [...(f.options ?? []), ""] })} className="inline-flex items-center gap-1 text-[12px] font-semibold text-brick self-start"><Plus size={12} /> Add choice</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button onClick={save} disabled={pending} className="text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark disabled:opacity-60">
          {pending ? "Saving…" : "Save form"}
        </button>
        {msg && <span className="text-[13px] text-olive font-semibold">{msg}</span>}
        {err && <span className="text-[13px] text-danger">{err}</span>}
      </div>
    </div>
  );
}
