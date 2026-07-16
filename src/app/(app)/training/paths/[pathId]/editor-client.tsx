"use client";

import { useState, useTransition } from "react";
import { Plus, X, ClipboardCheck, GraduationCap, ListChecks, Users, Trash2 } from "lucide-react";
import { addStepAction, deleteStepAction, assignPathAction, unassignPathAction } from "../actions";

type Step = { id: string; kind: string; testId: string | null; department: string | null; title: string; detail: string };
type Overview = { profileId: string; name: string; done: number; total: number };

export function PathEditor({ pathId, steps, tests, departments, staff, assignedIds, overview }: {
  pathId: string;
  steps: Step[];
  tests: { id: string; title: string }[];
  departments: string[];
  staff: { id: string; name: string }[];
  assignedIds: string[];
  overview: Overview[];
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Add-step form state
  const [kind, setKind] = useState<"test" | "training" | "task">("test");
  const [testId, setTestId] = useState("");
  const [department, setDepartment] = useState(departments[0] ?? "");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");

  const [assignPick, setAssignPick] = useState("");

  const run = (fn: () => Promise<{ error: string | null }>) => {
    setErr(null);
    start(async () => { const r = await fn(); if (r.error) setErr(r.error); });
  };

  const addStep = () => {
    if (kind === "test" && !testId) { setErr("Pick a test."); return; }
    if (kind === "task" && !title.trim()) { setErr("Give the task a title."); return; }
    const stepTitle = kind === "test" ? (tests.find((t) => t.id === testId)?.title ?? "Test") : kind === "training" ? `${department} training` : title.trim();
    run(() => addStepAction(pathId, { kind, testId: testId || null, department: department || null, title: stepTitle, detail: detail.trim() }));
    setTitle(""); setDetail(""); setTestId("");
  };

  const unassigned = staff.filter((s) => !assignedIds.includes(s.id));
  const assigned = staff.filter((s) => assignedIds.includes(s.id));

  return (
    <div className="flex flex-col gap-5">
      {/* Steps */}
      <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
        <div className="text-[15px] font-semibold text-ink mb-3">Steps ({steps.length})</div>
        <div className="flex flex-col gap-1.5 mb-4">
          {steps.length === 0 && <div className="text-[13px] text-muted-2">No steps yet. Add the first below.</div>}
          {steps.map((s, i) => {
            const Icon = s.kind === "test" ? ClipboardCheck : s.kind === "training" ? GraduationCap : ListChecks;
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                <span className="text-[12px] font-semibold text-muted-2 tabular-nums w-5">{i + 1}</span>
                <Icon size={15} className="text-muted-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-ink truncate">{s.title}</div>
                  {s.detail && <div className="text-[12.5px] text-muted-2 truncate">{s.detail}</div>}
                </div>
                <span className="text-[11px] uppercase tracking-wide text-muted-2 shrink-0">{s.kind}</span>
                <button type="button" disabled={pending} onClick={() => run(() => deleteStepAction(pathId, s.id))} className="text-muted-2 hover:text-danger shrink-0" aria-label="Remove"><X size={15} /></button>
              </div>
            );
          })}
        </div>

        {/* Add step */}
        <div className="border-t border-line pt-3 flex flex-col gap-2.5">
          <div className="flex gap-1 bg-paper border border-line rounded-xl p-1 w-fit">
            {([["test", "Test"], ["training", "Role training"], ["task", "Task"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`text-[13px] font-semibold px-3 py-1.5 rounded-[9px] ${kind === k ? "bg-brick text-white" : "text-charcoal-2 hover:bg-white"}`}>{label}</button>
            ))}
          </div>
          {kind === "test" && (
            <select value={testId} onChange={(e) => setTestId(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brick">
              <option value="">Pick a test…</option>
              {tests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          )}
          {kind === "training" && (
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brick">
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {kind === "task" && (
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title (e.g. Shadow a senior server for one shift)" className="rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brick" />
          )}
          <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Note / instructions (optional)" className="rounded-xl border border-line bg-white px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-brick" />
          <button type="button" disabled={pending} onClick={addStep} className="self-start inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50"><Plus size={14} /> Add step</button>
        </div>
      </div>

      {/* Assign */}
      <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3"><Users size={15} className="text-brick" /><div className="text-[15px] font-semibold text-ink">Assigned ({assigned.length})</div></div>
        <div className="flex flex-col gap-1.5 mb-3">
          {overview.length === 0 && <div className="text-[13px] text-muted-2">No one assigned yet.</div>}
          {overview.map((o) => {
            const pct = Math.round((o.done / Math.max(1, o.total)) * 100);
            return (
              <div key={o.profileId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] text-ink truncate">{o.name}</span>
                    <span className="text-[12.5px] font-semibold text-brick tabular-nums shrink-0">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-paper overflow-hidden mt-1"><div className="h-full bg-brick" style={{ width: `${pct}%` }} /></div>
                </div>
                <button type="button" disabled={pending} onClick={() => run(() => unassignPathAction(pathId, o.profileId))} className="text-muted-2 hover:text-danger shrink-0" aria-label="Unassign"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 border-t border-line pt-3">
          <select value={assignPick} onChange={(e) => setAssignPick(e.target.value)} className="flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-brick">
            <option value="">Assign to…</option>
            {unassigned.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" disabled={pending || !assignPick} onClick={() => { if (assignPick) run(() => assignPathAction(pathId, [assignPick])); setAssignPick(""); }} className="text-[13px] font-semibold text-white bg-brick rounded-lg px-3 py-2 hover:bg-brick-dark disabled:opacity-50">Assign</button>
        </div>
      </div>

      {err && <p className="text-[13px] text-danger">{err}</p>}
    </div>
  );
}
