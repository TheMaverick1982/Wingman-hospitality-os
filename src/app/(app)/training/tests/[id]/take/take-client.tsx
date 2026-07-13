"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Lock, Clock, ArrowRight } from "lucide-react";
import { submitDay, type SubmitResult } from "../../run-actions";

type Q = { id: string; kind: string; prompt: string; options: string[] };

export function TakeClient(props: {
  assignmentId: string;
  testId: string;
  title: string;
  description: string;
  mode: string;
  dayNumber: number;
  dayCount: number;
  dayTitle: string;
  dayContent: string;
  questions: Q[];
  status: string;
  passPct: number;
  lastScore: number | null;
  bestScore: number | null;
  attemptsUsed: number;
  maxRetakes: number;
  dueLabel: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [dayDone, setDayDone] = useState<number | null>(null); // the next day, once this one's submitted
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const answered = props.questions.every((q) => answers[q.id] != null);

  function submit() {
    setErr(null);
    start(async () => {
      const res = await submitDay(props.assignmentId, props.dayNumber, answers);
      if (res.error) { setErr(res.error); return; }
      if (res.done) setResult(res);
      else setDayDone(res.nextDay ?? props.dayNumber + 1); // pause and invite them to continue
    });
  }

  // Terminal states.
  if (props.status === "passed") {
    return (
      <div className="bg-white border border-line rounded-2xl p-8 text-center">
        <CheckCircle2 size={32} className="mx-auto text-olive mb-2" />
        <div className="text-[19px] font-bold text-ink">You passed {props.title}</div>
        <div className="text-[14px] text-muted mt-1">Score: {props.bestScore ?? props.lastScore}% · pass mark {props.passPct}%</div>
      </div>
    );
  }
  if (props.status === "locked") {
    return (
      <div className="bg-white border border-line rounded-2xl p-8 text-center">
        <Lock size={28} className="mx-auto text-brick mb-2" />
        <div className="text-[18px] font-bold text-ink">This test is locked</div>
        <div className="text-[14px] text-muted mt-1 max-w-md mx-auto">You&rsquo;ve used all your attempts (last score {props.lastScore}%). Your manager has been notified — they&rsquo;ll coach you and unlock a retest.</div>
      </div>
    );
  }

  // Just-finished result (this attempt).
  if (result?.done) {
    if (result.passed) {
      return (
        <div className="bg-white border border-line rounded-2xl p-8 text-center">
          <CheckCircle2 size={32} className="mx-auto text-olive mb-2" />
          <div className="text-[19px] font-bold text-ink">Passed! {result.score}%</div>
          <div className="text-[14px] text-muted mt-1">Nice work — you cleared the {props.passPct}% mark.</div>
        </div>
      );
    }
    if (result.locked) {
      return (
        <div className="bg-white border border-line rounded-2xl p-8 text-center">
          <Lock size={28} className="mx-auto text-brick mb-2" />
          <div className="text-[18px] font-bold text-ink">Not passed — {result.score}%</div>
          <div className="text-[14px] text-muted mt-1 max-w-md mx-auto">That was your last attempt, so the test is now locked. Your manager has been notified to coach you and unlock a retest.</div>
        </div>
      );
    }
    return (
      <div className="bg-white border border-line rounded-2xl p-8 text-center">
        <div className="text-[18px] font-bold text-ink">Not quite — {result.score}%</div>
        <div className="text-[14px] text-muted mt-1">You need {props.passPct}%. Give it another go when you&rsquo;re ready.</div>
        <button onClick={() => { setResult(null); setAnswers({}); router.refresh(); }} className="mt-4 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2 hover:bg-brick-dark">Retake</button>
      </div>
    );
  }

  // Between days: they finished a day but there's more. Invite them to keep
  // going (they can), or stop and come back later — progress is saved.
  if (dayDone != null) {
    return (
      <div className="bg-white border border-line rounded-2xl p-8 text-center">
        <CheckCircle2 size={30} className="mx-auto text-olive mb-2" />
        <div className="text-[19px] font-bold text-ink">Day {props.dayNumber} done — nice work</div>
        <p className="text-[14px] text-muted mt-1.5 max-w-md mx-auto">
          If you&rsquo;re feeling good about it, keep going to Day {dayDone}. No rush, though —
          your progress is saved, so you can come back and finish anytime.
        </p>
        <div className="flex items-center justify-center gap-3 mt-5">
          <button onClick={() => { setDayDone(null); setAnswers({}); router.refresh(); }} className="inline-flex items-center gap-2 text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors">
            Keep going to Day {dayDone} <ArrowRight size={15} />
          </button>
          <Link href="/training/tests" className="text-[14px] font-semibold text-muted-2 hover:text-ink">I&rsquo;ll finish later</Link>
        </div>
      </div>
    );
  }

  const isLastDay = props.dayNumber >= props.dayCount;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink">{props.title}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[13px] text-muted">
          <span className="font-semibold text-charcoal-2">Day {props.dayNumber} of {props.dayCount}</span>
          <span>·</span><span>Pass {props.passPct}%</span>
          <span>·</span><span className="inline-flex items-center gap-1"><Clock size={12} /> {props.dueLabel}</span>
          {props.attemptsUsed > 0 && <><span>·</span><span>Attempt {props.attemptsUsed + 1} of {1 + props.maxRetakes}</span></>}
        </div>
      </div>

      {props.mode === "study_quiz" && props.dayContent && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          {props.dayTitle && <div className="text-[16px] font-semibold text-ink mb-2">{props.dayTitle}</div>}
          <div className="text-[14px] text-charcoal-2 whitespace-pre-wrap leading-relaxed">{props.dayContent}</div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {props.questions.map((q, qi) => (
          <div key={q.id} className="bg-white border border-line rounded-2xl p-5 shadow-sm">
            <div className="text-[15px] font-medium text-ink mb-3">{qi + 1}. {q.prompt}</div>
            <div className="flex flex-col gap-2">
              {q.options.map((o, i) => (
                <label key={i} className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors ${answers[q.id] === i ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"}`}>
                  <input type="radio" name={q.id} checked={answers[q.id] === i} onChange={() => setAnswers((p) => ({ ...p, [q.id]: i }))} className="accent-brick" />
                  <span className="text-[14px] text-ink">{o}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {props.questions.length === 0 && <div className="text-[14px] text-muted">No questions on this day.</div>}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={pending || !answered} className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-50 inline-flex items-center gap-2">
          {pending && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {pending ? "Submitting…" : isLastDay ? "Submit & score" : `Finish Day ${props.dayNumber}`}
        </button>
        {!answered && <span className="text-[13px] text-muted-2">Answer every question to continue.</span>}
        {err && <span className="text-[13px] text-danger">{err}</span>}
      </div>
    </div>
  );
}
