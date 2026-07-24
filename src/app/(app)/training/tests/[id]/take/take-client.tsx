"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Lock, Clock, ArrowRight } from "lucide-react";
import { submitDay, type SubmitResult } from "../../run-actions";
import { t as translate, type Lang } from "@/lib/i18n";

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
  lang: Lang;
}) {
  const tr = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(props.lang, key, vars);
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [dayDone, setDayDone] = useState<number | null>(null); // the next day, once this one's submitted
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Any test day that carries learning material gets a distinct reading step
  // first (read → then quiz), regardless of the test's mode label — that's how
  // every test should read. A day with no learning content goes straight to the
  // questions.
  const hasLearnStep = !!props.dayContent?.trim();
  const [phase, setPhase] = useState<"learn" | "quiz">(hasLearnStep ? "learn" : "quiz");

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
        <div className="text-[19px] font-bold text-ink">{tr("test.youPassed", { title: props.title })}</div>
        <div className="text-[14px] text-muted mt-1">{tr("test.score")}: {props.bestScore ?? props.lastScore}% · {tr("test.passMark", { pct: props.passPct })}</div>
      </div>
    );
  }
  if (props.status === "locked") {
    return (
      <div className="bg-white border border-line rounded-2xl p-8 text-center">
        <Lock size={28} className="mx-auto text-brick mb-2" />
        <div className="text-[18px] font-bold text-ink">{tr("test.locked.title")}</div>
        <div className="text-[14px] text-muted mt-1 max-w-md mx-auto">{tr("test.locked.body", { pct: props.lastScore ?? 0 })}</div>
      </div>
    );
  }

  // Just-finished result (this attempt).
  if (result?.done) {
    if (result.passed) {
      return (
        <div className="bg-white border border-line rounded-2xl p-8 text-center">
          <CheckCircle2 size={32} className="mx-auto text-olive mb-2" />
          <div className="text-[19px] font-bold text-ink">{tr("test.passed.title", { pct: result.score ?? 0 })}</div>
          <div className="text-[14px] text-muted mt-1">{tr("test.passed.body", { pct: props.passPct })}</div>
        </div>
      );
    }
    if (result.locked) {
      return (
        <div className="bg-white border border-line rounded-2xl p-8 text-center">
          <Lock size={28} className="mx-auto text-brick mb-2" />
          <div className="text-[18px] font-bold text-ink">{tr("test.failLocked.title", { pct: result.score ?? 0 })}</div>
          <div className="text-[14px] text-muted mt-1 max-w-md mx-auto">{tr("test.failLocked.body")}</div>
        </div>
      );
    }
    return (
      <div className="bg-white border border-line rounded-2xl p-8 text-center">
        <div className="text-[18px] font-bold text-ink">{tr("test.fail.title", { pct: result.score ?? 0 })}</div>
        <div className="text-[14px] text-muted mt-1">{tr("test.fail.body", { pct: props.passPct })}</div>
        <button onClick={() => { setResult(null); setAnswers({}); router.refresh(); }} className="mt-4 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2 hover:bg-brick-dark">{tr("test.retake")}</button>
      </div>
    );
  }

  // Between days: they finished a day but there's more. Invite them to keep
  // going (they can), or stop and come back later — progress is saved.
  if (dayDone != null) {
    return (
      <div className="bg-white border border-line rounded-2xl p-8 text-center">
        <CheckCircle2 size={30} className="mx-auto text-olive mb-2" />
        <div className="text-[19px] font-bold text-ink">{tr("test.dayDone.title", { n: props.dayNumber })}</div>
        <p className="text-[14px] text-muted mt-1.5 max-w-md mx-auto">
          {tr("test.dayDone.body", { next: dayDone })}
        </p>
        <div className="flex items-center justify-center gap-3 mt-5">
          <button onClick={() => { setDayDone(null); setAnswers({}); router.refresh(); }} className="inline-flex items-center gap-2 text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors">
            {tr("test.keepGoing", { next: dayDone })} <ArrowRight size={15} />
          </button>
          <Link href="/training/tests" className="text-[14px] font-semibold text-muted-2 hover:text-ink">{tr("test.finishLater")}</Link>
        </div>
      </div>
    );
  }

  // Step 1 — Learn: read the material, then advance to the quiz. Questions are
  // hidden until they choose to start, so it reads as two clear screens.
  if (hasLearnStep && phase === "learn") {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink">{props.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[13px] text-muted">
            <span className="font-semibold text-brick">{tr("test.learnStep")}</span>
            <span>·</span><span>{tr("test.dayOf", { n: props.dayNumber, count: props.dayCount })}</span>
          </div>
          <p className="text-[14px] text-muted mt-1">{tr("test.readFirst")}</p>
        </div>

        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          {props.dayTitle && <div className="text-[16px] font-semibold text-ink mb-2">{props.dayTitle}</div>}
          <div className="text-[14px] text-charcoal-2 whitespace-pre-wrap leading-relaxed">{props.dayContent}</div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setPhase("quiz")} className="inline-flex items-center gap-2 text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors">
            {tr("test.startQuiz")} <ArrowRight size={15} />
          </button>
          <Link href="/training/tests" className="text-[14px] font-semibold text-muted-2 hover:text-ink">{tr("test.finishLater")}</Link>
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
          {hasLearnStep && <><span className="font-semibold text-brick">{tr("test.quizStep")}</span><span>·</span></>}
          <span className="font-semibold text-charcoal-2">{tr("test.dayOf", { n: props.dayNumber, count: props.dayCount })}</span>
          <span>·</span><span>{tr("test.pass", { pct: props.passPct })}</span>
          <span>·</span><span className="inline-flex items-center gap-1"><Clock size={12} /> {props.dueLabel}</span>
          {props.attemptsUsed > 0 && <><span>·</span><span>{tr("test.attemptOf", { n: props.attemptsUsed + 1, total: 1 + props.maxRetakes })}</span></>}
        </div>
      </div>

      {hasLearnStep && (
        <button onClick={() => setPhase("learn")} className="self-start inline-flex items-center gap-1.5 text-[13px] font-semibold text-brick hover:text-brick-dark transition-colors">
          <ArrowRight size={14} className="rotate-180" /> {tr("test.reviewMaterial")}
        </button>
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
        {props.questions.length === 0 && <div className="text-[14px] text-muted">{tr("test.noQuestions")}</div>}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={pending || !answered} className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-50 inline-flex items-center gap-2">
          {pending && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {pending ? tr("test.submitting") : isLastDay ? tr("test.submitScore") : tr("test.finishDay", { n: props.dayNumber })}
        </button>
        {!answered && <span className="text-[13px] text-muted-2">{tr("test.answerEvery")}</span>}
        {err && <span className="text-[13px] text-danger">{err}</span>}
      </div>
    </div>
  );
}
