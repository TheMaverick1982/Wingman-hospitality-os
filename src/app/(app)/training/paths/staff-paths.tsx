"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ClipboardCheck, GraduationCap, ListChecks, ArrowUpRight } from "lucide-react";
import { toggleStepDoneAction } from "./actions";

type Step = { id: string; kind: string; testId: string | null; department: string | null; title: string; detail: string };
type PathVM = { assignmentId: string; title: string; description: string; steps: Step[]; completed: string[] };

function stepHref(s: Step): string | null {
  if (s.kind === "test" && s.testId) return `/training/tests/${s.testId}`;
  if (s.kind === "training") return "/training";
  return null;
}
function stepIcon(kind: string) {
  return kind === "test" ? ClipboardCheck : kind === "training" ? GraduationCap : ListChecks;
}

export function StaffPaths({ paths }: { paths: PathVM[] }) {
  return (
    <div className="flex flex-col gap-3">
      {paths.map((p) => <PathCard key={p.assignmentId} path={p} />)}
    </div>
  );
}

function PathCard({ path }: { path: PathVM }) {
  const [done, setDone] = useState<Set<string>>(new Set(path.completed));
  const [pending, start] = useTransition();
  const pct = Math.round((done.size / Math.max(1, path.steps.length)) * 100);

  const toggle = (stepId: string) => {
    const next = new Set(done);
    const willDo = !next.has(stepId);
    if (willDo) next.add(stepId); else next.delete(stepId);
    setDone(next);
    start(async () => {
      const r = await toggleStepDoneAction(path.assignmentId, stepId, willDo);
      if (r.error) { // revert on failure
        setDone((cur) => { const c = new Set(cur); if (willDo) c.delete(stepId); else c.add(stepId); return c; });
      }
    });
  };

  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="text-[15px] font-semibold text-ink">{path.title}</div>
        <div className="text-[13px] font-semibold text-brick tabular-nums">{pct}%</div>
      </div>
      {path.description && <p className="text-[13px] text-muted mb-2">{path.description}</p>}
      <div className="h-1.5 rounded-full bg-paper overflow-hidden mb-3">
        <div className="h-full bg-brick transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-col gap-1.5">
        {path.steps.map((s, i) => {
          const isDone = done.has(s.id);
          const Icon = stepIcon(s.kind);
          const href = stepHref(s);
          return (
            <div key={s.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${isDone ? "border-line bg-paper" : "border-line"}`}>
              <button type="button" onClick={() => toggle(s.id)} disabled={pending} className="shrink-0" aria-label={isDone ? "Mark not done" : "Mark done"}>
                {isDone ? <CheckCircle2 size={20} className="text-[#15803d]" /> : <Circle size={20} className="text-muted-2" />}
              </button>
              <Icon size={15} className="text-muted-2 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className={`text-[14px] ${isDone ? "text-muted-2 line-through" : "text-ink font-medium"}`}>{i + 1}. {s.title || (s.kind === "training" ? `${s.department} training` : "Step")}</div>
                {s.detail && <div className="text-[12.5px] text-muted-2">{s.detail}</div>}
              </div>
              {href && (
                <Link href={href} className="text-[12.5px] font-semibold text-brick inline-flex items-center gap-0.5 shrink-0">Open <ArrowUpRight size={13} /></Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
