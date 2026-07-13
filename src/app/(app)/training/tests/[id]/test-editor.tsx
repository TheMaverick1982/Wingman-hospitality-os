"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Pencil, Trash2, Save } from "lucide-react";
import type { Department } from "@/lib/constants";
import { MODE_LABEL, completionWindowLabel, type QuestionKind, type TestDay, type TestQuestion, type TestSettings } from "@/lib/tests";
import { updateTestSettings, saveQuestion, deleteQuestion, updateDay } from "../actions";

const input = "rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brick";

function QuestionForm({ testId, dayNumber, q, onDone }: { testId: string; dayNumber: number; q?: TestQuestion; onDone: () => void }) {
  const [kind, setKind] = useState<QuestionKind>(q?.kind ?? "multiple_choice");
  const [prompt, setPrompt] = useState(q?.prompt ?? "");
  const [options, setOptions] = useState<string[]>(q?.kind === "true_false" ? ["True", "False"] : q?.options?.length ? q.options : ["", "", "", ""]);
  const [correct, setCorrect] = useState(q?.correct_index ?? 0);
  const [explanation, setExplanation] = useState(q?.explanation ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const opts = kind === "true_false" ? ["True", "False"] : options;

  function save() {
    setErr(null);
    start(async () => {
      const res = await saveQuestion({ id: q?.id, test_id: testId, day_number: dayNumber, kind, prompt, options: opts, correct_index: correct, explanation });
      if (res.error) setErr(res.error);
      else { router.refresh(); onDone(); }
    });
  }

  return (
    <div className="bg-white border border-brick/40 rounded-xl p-4 flex flex-col gap-2.5">
      <div className="flex gap-2">
        <select value={kind} onChange={(e) => { const k = e.target.value as QuestionKind; setKind(k); setCorrect(0); }} className={input}>
          <option value="multiple_choice">Multiple choice</option>
          <option value="true_false">True / False</option>
        </select>
      </div>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="Question" className={`${input} w-full`} />
      <div className="flex flex-col gap-1.5">
        {opts.map((o, i) => (
          <label key={i} className="flex items-center gap-2">
            <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} className="accent-olive" />
            {kind === "true_false" ? (
              <span className="text-[14px] text-ink">{o}</span>
            ) : (
              <input value={o} onChange={(e) => setOptions((prev) => prev.map((x, xi) => (xi === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} className={`${input} flex-1`} />
            )}
            {correct === i && <span className="text-[11px] font-semibold text-olive">correct</span>}
          </label>
        ))}
        {kind === "multiple_choice" && options.length < 6 && (
          <button type="button" onClick={() => setOptions((p) => [...p, ""])} className="text-[12.5px] font-semibold text-brick self-start">+ Add option</button>
        )}
      </div>
      <input value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Why it's correct (optional)" className={`${input} w-full`} />
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="text-[13.5px] font-semibold text-white bg-brick rounded-full px-4 py-1.5 hover:bg-brick-dark disabled:opacity-60">{pending ? "Saving…" : "Save question"}</button>
        <button onClick={onDone} disabled={pending} className="text-[13.5px] text-muted-2 hover:text-ink">Cancel</button>
        {err && <span className="text-[12.5px] text-danger">{err}</span>}
      </div>
    </div>
  );
}

function DayBlock({ testId, day, questions, mode, canEdit }: { testId: string; day: TestDay; questions: TestQuestion[]; mode: string; canEdit: boolean }) {
  const [editingContent, setEditingContent] = useState(false);
  const [title, setTitle] = useState(day.title);
  const [content, setContent] = useState(day.content);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[15px] font-semibold text-ink">Day {day.day_number}{day.title ? `: ${day.title}` : ""}</div>
        {canEdit && day.id && !editingContent && <button onClick={() => setEditingContent(true)} className="text-[12.5px] font-semibold text-charcoal-2 hover:text-brick">Edit day</button>}
      </div>

      {editingContent ? (
        <div className="flex flex-col gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Day title" className={`${input} w-full`} />
          {mode === "study_quiz" && <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Teaching / study content shown before the questions" className={`${input} w-full`} />}
          <div className="flex items-center gap-3">
            <button onClick={() => start(async () => { await updateDay(day.id!, title, content, testId); router.refresh(); setEditingContent(false); })} disabled={pending} className="text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-1.5 disabled:opacity-60">Save</button>
            <button onClick={() => setEditingContent(false)} className="text-[13px] text-muted-2 hover:text-ink">Cancel</button>
          </div>
        </div>
      ) : (
        mode === "study_quiz" && day.content && <div className="text-[13px] text-muted whitespace-pre-wrap bg-paper rounded-lg p-3">{day.content}</div>
      )}

      <div className="flex flex-col gap-2">
        {questions.map((q) =>
          editId === q.id ? (
            <QuestionForm key={q.id} testId={testId} dayNumber={day.day_number} q={q} onDone={() => setEditId(null)} />
          ) : (
            <div key={q.id} className="border border-line rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="text-[13.5px] font-medium text-ink">{q.prompt}</div>
                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setEditId(q.id!)} className="text-muted-2 hover:text-brick"><Pencil size={13} /></button>
                    <button onClick={() => { if (confirm("Delete this question?")) start(async () => { await deleteQuestion(q.id!, testId); router.refresh(); }); }} className="text-muted-2 hover:text-danger"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-0.5 mt-1.5">
                {q.options.map((o, i) => (
                  <div key={i} className={`flex items-center gap-1.5 text-[12.5px] ${i === q.correct_index ? "text-[#15803D] font-semibold" : "text-muted"}`}>
                    {i === q.correct_index ? <Check size={12} /> : <span className="w-3" />}{o}
                  </div>
                ))}
              </div>
            </div>
          )
        )}
        {canEdit && (adding ? (
          <QuestionForm testId={testId} dayNumber={day.day_number} onDone={() => setAdding(false)} />
        ) : (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brick self-start"><Plus size={14} /> Add question</button>
        ))}
      </div>
    </div>
  );
}

export function TestEditor({ testId, settings, days, questions, activeDepartments, canEdit }: { testId: string; settings: TestSettings; days: TestDay[]; questions: TestQuestion[]; activeDepartments: Department[]; canEdit: boolean }) {
  const [s, setS] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function saveSettings() {
    setErr(null); setSaved(false);
    start(async () => {
      const res = await updateTestSettings(testId, s);
      if (res.error) setErr(res.error);
      else { setSaved(true); router.refresh(); }
    });
  }
  const toggleDept = (d: string) => setS((p) => ({ ...p, target_departments: p.target_departments.includes(d) ? p.target_departments.filter((x) => x !== d) : [...p.target_departments, d] }));

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <input value={s.title} disabled={!canEdit} onChange={(e) => setS({ ...s, title: e.target.value })} className="text-[24px] font-bold tracking-[-0.01em] text-ink outline-none bg-transparent disabled:opacity-100" />
        <input value={s.description} disabled={!canEdit} onChange={(e) => setS({ ...s, description: e.target.value })} placeholder="Short description" className="text-[14px] text-muted outline-none bg-transparent w-full" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1"><span className="text-[12px] font-semibold text-charcoal-2">Pass %</span><input type="number" min={1} max={100} value={s.pass_pct} disabled={!canEdit} onChange={(e) => setS({ ...s, pass_pct: Number(e.target.value) })} className={input} /></label>
          <label className="flex flex-col gap-1"><span className="text-[12px] font-semibold text-charcoal-2">Retakes</span><input type="number" min={0} max={10} value={s.max_retakes} disabled={!canEdit} onChange={(e) => setS({ ...s, max_retakes: Number(e.target.value) })} className={input} /></label>
          <label className="flex flex-col gap-1"><span className="text-[12px] font-semibold text-charcoal-2">Complete within</span>
            <div className="flex gap-1">
              <input type="number" min={1} value={s.complete_within_amount ?? ""} disabled={!canEdit} onChange={(e) => setS({ ...s, complete_within_amount: e.target.value ? Number(e.target.value) : null })} placeholder="—" className={`${input} w-full`} />
              <select value={s.complete_within_unit} disabled={!canEdit} onChange={(e) => setS({ ...s, complete_within_unit: e.target.value as "hours" | "days" })} className={input}><option value="days">days</option><option value="hours">hours</option></select>
            </div>
          </label>
          <label className="flex flex-col gap-1"><span className="text-[12px] font-semibold text-charcoal-2">Format</span>
            <select value={s.mode} disabled={!canEdit} onChange={(e) => setS({ ...s, mode: e.target.value as TestSettings["mode"] })} className={input}><option value="exam">Exam</option><option value="study_quiz">Learn, then quiz</option></select>
          </label>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-charcoal-2 mb-1.5">Which roles must take it? <span className="font-normal text-muted-2">(none = all staff)</span></div>
          <div className="flex flex-wrap gap-2">
            {activeDepartments.map((d) => (
              <button key={d} type="button" disabled={!canEdit} onClick={() => toggleDept(d)} className={`text-[13px] font-semibold rounded-full border px-3 py-1.5 transition-colors ${s.target_departments.includes(d) ? "bg-brick-tint border-brick text-brick-dark" : "bg-white border-line text-charcoal-2 hover:border-brick"}`}>{d}</button>
            ))}
          </div>
        </div>
        {s.mode === "study_quiz" && (
          <label className="inline-flex items-center gap-2 text-[13px] text-charcoal-2">
            <input type="checkbox" checked={s.rotates_monthly} disabled={!canEdit} onChange={(e) => setS({ ...s, rotates_monthly: e.target.checked })} className="accent-brick" /> Rotates monthly (push a fresh version to all staff each month)
          </label>
        )}
        <div className="text-[12.5px] text-muted-2">{MODE_LABEL[s.mode]} · {completionWindowLabel(s.complete_within_amount, s.complete_within_unit)}</div>

        {canEdit && (
          <div className="flex items-center gap-3">
            <button onClick={saveSettings} disabled={pending} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2 hover:bg-brick-dark disabled:opacity-60"><Save size={14} />{pending ? "Saving…" : "Save settings"}</button>
            {saved && <span className="text-[13px] text-olive font-semibold">Saved</span>}
            {err && <span className="text-[13px] text-danger">{err}</span>}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {days.map((d) => (
          <DayBlock key={d.id ?? d.day_number} testId={testId} day={d} questions={questions.filter((q) => q.day_number === d.day_number)} mode={s.mode} canEdit={canEdit} />
        ))}
      </div>

      <div className="bg-brick-tint/40 border border-brick/20 rounded-2xl p-4 text-[13px] text-brick-dark">
        <span className="font-semibold">Coming next:</span> assign this test to an employee or send it to all staff, take-it-day-by-day scoring, retakes &amp; unlock, and a who-passed board.
      </div>
    </div>
  );
}
