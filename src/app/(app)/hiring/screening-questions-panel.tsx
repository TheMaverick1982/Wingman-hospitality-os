"use client";

import { useMemo, useState, useTransition } from "react";
import { Sparkles, Plus, Trash2, Check, X, Loader2, Pencil, ClipboardCheck } from "lucide-react";
import { AXIS_LABEL, type ScreeningAxis, type ScreeningQuestion } from "@/lib/screening";
import {
  generateScreeningQuestions,
  saveScreeningQuestions,
  addScreeningQuestion,
  updateScreeningQuestion,
  deleteScreeningQuestion,
  type GeneratedQuestion,
} from "./screening-actions";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brick";

function AxisPill({ axis }: { axis: ScreeningAxis }) {
  const isFollows = axis === "follows_instructions";
  return (
    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${isFollows ? "bg-[#FDF3E1] text-[#B45309]" : "bg-brick-tint text-brick-dark"}`}>
      {AXIS_LABEL[axis]}
    </span>
  );
}

export function ScreeningQuestionsPanel({
  departments,
  questionsByDept,
}: {
  departments: string[];
  questionsByDept: Record<string, ScreeningQuestion[]>;
}) {
  const roles = departments.length ? departments : [];
  const [role, setRole] = useState(roles[0] ?? "");
  const questions = useMemo(() => questionsByDept[role] ?? [], [questionsByDept, role]);

  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeneratedQuestion[] | null>(null);
  const [adding, setAdding] = useState(false);

  function generate() {
    setError(null);
    setPreview(null);
    start(async () => {
      const res = await generateScreeningQuestions(role);
      if (res.error) setError(res.error);
      else setPreview(res.questions ?? []);
    });
  }
  function savePreview() {
    if (!preview) return;
    start(async () => {
      const res = await saveScreeningQuestions(role, preview);
      if (res.error) setError(res.error);
      else setPreview(null);
    });
  }

  if (roles.length === 0) return null;

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-2 mb-1">
        <ClipboardCheck size={18} className="text-brick mt-0.5 shrink-0" />
        <div>
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Screening questions</div>
          <p className="text-[13px] text-muted mt-0.5 max-w-2xl">
            A few short questions candidates answer on your application form — specific to each role. Wingman drafts them from your hiring criteria and grades the answers, so you get a read before deciding whether to interview. Edit anything before it goes live.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4 mb-4">
        {roles.map((d) => (
          <button
            key={d}
            onClick={() => { setRole(d); setPreview(null); setError(null); setAdding(false); }}
            className={`text-[13px] font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${
              role === d ? "border-brick bg-brick-tint text-brick-dark" : "border-line text-muted hover:border-line-strong"
            }`}
          >
            {d}
            {(questionsByDept[d]?.length ?? 0) > 0 && <span className="ml-1.5 tabular-nums text-muted-2">{questionsByDept[d].length}</span>}
          </button>
        ))}
      </div>

      {error && <p className="text-[13px] text-danger mb-3">{error}</p>}

      {/* AI preview waiting for review */}
      {preview && (
        <div className="rounded-2xl border border-brick/30 bg-brick-tint/30 p-4 mb-4">
          <div className="text-[13px] font-semibold text-brick-dark mb-2">Review before saving — this replaces the AI questions for {role} (your own added ones stay).</div>
          <div className="flex flex-col gap-2.5">
            {preview.map((q, i) => (
              <div key={i} className="bg-white border border-line rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <select
                    value={q.axis}
                    onChange={(e) => setPreview((p) => p!.map((x, j) => (j === i ? { ...x, axis: e.target.value as ScreeningAxis } : x)))}
                    className="text-[12px] font-semibold rounded-md border border-line px-2 py-1 text-charcoal-2"
                  >
                    <option value="hospitality">{AXIS_LABEL.hospitality}</option>
                    <option value="follows_instructions">{AXIS_LABEL.follows_instructions}</option>
                  </select>
                  <button onClick={() => setPreview((p) => p!.filter((_, j) => j !== i))} className="text-muted-2 hover:text-danger" title="Remove"><Trash2 size={14} /></button>
                </div>
                <textarea
                  value={q.prompt}
                  onChange={(e) => setPreview((p) => p!.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))}
                  rows={2}
                  className={field}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={savePreview} disabled={pending || preview.length === 0} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50">
              <Check size={14} /> {pending ? "Saving…" : "Save these questions"}
            </button>
            <button onClick={() => setPreview(null)} className="text-[13px] font-semibold text-muted-2 hover:text-ink">Discard</button>
          </div>
        </div>
      )}

      {/* Current questions */}
      {!preview && (
        <>
          {questions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong p-6 text-center mb-4">
              <p className="text-[14px] font-semibold text-ink">No screening questions for {role} yet.</p>
              <p className="text-[13px] text-muted mt-1">Generate a set from your hiring criteria, then edit to taste.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 mb-4">
              {questions.map((q) => <QuestionRow key={q.id} q={q} />)}
            </div>
          )}

          {adding ? (
            <AddQuestionForm department={role} onClose={() => setAdding(false)} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={generate} disabled={pending} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50">
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {pending ? "Generating…" : questions.length > 0 ? "Regenerate with AI" : "Generate with AI"}
              </button>
              <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick">
                <Plus size={14} /> Add a question
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuestionRow({ q }: { q: ScreeningQuestion }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.prompt);
  const [axis, setAxis] = useState<ScreeningAxis>(q.axis);

  function save() {
    start(async () => {
      await updateScreeningQuestion(q.id, { prompt: text, axis });
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="bg-panel border border-brick/40 rounded-xl p-3">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <select value={axis} onChange={(e) => setAxis(e.target.value as ScreeningAxis)} className="text-[12px] font-semibold rounded-md border border-line px-2 py-1 text-charcoal-2">
            <option value="hospitality">{AXIS_LABEL.hospitality}</option>
            <option value="follows_instructions">{AXIS_LABEL.follows_instructions}</option>
          </select>
          <button onClick={() => { setEditing(false); setText(q.prompt); setAxis(q.axis); }} className="text-muted-2 hover:text-ink"><X size={15} /></button>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className={field} />
        <div className="flex justify-end mt-2">
          <button onClick={save} disabled={pending || !text.trim()} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark disabled:opacity-50">
            <Check size={13} /> {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="mb-1"><AxisPill axis={q.axis} /></div>
        <p className="text-[13.5px] text-ink">{q.prompt}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => setEditing(true)} className="text-muted-2 hover:text-ink" title="Edit"><Pencil size={14} /></button>
        <button onClick={() => start(() => deleteScreeningQuestion(q.id))} disabled={pending} className="text-muted-2 hover:text-danger disabled:opacity-50" title="Delete"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function AddQuestionForm({ department, onClose }: { department: string; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [axis, setAxis] = useState<ScreeningAxis>("hospitality");

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("department", department);
    fd.set("prompt", prompt);
    fd.set("axis", axis);
    start(async () => {
      const res = await addScreeningQuestion({ error: null }, fd);
      if (res.error) setError(res.error);
      else { setPrompt(""); onClose(); }
    });
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <select value={axis} onChange={(e) => setAxis(e.target.value as ScreeningAxis)} className="text-[12px] font-semibold rounded-md border border-line px-2 py-1 text-charcoal-2">
          <option value="hospitality">{AXIS_LABEL.hospitality}</option>
          <option value="follows_instructions">{AXIS_LABEL.follows_instructions}</option>
        </select>
        <button onClick={onClose} className="text-muted-2 hover:text-ink"><X size={15} /></button>
      </div>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="Write the screening question…" className={field} />
      {error && <p className="text-[12.5px] text-danger mt-1.5">{error}</p>}
      <div className="flex justify-end mt-2">
        <button onClick={submit} disabled={pending || !prompt.trim()} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark disabled:opacity-50">
          <Plus size={13} /> {pending ? "Adding…" : "Add question"}
        </button>
      </div>
    </div>
  );
}
