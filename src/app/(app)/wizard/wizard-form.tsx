"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, RefreshCw, AlertCircle, Wand2 } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Field, inputClass } from "@/components/ui/field";
import { ALL_DEPARTMENTS, WIZARD_DEFAULT_DEPARTMENTS, type Department } from "@/lib/constants";
import { generateAndApplySystem, type WizardState } from "./actions";

const STEP_META = [
  {
    name: "Your concept",
    eyebrow: "Step 1 · Your concept",
    title: "Tell us about your restaurant.",
    subtitle: "The basics — we'll use this to calibrate everything else.",
  },
  {
    name: "Departments",
    eyebrow: "Step 2 · Departments",
    title: "Which roles need training built?",
    subtitle: "You can regenerate individual departments later.",
  },
  {
    name: "Your standard",
    eyebrow: "Step 3 · Your standard",
    title: "What does great service look like at your place?",
    subtitle: "Answer in your own words. Wingman turns this into your culture statement and training.",
  },
  {
    name: "Priorities",
    eyebrow: "Step 4 · Priorities",
    title: "What should the training emphasize?",
    subtitle: "We'll weight the standards and training toward these.",
  },
  {
    name: "Signature touch",
    eyebrow: "Step 5 · Signature touch",
    title: "Any signature moment you already do?",
    subtitle: "Optional — a detail that makes your hospitality distinctly yours.",
  },
  {
    name: "Generate",
    eyebrow: "Step 6 · Generate",
    title: "Ready to build your system.",
    subtitle: "Review what we'll generate, then let Wingman draft it.",
  },
];

const CONCEPTS = ["Fine Dining", "Upscale Casual", "Casual / Family", "Fast Casual", "Bar & Grill", "Cafe / Bakery"];
const PRICES = ["$", "$$", "$$$", "$$$$"];
const PRIORITY_OPTIONS = [
  "Recognition & personalization",
  "Speed & attentiveness",
  "Suggestive selling / raising check average",
  "First-time guest conversion (bounce-back)",
  "Problem prevention & recovery",
  "Team energy & culture",
];

const initialState: WizardState = { error: null };

export function WizardForm({ orgName }: { orgName: string }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(orgName);
  const [concept, setConcept] = useState(CONCEPTS[2]);
  const [price, setPrice] = useState(PRICES[1]);
  const [depts, setDepts] = useState<Department[]>([...WIZARD_DEFAULT_DEPARTMENTS]);
  const [greatService, setGreatService] = useState("");
  const [painPoint, setPainPoint] = useState("");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [signature, setSignature] = useState("");
  const [state, formAction] = useActionState(generateAndApplySystem, initialState);

  const toggleDept = (d: Department) =>
    setDepts((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const togglePriority = (p: string) =>
    setPriorities((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const meta = STEP_META[step];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 lg:gap-12 items-start">
      <div className="lg:sticky lg:top-6 flex lg:flex-col gap-1 overflow-x-auto">
        {STEP_META.map((s, i) => {
          const isDone = i < step;
          const isCurrent = i === step;
          return (
            <div
              key={s.name}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] shrink-0 ${isCurrent ? "bg-brick-tint" : ""}`}
            >
              <span
                className={`shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-bold ${
                  isDone || isCurrent
                    ? "bg-brick text-white"
                    : "bg-white text-muted-2 border-[1.5px] border-line-strong"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </span>
              <div className={`text-sm whitespace-nowrap ${isCurrent ? "font-bold text-brick-dark" : "font-medium text-ink"}`}>
                {s.name}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="text-[13px] font-semibold tracking-[0.06em] uppercase text-brick mb-3">{meta.eyebrow}</div>
        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-[-0.025em] leading-[1.1] text-ink mb-3">{meta.title}</h1>
        <p className="text-base sm:text-[17px] text-muted leading-[1.5] mb-8">{meta.subtitle}</p>

        {state.error && (
          <div className="bg-brick-tint rounded-2xl p-5 flex items-start gap-3 mb-6">
            <AlertCircle size={18} className="text-brick-dark shrink-0 mt-0.5" />
            <p className="text-sm text-brick-dark">{state.error}</p>
          </div>
        )}

        <div className="bg-white border border-line rounded-[20px] p-6 sm:p-8 shadow-sm">
          {step === 0 && (
            <div>
              <Field label="Restaurant / brand name">
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Concept">
                <select value={concept} onChange={(e) => setConcept(e.target.value)} className={inputClass}>
                  {CONCEPTS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Price point">
                <div className="flex gap-2">
                  {PRICES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPrice(p)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
                        price === p ? "bg-charcoal text-white border-charcoal" : "bg-paper text-ink border-line"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="text-sm text-muted mb-4">
                Which departments should we build training for? You can regenerate later.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {ALL_DEPARTMENTS.map((d) => (
                  <label
                    key={d}
                    className={`flex items-center gap-3 p-3.5 rounded-lg cursor-pointer border ${
                      depts.includes(d) ? "bg-olive-tint border-olive/30" : "bg-paper border-line"
                    }`}
                  >
                    <input type="checkbox" checked={depts.includes(d)} onChange={() => toggleDept(d)} className="accent-olive" />
                    <span className="text-sm font-semibold text-ink">{d}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <Field label="What does great guest experience actually look like at your place?">
                <textarea
                  value={greatService}
                  onChange={(e) => setGreatService(e.target.value)}
                  rows={3}
                  placeholder="e.g. Every guest feels like a regular, even on their first visit. We guide them, we don't just take orders."
                  className={inputClass}
                />
              </Field>
              <Field label="What's the #1 gap you see right now — from guests or staff?">
                <textarea
                  value={painPoint}
                  onChange={(e) => setPainPoint(e.target.value)}
                  rows={3}
                  placeholder="e.g. Staff greet guests fine but never follow through on the bounce-back offer"
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-sm text-muted mb-4">
                Pick your top guest experience priorities. We&apos;ll weight the training toward these.
              </p>
              <div className="flex flex-col gap-2.5">
                {PRIORITY_OPTIONS.map((p) => (
                  <label
                    key={p}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border ${
                      priorities.includes(p) ? "bg-gold-tint border-gold/30" : "bg-paper border-line"
                    }`}
                  >
                    <input type="checkbox" checked={priorities.includes(p)} onChange={() => togglePriority(p)} className="accent-gold" />
                    <span className="text-sm text-ink">{p}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <Field label="Any signature touch or ritual you already do? (optional)">
                <textarea
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  rows={3}
                  placeholder="e.g. We drop a red napkin at the table for every first-time guest"
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {step === 5 && (
            <form action={formAction}>
              <input type="hidden" name="name" value={name} />
              <input type="hidden" name="concept" value={concept} />
              <input type="hidden" name="price" value={price} />
              <input type="hidden" name="greatService" value={greatService} />
              <input type="hidden" name="painPoint" value={painPoint} />
              <input type="hidden" name="signature" value={signature} />
              {depts.map((d) => (
                <input key={d} type="hidden" name="depts" value={d} />
              ))}
              {priorities.map((p) => (
                <input key={p} type="hidden" name="priorities" value={p} />
              ))}

              <p className="text-sm text-charcoal-2 mb-4">Ready to generate. Here&apos;s what we&apos;ll build:</p>
              <div className="bg-paper border border-line rounded-2xl p-5 flex flex-col gap-2 mb-2">
                <Row label="Restaurant" value={`${name} — ${concept} (${price})`} />
                <Row label="Departments" value={depts.join(", ") || "None selected"} />
                <Row label="Priorities" value={priorities.length ? priorities.join(", ") : "General excellence"} />
              </div>
              <p className="text-xs text-muted flex items-center gap-1 mb-2">
                <RefreshCw size={12} /> This replaces your current culture statement, core values, and
                training for the selected departments.
              </p>

              <div className="flex items-center justify-between mt-6">
                <Btn kind="ghost" type="button" onClick={() => setStep(4)} className="rounded-full">
                  ← Back
                </Btn>
                <GenerateButton />
              </div>
            </form>
          )}
        </div>

        {step < 5 && (
          <div className="flex items-center justify-between mt-7">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="text-[15px] font-semibold text-ink bg-white border border-line-strong rounded-full px-[22px] py-3 hover:bg-paper transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-2 hidden sm:inline">Takes about 3 minutes</span>
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(5, s + 1))}
                disabled={step === 1 && depts.length === 0}
                className="text-[15px] font-semibold text-white bg-brick rounded-full px-[26px] py-3 hover:bg-brick-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-ink font-semibold text-right">{value}</span>
    </div>
  );
}

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <Btn type="submit" disabled={pending} icon={pending ? undefined : Wand2} className="rounded-full">
      {pending ? (
        <>
          <Loader2 size={15} className="animate-spin" /> Drafting your system...
        </>
      ) : (
        "Generate my system"
      )}
    </Btn>
  );
}
