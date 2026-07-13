"use client";

import { useState } from "react";
import { Eye, EyeOff, Check, ArrowLeft, ArrowRight, ClipboardCheck } from "lucide-react";

type PreviewQuestion = { kind: string; prompt: string; options: string[]; correct_index: number; explanation: string };
export type PreviewDay = { day_number: number; title: string; content: string; questions: PreviewQuestion[] };

// Renders a test the way staff see it while taking it — day by day, study content
// then questions — but read-only: answers aren't scored or saved. A manager-only
// "answer key" toggle marks the correct option and shows the explanation.
export function TestPreview({ title, description, mode, passPct, days }: { title: string; description: string; mode: string; passPct: number; days: PreviewDay[] }) {
  const dayCount = days.length;
  const [dayIndex, setDayIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showKey, setShowKey] = useState(false);

  const day = days[dayIndex];
  const totalQuestions = days.reduce((n, d) => n + d.questions.length, 0);
  const isStudyQuiz = mode === "study_quiz";

  return (
    <div className="flex flex-col gap-5">
      {/* Preview banner + answer-key toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-brick-tint/60 border border-brick/20 rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-brick-dark">
          <ClipboardCheck size={15} className="shrink-0" />
          Preview — this is exactly what your staff see. Nothing here is saved or scored.
        </div>
        <button
          onClick={() => setShowKey((v) => !v)}
          className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold rounded-full px-3 py-1.5 border transition-colors ${showKey ? "border-brick bg-white text-brick-dark" : "border-brick/30 text-brick-dark hover:bg-white"}`}
        >
          {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
          {showKey ? "Hide answer key" : "Show answer key"}
        </button>
      </div>

      {/* Header — mirrors the take view */}
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink">{title}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[13px] text-muted">
          <span className="font-semibold text-charcoal-2">Day {day.day_number} of {dayCount}</span>
          <span>·</span><span>Pass {passPct}%</span>
          <span>·</span><span>{totalQuestions} question{totalQuestions === 1 ? "" : "s"} total</span>
        </div>
        {description && <p className="text-[14px] text-muted mt-1.5">{description}</p>}
      </div>

      {/* Study content (learn-then-quiz mode) */}
      {isStudyQuiz && day.content && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          {day.title && <div className="text-[16px] font-semibold text-ink mb-2">{day.title}</div>}
          <div className="text-[14px] text-charcoal-2 whitespace-pre-wrap leading-relaxed">{day.content}</div>
        </div>
      )}

      {/* Questions */}
      <div className="flex flex-col gap-4">
        {day.questions.map((q, qi) => {
          const key = `${dayIndex}:${qi}`;
          return (
            <div key={key} className="bg-white border border-line rounded-2xl p-5 shadow-sm">
              <div className="text-[15px] font-medium text-ink mb-3">{qi + 1}. {q.prompt}</div>
              <div className="flex flex-col gap-2">
                {q.options.map((o, i) => {
                  const chosen = answers[key] === i;
                  const isCorrect = showKey && i === q.correct_index;
                  return (
                    <label
                      key={i}
                      className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors ${
                        isCorrect ? "border-olive bg-olive/10" : chosen ? "border-brick bg-brick-tint" : "border-line hover:border-line-strong"
                      }`}
                    >
                      <input type="radio" name={key} checked={chosen} onChange={() => setAnswers((p) => ({ ...p, [key]: i }))} className="accent-brick" />
                      <span className="text-[14px] text-ink flex-1">{o}</span>
                      {isCorrect && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-olive"><Check size={13} /> Correct</span>}
                    </label>
                  );
                })}
              </div>
              {showKey && q.explanation && (
                <div className="mt-2.5 text-[12.5px] text-muted bg-paper rounded-lg px-3 py-2"><span className="font-semibold text-charcoal-2">Why:</span> {q.explanation}</div>
              )}
            </div>
          );
        })}
        {day.questions.length === 0 && (
          <div className="bg-white border border-line rounded-2xl p-6 text-center text-[14px] text-muted">No questions on this day yet.</div>
        )}
      </div>

      {/* Day navigation (local only) */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          onClick={() => setDayIndex((i) => Math.max(0, i - 1))}
          disabled={dayIndex === 0}
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors disabled:opacity-40"
        >
          <ArrowLeft size={15} /> Previous day
        </button>
        {dayIndex < dayCount - 1 ? (
          <button
            onClick={() => setDayIndex((i) => Math.min(dayCount - 1, i + 1))}
            className="inline-flex items-center gap-2 text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors"
          >
            Next day <ArrowRight size={15} />
          </button>
        ) : (
          <span className="text-[13px] font-semibold text-olive">End of the test</span>
        )}
      </div>
    </div>
  );
}
