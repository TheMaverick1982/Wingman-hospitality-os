"use client";

import { useState } from "react";
import Link from "next/link";
import { captureLead } from "../lead-actions";

type Q = { id: string; pillar: string; text: string; fix: string };

const QUESTIONS: Q[] = [
  { id: "retention", pillar: "Retention tracking", text: "You track which first-time guests come back.", fix: "Start logging first visits and returns — you can't grow what you don't measure." },
  { id: "culture", pillar: "Culture", text: "Your team knows your culture statement and core values.", fix: "Write a one-line culture statement and five values your team can recite." },
  { id: "training", pillar: "Training", text: "Every role has clear, written training standards.", fix: "Give each role a short, checkable standard for their shift." },
  { id: "accountability", pillar: "Accountability", text: "Managers run regular spot-checks and coaching.", fix: "Add weekly manager spot-checks with coaching flags." },
  { id: "recovery", pillar: "Service recovery", text: "You have a set process to make things right when a guest has a bad experience.", fix: "Create a simple service-recovery playbook so any issue gets made right." },
  { id: "preshift", pillar: "Pre-shift focus", text: "You run pre-shift meetings with a specific guest-experience focus.", fix: "Run a 5-minute pre-shift with one guest-experience focus." },
  { id: "measurement", pillar: "Measurement", text: "You know your repeat / return rate.", fix: "Track repeat rate monthly so you can see the trend." },
  { id: "recognition", pillar: "Recognition", text: "You recognize staff for great guest moments.", fix: "Recognize one standout guest moment every shift." },
  { id: "bounceback", pillar: "Guest bounce-back", text: "You have a deliberate way to turn first-timers into regulars.", fix: "Give first-timers a reason and a nudge to come back." },
  { id: "hiring", pillar: "Hiring", text: "You screen new hires for hospitality attitude, not just experience.", fix: "Screen for attitude with a few hospitality-first interview questions." },
];

const OPTIONS = [
  { label: "No", value: 0 },
  { label: "Sometimes", value: 1 },
  { label: "Yes", value: 2 },
];

function gradeFor(pct: number): { grade: string; blurb: string } {
  if (pct >= 85) return { grade: "A", blurb: "You're running a tight, guest-first operation. Small tweaks compound." };
  if (pct >= 70) return { grade: "B", blurb: "Strong foundation with a few clear gaps to close." };
  if (pct >= 55) return { grade: "C", blurb: "The pieces are there but inconsistent — system beats willpower." };
  if (pct >= 40) return { grade: "D", blurb: "A lot of upside. A repeatable system would move the needle fast." };
  return { grade: "F", blurb: "Big opportunity — most of your retention is being left to chance." };
}

export function ScorecardClient() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [scored, setScored] = useState(false);
  const [email, setEmail] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answeredAll = QUESTIONS.every((q) => answers[q.id] !== undefined);
  const total = QUESTIONS.reduce((t, q) => t + (answers[q.id] ?? 0), 0);
  const pct = Math.round((total / (QUESTIONS.length * 2)) * 100);
  const { grade, blurb } = gradeFor(pct);
  const weakest = [...QUESTIONS].sort((a, b) => (answers[a.id] ?? 0) - (answers[b.id] ?? 0)).slice(0, 3);

  async function getReport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await captureLead({
      source: "scorecard",
      email,
      payload: { pct, grade, answers },
      summary: `Scored ${pct}% (${grade}). Weakest: ${weakest.map((w) => w.pillar).join(", ")}`,
      resultHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:520px;">
        <p style="font-size:16px;">Your Wingman Hospitality Scorecard:</p>
        <p style="font-size:32px;font-weight:700;margin:6px 0;">${grade} · ${pct}%</p>
        <p style="font-size:15px;color:#525252;">Your three biggest opportunities:</p>
        <ul style="font-size:15px;color:#1a1a1a;">${weakest.map((w) => `<li><strong>${w.pillar}:</strong> ${w.fix}</li>`).join("")}</ul>
        <p style="font-size:15px;">Wingman builds all of this into one system. <a href="https://www.joinwingman.app/signup" style="color:#0a6cff;font-weight:600;">Start free</a>.</p>
      </div>`,
    });
    setBusy(false);
    if (res.error) setError(res.error);
    else setRevealed(true);
  }

  if (!scored) {
    return (
      <div className="bg-white border border-line rounded-[22px] p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-5">
          {QUESTIONS.map((q, i) => (
            <div key={q.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-3 border-b border-[#F1F1F1] last:border-0">
              <div className="flex-1 text-[15px] text-ink">
                <span className="text-muted-2 font-semibold mr-1.5">{i + 1}.</span>
                {q.text}
              </div>
              <div className="flex gap-2 shrink-0">
                {OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.value }))}
                    className={`text-[13px] font-semibold rounded-full px-3.5 py-1.5 border transition-colors ${
                      answers[q.id] === o.value ? "bg-brick text-white border-brick" : "text-charcoal-2 border-line hover:border-brick"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 mt-6">
          <span className="text-[13px] text-muted-2">{Object.keys(answers).length}/{QUESTIONS.length} answered</span>
          <button
            type="button"
            disabled={!answeredAll}
            onClick={() => setScored(true)}
            className="text-[16px] font-semibold text-white bg-brick rounded-full px-7 py-3 hover:bg-brick-dark transition-colors disabled:opacity-40"
          >
            See my score
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="bg-[#0A0A0A] rounded-[22px] p-8 shadow-2xl text-white text-center">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-[#8FB6FF] mb-3">Your hospitality score</div>
        <div className="text-7xl font-bold tracking-[-0.03em]">{grade}</div>
        <div className="text-[17px] text-[#A1A1A1] mt-1">{pct}%</div>
        <p className="text-[15px] text-[#E5E5E5] leading-relaxed mt-4 max-w-[320px] mx-auto">{blurb}</p>
      </div>

      <div className="bg-white border border-line rounded-[22px] p-6 sm:p-8 shadow-sm">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-2 mb-3">Your 3 biggest opportunities</div>
        <ol className="flex flex-col gap-3 mb-5">
          {weakest.map((w) => (
            <li key={w.id} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-brick-tint text-brick flex items-center justify-center text-[13px] font-bold">!</span>
              <div>
                <div className="text-[15px] font-semibold text-ink">{w.pillar}</div>
                {revealed && <div className="text-[14px] text-muted leading-relaxed mt-0.5">{w.fix}</div>}
              </div>
            </li>
          ))}
        </ol>

        {revealed ? (
          <div>
            <p className="text-[15px] text-olive font-semibold mb-4">Full scorecard sent to your inbox.</p>
            <Link href="/signup" className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-3 hover:bg-brick-dark transition-colors">Start free</Link>
          </div>
        ) : (
          <form onSubmit={getReport} className="flex flex-col gap-2.5">
            <div className="text-[14px] text-charcoal-2">Get the fixes + your full scorecard emailed:</div>
            <div className="flex gap-2">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.com" className="flex-1 rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-brick" />
              <button type="submit" disabled={busy} className="shrink-0 text-[15px] font-semibold text-white bg-brick rounded-xl px-5 hover:bg-brick-dark disabled:opacity-60">{busy ? "…" : "Get it"}</button>
            </div>
            {error && <p className="text-[13px] text-danger">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
