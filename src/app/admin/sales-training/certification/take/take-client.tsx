"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, MessageSquare, Loader2 } from "lucide-react";
import { submitCert, type SubmittedAnswer, type CertResult } from "../actions";

export type ClientQuestion = { id: string; section: string; kind: "mcq" | "roleplay"; prompt: string; options: string[] };

export function TakeCert({ versionId, questions }: { versionId: string; questions: ClientQuestion[] }) {
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<CertResult | null>(null);

  const mcq = questions.filter((q) => q.kind === "mcq");
  const roleplay = questions.filter((q) => q.kind === "roleplay");
  const answeredMcq = mcq.filter((q) => choices[q.id] != null).length;
  const answeredRp = roleplay.filter((q) => (texts[q.id] ?? "").trim()).length;
  const allAnswered = answeredMcq === mcq.length && answeredRp === roleplay.length;

  const submit = () => {
    setErr(null);
    const answers: SubmittedAnswer[] = questions.map((q) =>
      q.kind === "mcq" ? { questionId: q.id, selectedIndex: choices[q.id] ?? null } : { questionId: q.id, responseText: texts[q.id] ?? "" },
    );
    start(async () => {
      const res = await submitCert(versionId, answers);
      if (res.error) setErr(res.error);
      else if (res.result) { setResult(res.result); window.scrollTo({ top: 0, behavior: "smooth" }); }
    });
  };

  if (result) return <ResultView result={result} />;

  let mcqIndex = 0;
  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div>
        <Link href="/admin/sales-training/certification" className="text-brick font-semibold text-sm">← Back</Link>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink mt-2">Sales certification test</h1>
        <p className="text-sm text-muted mt-1">Answer every question. Roleplay answers are graded by the AI with coaching feedback.</p>
      </div>

      {mcq.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-brick">Knowledge ({mcq.length})</div>
          {mcq.map((q) => {
            mcqIndex += 1;
            const n = mcqIndex;
            return (
              <div key={q.id} className="bg-white border border-line rounded-2xl p-5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-1">{q.section}</div>
                <div className="text-[15px] font-semibold text-ink mb-3">{n}. {q.prompt}</div>
                <div className="flex flex-col gap-2">
                  {q.options.map((opt, i) => {
                    const active = choices[q.id] === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setChoices((c) => ({ ...c, [q.id]: i }))}
                        className={`text-left text-[14px] rounded-xl border px-3.5 py-2.5 transition-colors ${active ? "border-brick bg-brick-tint text-ink font-medium" : "border-line text-charcoal-2 hover:border-brick/50"}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {roleplay.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-brick flex items-center gap-1.5"><MessageSquare size={13} /> Roleplay ({roleplay.length})</div>
          {roleplay.map((q, i) => (
            <div key={q.id} className="bg-white border border-line rounded-2xl p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-1">{q.section}</div>
              <div className="text-[15px] font-semibold text-ink mb-1">Scenario {i + 1}</div>
              <div className="text-[14px] text-charcoal-2 italic mb-3">“{q.prompt}”</div>
              <textarea
                value={texts[q.id] ?? ""}
                onChange={(e) => setTexts((t) => ({ ...t, [q.id]: e.target.value }))}
                rows={4}
                placeholder="Type exactly how you'd respond…"
                className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-brick resize-y"
              />
            </div>
          ))}
        </div>
      )}

      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending || !allAnswered}
          onClick={submit}
          className="inline-flex items-center gap-2 text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-3 hover:bg-brick-dark disabled:opacity-50"
        >
          {pending ? <><Loader2 size={16} className="animate-spin" /> Grading…</> : "Submit test"}
        </button>
        {!allAnswered && <span className="text-[12.5px] text-muted-2">Answer all {questions.length} to submit ({answeredMcq + answeredRp}/{questions.length}).</span>}
      </div>
    </div>
  );
}

function ResultView({ result }: { result: CertResult }) {
  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className={`rounded-2xl p-6 text-white shadow-md ${result.passed ? "bg-[#15803d]" : "bg-[#b42318]"}`}>
        <div className="flex items-center gap-3">
          {result.passed ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
          <div>
            <div className="text-[28px] font-bold leading-none tabular-nums">{result.scorePct}%</div>
            <div className="text-[14px] font-semibold opacity-90 mt-1">{result.passed ? "Certified — nice work." : "Not passed yet — review the misses and retake."}</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
        <div className="text-[13px] font-semibold text-ink mb-3">By section</div>
        <div className="flex flex-col gap-2.5">
          {result.sectionScores.map((s) => (
            <div key={s.section}>
              <div className="flex items-center justify-between text-[13px] mb-1">
                <span className="text-charcoal-2">{s.section}</span>
                <span className={`font-semibold tabular-nums ${s.pct >= 80 ? "text-[#15803d]" : s.pct >= 60 ? "text-[#b45309]" : "text-[#b42318]"}`}>{s.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-paper overflow-hidden">
                <div className={`h-full ${s.pct >= 80 ? "bg-[#15803d]" : s.pct >= 60 ? "bg-[#b45309]" : "bg-[#b42318]"}`} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {result.roleplay.length > 0 && (
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <div className="text-[13px] font-semibold text-ink mb-3">Roleplay feedback</div>
          <div className="flex flex-col gap-3">
            {result.roleplay.map((r, i) => (
              <div key={i} className="border border-line rounded-xl p-3.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[13px] text-charcoal-2 italic">“{r.prompt}”</span>
                  <span className={`text-[13px] font-semibold tabular-nums shrink-0 ${r.score >= 80 ? "text-[#15803d]" : r.score >= 60 ? "text-[#b45309]" : "text-[#b42318]"}`}>{r.score}%</span>
                </div>
                <div className="text-[13.5px] text-ink">{r.feedback}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.missed.length > 0 && (
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <div className="text-[13px] font-semibold text-ink mb-3">Review these ({result.missed.length})</div>
          <div className="flex flex-col gap-3">
            {result.missed.map((m, i) => (
              <div key={i} className="border border-line rounded-xl p-3.5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-1">{m.section}</div>
                <div className="text-[14px] font-semibold text-ink">{m.prompt}</div>
                <div className="text-[13.5px] text-[#15803d] mt-1">Correct: {m.correct}</div>
                {m.explanation && <div className="text-[13px] text-muted mt-1">{m.explanation}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Link href="/admin/sales-training/certification/take" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark">Retake</Link>
        <Link href="/admin/sales-training/certification" className="text-brick font-semibold text-sm">Done</Link>
      </div>
    </div>
  );
}
