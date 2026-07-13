"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Sparkles, FileText, GraduationCap, Trash2, ClipboardList, Users } from "lucide-react";
import type { Department } from "@/lib/constants";
import { MODE_LABEL } from "@/lib/tests";
import { proposeTest, proposeTestFromTraining, applyTest, createExampleTest, deleteTest, type ProposeState, type ProposedDay } from "./actions";

const proposeInitial: ProposeState = { error: null };
const inputCls = "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-ink outline-none focus:border-brick";
const smallInput = "rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brick";

type TestListRow = {
  id: string;
  title: string;
  description: string;
  mode: string;
  target_departments: string[];
  day_count: number;
  pass_pct: number;
  rotates_monthly: boolean;
  questions: number;
  assigned: number;
  passed: number;
};

function QuestionPreview({ q }: { q: ProposedDay["questions"][number] }) {
  return (
    <div className="bg-white border border-line rounded-lg p-3">
      <div className="text-[13.5px] font-medium text-ink mb-1.5">{q.prompt}</div>
      <div className="flex flex-col gap-1">
        {q.options.map((o, i) => (
          <div key={i} className={`flex items-center gap-1.5 text-[12.5px] ${i === q.correct_index ? "text-[#15803D] font-semibold" : "text-muted"}`}>
            {i === q.correct_index ? <Check size={12} /> : <span className="w-3" />}
            {o}
          </div>
        ))}
      </div>
    </div>
  );
}

function Preview({ state, onApprove, onDiscard, applying, err }: { state: ProposeState; onApprove: () => void; onDiscard: () => void; applying: boolean; err: string | null }) {
  if (!state.days || !state.settings) return null;
  const total = state.days.reduce((n, d) => n + d.questions.length, 0);
  return (
    <div className="bg-paper border border-brick/30 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold uppercase tracking-wide text-brick">Recommended test — review &amp; approve</span>
        <span className="text-[12px] text-muted">{state.settings.day_count} day{state.settings.day_count === 1 ? "" : "s"} · {total} questions · pass {state.settings.pass_pct}%</span>
      </div>
      {state.summary && <p className="text-[13.5px] text-charcoal-2">{state.summary}</p>}
      <div className="flex flex-col gap-3">
        {state.days.map((d) => (
          <div key={d.day_number} className="bg-white border border-line rounded-xl p-4">
            <div className="text-[14.5px] font-semibold text-ink">Day {d.day_number}: {d.title}</div>
            {d.content && <div className="text-[12.5px] text-muted mt-1 whitespace-pre-wrap">{d.content}</div>}
            <div className="flex flex-col gap-2 mt-3">
              {d.questions.map((q, i) => <QuestionPreview key={i} q={q} />)}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onApprove} disabled={applying} className="text-[14px] font-semibold text-white bg-olive rounded-full px-5 py-2 hover:opacity-90 transition-opacity disabled:opacity-60 inline-flex items-center gap-2">
          {applying && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {applying ? "Saving…" : "Approve & save test"}
        </button>
        <button onClick={onDiscard} disabled={applying} className="text-[14px] text-muted-2 hover:text-ink disabled:opacity-60">Discard</button>
        {err && <span className="text-[13px] text-danger">{err}</span>}
      </div>
    </div>
  );
}

function SettingsFields({ activeDepartments }: { activeDepartments: Department[] }) {
  const [mode, setMode] = useState("exam");
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Test title</label>
          <input name="title" placeholder="e.g. Food Test" className={inputCls} />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Format</label>
          <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
            <option value="exam">{MODE_LABEL.exam}</option>
            <option value="study_quiz">{MODE_LABEL.study_quiz}</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Short description <span className="font-normal text-muted-2">(optional)</span></label>
        <input name="description" placeholder="What this test checks" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-[12.5px] font-semibold text-charcoal-2 block mb-1">Days</label>
          <input type="number" name="day_count" min={1} max={30} defaultValue={1} className={`${smallInput} w-full`} />
        </div>
        <div>
          <label className="text-[12.5px] font-semibold text-charcoal-2 block mb-1">Pass %</label>
          <input type="number" name="pass_pct" min={1} max={100} defaultValue={80} className={`${smallInput} w-full`} />
        </div>
        <div>
          <label className="text-[12.5px] font-semibold text-charcoal-2 block mb-1">Retakes</label>
          <input type="number" name="max_retakes" min={0} max={10} defaultValue={1} className={`${smallInput} w-full`} />
        </div>
        <div>
          <label className="text-[12.5px] font-semibold text-charcoal-2 block mb-1">Complete within</label>
          <div className="flex gap-1">
            <input type="number" name="complete_within_amount" min={1} defaultValue={7} className={`${smallInput} w-full`} />
            <select name="complete_within_unit" defaultValue="days" className={smallInput}>
              <option value="days">days</option>
              <option value="hours">hours</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Which roles must take it? <span className="font-normal text-muted-2">(none checked = all staff)</span></label>
        <div className="flex flex-wrap gap-2">
          {activeDepartments.map((d) => (
            <label key={d} className="inline-flex items-center gap-1.5 text-[13px] text-charcoal-2 border border-line rounded-full px-3 py-1.5 cursor-pointer hover:border-brick has-[:checked]:bg-brick-tint has-[:checked]:border-brick has-[:checked]:text-brick-dark">
              <input type="checkbox" name="target_departments" value={d} className="accent-brick" />
              {d}
            </label>
          ))}
        </div>
      </div>
      {mode === "study_quiz" && (
        <label className="inline-flex items-center gap-2 text-[13px] text-charcoal-2">
          <input type="checkbox" name="rotates_monthly" className="accent-brick" />
          Rotates monthly (a fresh menu/LTO test pushed to all staff each month)
        </label>
      )}
    </>
  );
}

export function TestsClient({ tests, activeDepartments, canEdit }: { tests: TestListRow[]; activeDepartments: Department[]; canEdit: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"ai" | "training" | "example">("ai");
  const [propose, proposeAction, proposing] = useActionState(proposeTest, proposeInitial);
  const [fromTraining, fromTrainingAction, fromTrainingPending] = useActionState(proposeTestFromTraining, proposeInitial);
  const [applying, startApply] = useTransition();
  const [applyErr, setApplyErr] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [exampleBusy, setExampleBusy] = useState<string | null>(null);

  const active = tab === "training" ? fromTraining : propose;
  const showPreview = !dismissed && active.days && active.settings;

  function approve() {
    if (!active.days || !active.settings) return;
    setApplyErr(null);
    startApply(async () => {
      const res = await applyTest(active.settings!, active.days!, tab === "training" ? "training" : "ai");
      if (res.error) setApplyErr(res.error);
      else if (res.id) router.push(`/training/tests/${res.id}`);
    });
  }

  function addExample(key: string) {
    setExampleBusy(key);
    startApply(async () => {
      const res = await createExampleTest(key);
      setExampleBusy(null);
      if (res.error) setApplyErr(res.error);
      else if (res.id) router.push(`/training/tests/${res.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {canEdit && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Create a test</div>
          <div className="flex gap-1 bg-paper border border-line rounded-xl p-1 w-fit">
            {[
              { k: "ai" as const, label: "Build with AI", icon: Sparkles },
              { k: "training" as const, label: "From a training", icon: GraduationCap },
              { k: "example" as const, label: "Start from an example", icon: FileText },
            ].map((t) => (
              <button key={t.k} onClick={() => { setTab(t.k); setDismissed(false); setApplyErr(null); }} className={`inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-[9px] transition-colors ${tab === t.k ? "bg-brick text-white" : "text-charcoal-2 hover:bg-white"}`}>
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "ai" && (
            <form action={proposeAction} onSubmit={() => { setDismissed(false); setApplyErr(null); }} className="flex flex-col gap-3">
              <SettingsFields activeDepartments={activeDepartments} />
              <div>
                <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">What should it cover?</label>
                <textarea name="topic" rows={2} placeholder="e.g. Our full food menu, allergens, and food-safety basics" className={`${inputCls} resize-y`} />
              </div>
              <div>
                <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Or paste your existing material for AI to improve <span className="font-normal text-muted-2">(optional)</span></label>
                <textarea name="material" rows={4} placeholder="Paste study notes, a menu sheet, an SOP — anything. Wingman will organize it and write the questions." className={`${inputCls} resize-y`} />
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={proposing} className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-60 inline-flex items-center gap-2">
                  {proposing && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                  {proposing ? "Building…" : "Get recommendations"}
                </button>
                {propose.error && <span className="text-[13px] text-danger">{propose.error}</span>}
              </div>
            </form>
          )}

          {tab === "training" && (
            <form action={fromTrainingAction} onSubmit={() => { setDismissed(false); setApplyErr(null); }} className="flex flex-col gap-3">
              <p className="text-[13.5px] text-muted">Turn a role&rsquo;s existing training into a knowledge test — Wingman writes the questions from your own standards.</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Role</label>
                  <select name="department" className={inputCls} defaultValue={activeDepartments[0] ?? ""}>
                    {activeDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={fromTrainingPending} className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-60 inline-flex items-center gap-2">
                  {fromTrainingPending && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                  {fromTrainingPending ? "Building…" : "Build test from training"}
                </button>
                {fromTraining.error && <span className="text-[13px] text-danger self-center">{fromTraining.error}</span>}
              </div>
            </form>
          )}

          {tab === "example" && (
            <div className="flex flex-col gap-3">
              <p className="text-[13.5px] text-muted">Drop in a ready-made starter and tailor it to your restaurant.</p>
              <div className="flex flex-wrap gap-3">
                {[
                  { key: "food", title: "Food Test", sub: "5 days · food knowledge, allergens, safety" },
                  { key: "bartender", title: "Bartender Test", sub: "3 days · cocktails, pours, responsible service" },
                  { key: "kitchen", title: "Kitchen Test", sub: "5 days · recipes, ingredients, method, safety" },
                ].map((ex) => (
                  <button key={ex.key} onClick={() => addExample(ex.key)} disabled={applying} className="text-left bg-paper border border-line rounded-xl px-4 py-3 hover:border-brick transition-colors disabled:opacity-60 min-w-[240px]">
                    <div className="text-[14.5px] font-semibold text-ink flex items-center gap-2">{ex.title}{exampleBusy === ex.key && <span className="w-3.5 h-3.5 rounded-full border-2 border-brick border-t-transparent animate-spin" />}</div>
                    <div className="text-[12.5px] text-muted mt-0.5">{ex.sub}</div>
                  </button>
                ))}
              </div>
              {applyErr && tab === "example" && <span className="text-[13px] text-danger">{applyErr}</span>}
            </div>
          )}

          {showPreview && tab !== "example" && (
            <Preview state={active} onApprove={approve} onDiscard={() => setDismissed(true)} applying={applying} err={applyErr} />
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Your tests</div>
        {tests.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl p-8 text-center text-muted">No tests yet. Build one above.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tests.map((t) => (
              <div key={t.id} className="bg-white border border-line rounded-2xl p-5 shadow-sm flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/training/tests/${t.id}`} className="text-[16px] font-semibold text-ink hover:text-brick transition-colors flex items-center gap-2">
                    <ClipboardList size={16} className="text-brick shrink-0" /> {t.title}
                  </Link>
                  {canEdit && (
                    <button onClick={() => { if (confirm(`Delete "${t.title}"?`)) startApply(async () => { await deleteTest(t.id); router.refresh(); }); }} className="text-muted-2 hover:text-danger shrink-0">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {t.description && <p className="text-[13px] text-muted line-clamp-2">{t.description}</p>}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="text-[11.5px] font-semibold text-charcoal-2 bg-paper rounded-full px-2.5 py-0.5">{t.day_count} day{t.day_count === 1 ? "" : "s"}</span>
                  <span className="text-[11.5px] font-semibold text-charcoal-2 bg-paper rounded-full px-2.5 py-0.5">{t.questions} questions</span>
                  <span className="text-[11.5px] font-semibold text-charcoal-2 bg-paper rounded-full px-2.5 py-0.5">Pass {t.pass_pct}%</span>
                  <span className="text-[11.5px] font-semibold text-charcoal-2 bg-paper rounded-full px-2.5 py-0.5">{t.target_departments.length ? t.target_departments.join(", ") : "All roles"}</span>
                  {t.rotates_monthly && <span className="text-[11.5px] font-semibold text-[#B45309] bg-[#FDF3E1] rounded-full px-2.5 py-0.5">Monthly</span>}
                </div>
                {canEdit && (
                  <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-line">
                    <span className="text-[12.5px] text-muted">{t.assigned > 0 ? `${t.passed}/${t.assigned} passed` : "Not assigned yet"}</span>
                    <div className="flex items-center gap-3">
                      <Link href={`/training/tests/${t.id}`} className="text-[12.5px] font-semibold text-charcoal-2 hover:text-brick">Edit</Link>
                      <Link href={`/training/tests/${t.id}/assign`} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark transition-colors">
                        <Users size={13} /> Assign &amp; results
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
