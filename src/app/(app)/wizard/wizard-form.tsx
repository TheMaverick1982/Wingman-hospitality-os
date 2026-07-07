"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Field, inputClass } from "@/components/ui/field";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { generateAndApplySystem, type WizardState } from "./actions";

const STEPS = ["Basics", "Departments", "Standards", "Priorities", "Signature", "Generate"];
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
  const [depts, setDepts] = useState<Department[]>([...ALL_DEPARTMENTS]);
  const [greatService, setGreatService] = useState("");
  const [painPoint, setPainPoint] = useState("");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [signature, setSignature] = useState("");
  const [state, formAction] = useActionState(generateAndApplySystem, initialState);

  const toggleDept = (d: Department) =>
    setDepts((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const togglePriority = (p: string) =>
    setPriorities((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 rounded-full flex-1 ${i <= step ? "bg-brick" : "bg-line"}`} />
        ))}
      </div>

      {state.error && (
        <div className="bg-brick-tint rounded-2xl p-5 flex items-start gap-3 mb-6">
          <AlertCircle size={18} className="text-brick-dark shrink-0 mt-0.5" />
          <p className="text-sm text-brick-dark">{state.error}</p>
        </div>
      )}

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
                  className={`px-4 py-2 rounded-lg text-sm font-semibold font-mono border ${
                    price === p ? "bg-charcoal text-white border-charcoal" : "bg-panel text-ink border-line"
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
                  depts.includes(d) ? "bg-olive-tint border-olive/30" : "bg-panel border-line"
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
                  priorities.includes(p) ? "bg-gold-tint border-gold/30" : "bg-panel border-line"
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
          <div className="bg-panel border border-line rounded-2xl p-5 flex flex-col gap-2 mb-2">
            <Row label="Restaurant" value={`${name} — ${concept} (${price})`} />
            <Row label="Departments" value={depts.join(", ") || "None selected"} />
            <Row label="Priorities" value={priorities.length ? priorities.join(", ") : "General excellence"} />
          </div>
          <p className="text-xs text-muted flex items-center gap-1 mb-6">
            <RefreshCw size={12} /> This replaces your current culture statement, core values, and
            training for the selected departments.
          </p>

          <div className="flex justify-between">
            <Btn kind="ghost" icon={ChevronLeft} type="button" onClick={() => setStep(4)}>
              Back
            </Btn>
            <GenerateButton />
          </div>
        </form>
      )}

      {step < 5 && (
        <div className="flex justify-between mt-6">
          <Btn kind="ghost" icon={ChevronLeft} type="button" onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Back
          </Btn>
          <Btn type="button" onClick={() => setStep((s) => Math.min(5, s + 1))} disabled={step === 1 && depts.length === 0}>
            Next <ChevronRight size={15} />
          </Btn>
        </div>
      )}
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
    <Btn type="submit" disabled={pending} icon={pending ? undefined : Wand2}>
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
