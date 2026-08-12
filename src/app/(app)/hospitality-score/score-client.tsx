"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Gauge, ArrowRight, Check, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { SCORE_STATEMENTS, MAX_SCORE, SCORE_COUNT, bandFor, totalScore } from "@/lib/hospitality-score";
import { submitAssessment } from "./actions";

export type AssessmentRow = { id: string; scores: number[]; total: number; createdAt: string };

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ScoreClient({ canTake, history }: { canTake: boolean; history: AssessmentRow[] }) {
  const latest = history[0] ?? null;
  const [taking, setTaking] = useState(false);
  const [scores, setScores] = useState<(number | null)[]>(Array(SCORE_COUNT).fill(null));
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const answered = scores.filter((s) => s !== null).length;
  const running = totalScore(scores.map((s) => s ?? 0));

  function submit() {
    if (answered < SCORE_COUNT) return;
    setErr(null);
    start(async () => {
      const res = await submitAssessment(scores as number[]);
      if (res.error) { setErr(res.error); return; }
      setTaking(false);
      setScores(Array(SCORE_COUNT).fill(null));
    });
  }

  const showForm = taking || (!latest && canTake);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="text-brick" size={22} />
            <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink">Hospitality Score</h1>
          </div>
          <p className="text-base text-muted max-w-xl mt-1.5">
            An honest read on how intentional your hospitality culture is — and exactly where to focus next. Rate ten
            statements, get a score out of {MAX_SCORE}, and retake it each quarter to watch it climb.
          </p>
        </div>
        {latest && canTake && !showForm && (
          <button onClick={() => { setScores(Array(SCORE_COUNT).fill(null)); setTaking(true); setErr(null); }} className="shrink-0 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark">
            Retake assessment
          </button>
        )}
      </div>

      {showForm ? (
        <AssessmentForm
          scores={scores}
          setScores={setScores}
          answered={answered}
          running={running}
          pending={pending}
          err={err}
          onSubmit={submit}
          onCancel={latest ? () => { setTaking(false); setErr(null); } : undefined}
        />
      ) : latest ? (
        <Result latest={latest} history={history} />
      ) : (
        <div className="bg-white border border-line rounded-2xl p-8 text-center shadow-sm">
          <p className="text-[15px] text-muted">No assessment yet. The owner takes the Hospitality Score to set a baseline for the whole team.</p>
        </div>
      )}
    </div>
  );
}

function ScalePicker({ value, onPick }: { value: number | null; onPick: (n: number) => void }) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            aria-label={`${n} out of 10`}
            className={`h-9 rounded-lg border text-[13px] font-semibold tabular-nums transition-colors ${
              active ? "border-brick bg-brick text-white" : "border-line text-muted-2 hover:border-brick hover:text-brick"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function AssessmentForm({
  scores, setScores, answered, running, pending, err, onSubmit, onCancel,
}: {
  scores: (number | null)[];
  setScores: (s: (number | null)[]) => void;
  answered: number;
  running: number;
  pending: boolean;
  err: string | null;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-paper border border-line rounded-2xl p-4 text-[13.5px] text-charcoal-2">
        Rate each statement from <strong>1 (strongly disagree)</strong> to <strong>10 (completely agree)</strong>. There&rsquo;s no right answer — only your honest one. The more honest you are, the more useful your focus areas will be.
      </div>

      {SCORE_STATEMENTS.map((s, i) => (
        <div key={s.id} className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <div className="text-[14.5px] font-semibold text-ink">{i + 1}. {s.text}</div>
            <div className="text-[13px] text-muted-2 tabular-nums shrink-0">{scores[i] ?? "—"}/10</div>
          </div>
          <ScalePicker value={scores[i]} onPick={(n) => { const next = [...scores]; next[i] = n; setScores(next); }} />
        </div>
      ))}

      <div className="sticky bottom-3 z-10 bg-white border border-line rounded-2xl p-4 shadow-md flex items-center justify-between gap-4 flex-wrap">
        <div className="text-[13.5px] text-charcoal-2">
          <span className="font-semibold text-ink tabular-nums">{answered}/{SCORE_COUNT}</span> answered
          {answered === SCORE_COUNT && <span className="ml-2">· running total <span className="font-semibold text-ink tabular-nums">{running}/{MAX_SCORE}</span></span>}
        </div>
        <div className="flex items-center gap-2">
          {err && <span className="text-[13px] text-danger">{err}</span>}
          {onCancel && <button onClick={onCancel} className="text-[13.5px] font-semibold text-muted-2 hover:text-ink">Cancel</button>}
          <button onClick={onSubmit} disabled={pending || answered < SCORE_COUNT} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark disabled:opacity-50">
            <Check size={15} /> {pending ? "Saving…" : "See my score"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Result({ latest, history }: { latest: AssessmentRow; history: AssessmentRow[] }) {
  const band = bandFor(latest.total);
  const prev = history[1] ?? null;
  const delta = prev ? latest.total - prev.total : null;

  // Lowest-scoring statements = the focus areas. Ties broken by original order.
  const ranked = SCORE_STATEMENTS.map((s, i) => ({ s, i, score: latest.scores[i] ?? 0 }))
    .sort((a, b) => a.score - b.score);
  const focus = ranked.slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      {/* Score hero */}
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[52px] leading-none font-bold text-ink tabular-nums">{latest.total}</span>
            <span className="text-[20px] text-muted-2 font-semibold">/{MAX_SCORE}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[13px] font-bold px-3 py-1 rounded-full ${band.bg} ${band.fg}`}>{band.label}</span>
              {delta !== null && (
                <span className={`inline-flex items-center gap-1 text-[13px] font-semibold ${delta > 0 ? "text-[#15803D]" : delta < 0 ? "text-danger" : "text-muted-2"}`}>
                  {delta > 0 ? <TrendingUp size={14} /> : delta < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                  {delta > 0 ? `+${delta}` : delta} since last time
                </span>
              )}
            </div>
            <p className="text-[14px] text-charcoal-2 mt-1.5 max-w-xl">{band.blurb}</p>
            <p className="text-[12px] text-muted-2 mt-1">Taken {when(latest.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Focus areas */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-3">Focus here first — your lowest three</h2>
        <div className="flex flex-col gap-3">
          {focus.map(({ s, score }) => (
            <div key={s.id} className="bg-white border border-line rounded-2xl p-5 shadow-sm">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <div className="text-[14.5px] font-semibold text-ink">{s.text}</div>
                <span className="text-[13px] font-semibold text-muted tabular-nums shrink-0">{score}/10</span>
              </div>
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? "bg-brick" : "bg-line"}`} />
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {s.fixes.map((f) => (
                  <Link key={f.href + f.label} href={f.href} className="group flex items-start gap-2 rounded-xl border border-line hover:border-brick p-3 transition-colors">
                    <ArrowRight size={15} className="text-brick mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-ink group-hover:text-brick">{f.label}</div>
                      <div className="text-[12.5px] text-muted">{f.why}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full breakdown */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-3">Every statement</h2>
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          {SCORE_STATEMENTS.map((s, i) => {
            const score = latest.scores[i] ?? 0;
            return (
              <div key={s.id} className="flex items-center gap-3">
                <div className="w-40 sm:w-56 shrink-0 text-[13px] text-charcoal-2 truncate" title={s.text}>{s.area}</div>
                <div className="flex gap-0.5 flex-1">
                  {Array.from({ length: 10 }, (_, j) => (
                    <span key={j} className={`h-2 flex-1 rounded-full ${j < score ? "bg-brick/80" : "bg-line"}`} />
                  ))}
                </div>
                <div className="w-10 text-right text-[13px] font-semibold text-muted tabular-nums shrink-0">{score}/10</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trend */}
      {history.length > 1 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-2 mb-3">Your trend</h2>
          <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
            <div className="flex items-end gap-3 h-32">
              {[...history].reverse().map((h) => (
                <div key={h.id} className="flex-1 h-full flex flex-col items-center justify-end group" title={`${when(h.createdAt)}: ${h.total}/${MAX_SCORE}`}>
                  <span className="text-[11px] font-semibold text-charcoal-2 tabular-nums mb-1">{h.total}</span>
                  <div className="w-full rounded-t bg-brick/80 group-hover:bg-brick transition-colors" style={{ height: `${Math.max(3, (h.total / MAX_SCORE) * 100)}%` }} />
                  <span className="text-[10px] text-muted-2 mt-1 text-center leading-tight">{when(h.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
