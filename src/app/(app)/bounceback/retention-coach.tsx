"use client";

import { useState, useTransition } from "react";
import { TrendingDown, Sparkles, ArrowRight, RotateCcw } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { dropLabel, type RetentionAnalysis, type LocationInsight } from "@/lib/retention-coach";
import { getRetentionQuestions, generateRetentionPlan, type LocationHint } from "./retention-coach-actions";

/** Renders the plan markdown: **bold** + line breaks. */
function PlanText({ text }: { text: string }) {
  return (
    <div className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
      {text.split("\n").map((line, i) => (
        <p key={i} className="mb-1.5 last:mb-0">
          {line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
            seg.startsWith("**") && seg.endsWith("**") ? (
              <strong key={j} className="font-semibold text-brick-dark">
                {seg.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{seg}</span>
            )
          )}
        </p>
      ))}
    </div>
  );
}

type Phase = "banner" | "questions" | "plan";

export function RetentionCoach({
  analysis,
  locationInsight,
  canEdit,
}: {
  analysis: RetentionAnalysis;
  locationInsight: LocationInsight | null;
  canEdit: boolean;
}) {
  const worst = analysis.worst;
  const [phase, setPhase] = useState<Phase>("banner");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [plan, setPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!analysis.hasSignal || !worst) return null;

  const stagesForModel = analysis.stages.map((s) => ({ fromVisit: s.fromVisit, toVisit: s.toVisit, retentionPct: s.retentionPct }));
  const locationHint: LocationHint = locationInsight
    ? { name: locationInsight.worst.name, pct: locationInsight.worst.retentionPct, groupAvgPct: locationInsight.groupAvgPct }
    : null;

  function startCoach() {
    setError(null);
    startTransition(async () => {
      const res = await getRetentionQuestions({ worst: worst!, stages: stagesForModel, locationHint });
      if (res.error) {
        setError(res.error);
        return;
      }
      setQuestions(res.questions);
      setAnswers(res.questions.map(() => ""));
      setPhase("questions");
    });
  }

  function buildPlan() {
    setError(null);
    startTransition(async () => {
      const qa = questions.map((q, i) => ({ question: q, answer: answers[i] ?? "" }));
      const res = await generateRetentionPlan({ worst: worst!, stages: stagesForModel, qa, locationHint });
      if (res.error) {
        setError(res.error);
        return;
      }
      setPlan(res.plan);
      setPhase("plan");
    });
  }

  function reset() {
    setPhase("banner");
    setPlan(null);
    setQuestions([]);
    setAnswers([]);
    setError(null);
  }

  return (
    <div className="bg-[#FDF3E1] border border-[#F0D9A8] rounded-2xl p-6">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-9 h-9 rounded-[10px] bg-white flex items-center justify-center text-[#B45309]">
          <TrendingDown size={17} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-ink">
            You&apos;re losing the most guests {dropLabel(worst)}
          </div>
          <p className="text-[13px] text-charcoal-2 mt-0.5 leading-relaxed">
            Only <span className="font-semibold text-ink">{worst.retentionPct}%</span> of guests who reach visit{" "}
            {worst.fromVisit} come back for visit {worst.toVisit}
            {locationInsight && (
              <>
                {" "}
                — and it&apos;s worst at <span className="font-semibold text-ink">{locationInsight.worst.name}</span> (
                {locationInsight.worst.retentionPct}% vs {locationInsight.groupAvgPct}% across your locations)
              </>
            )}
            . Let&apos;s work out why and build a plan.
          </p>

          {/* BANNER: call to action */}
          {phase === "banner" && canEdit && (
            <div className="mt-3.5">
              <Btn small icon={Sparkles} onClick={startCoach} loading={pending} disabled={pending}>
                {pending ? "Thinking..." : "Diagnose with the coach"}
              </Btn>
            </div>
          )}

          {/* QUESTIONS: guided Q&A */}
          {phase === "questions" && (
            <div className="mt-4 flex flex-col gap-4">
              <p className="text-[13px] text-charcoal-2">
                Answer what you can — the more honest the better. The coach turns your answers into a plan.
              </p>
              {questions.map((q, i) => (
                <div key={i}>
                  <label className="text-[13.5px] font-medium text-ink block mb-1.5">{q}</label>
                  <textarea
                    value={answers[i] ?? ""}
                    onChange={(e) => setAnswers((a) => a.map((v, idx) => (idx === i ? e.target.value : v)))}
                    rows={2}
                    placeholder="Your answer…"
                    className="w-full text-sm rounded-xl border border-line bg-white px-3.5 py-2.5 outline-none focus:border-brick resize-y"
                  />
                </div>
              ))}
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex items-center gap-2">
                <Btn small icon={ArrowRight} onClick={buildPlan} loading={pending} disabled={pending}>
                  {pending ? "Building your plan..." : "Build my plan"}
                </Btn>
                <Btn small kind="ghost" onClick={reset} disabled={pending}>
                  Cancel
                </Btn>
              </div>
            </div>
          )}

          {/* PLAN: the generated action plan */}
          {phase === "plan" && plan && (
            <div className="mt-4">
              <div className="bg-white border border-line rounded-xl p-5">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#B45309] mb-3">
                  <Sparkles size={13} /> Your retention plan
                </div>
                <PlanText text={plan} />
              </div>
              <div className="mt-3">
                <Btn small kind="ghost" icon={RotateCcw} onClick={reset}>
                  Start over
                </Btn>
              </div>
            </div>
          )}

          {phase === "banner" && error && <p className="text-sm text-danger mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}
