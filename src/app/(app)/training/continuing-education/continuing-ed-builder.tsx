"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, Check, Eye, Send } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import type { Department } from "@/lib/constants";
import { proposeTest, applyTest, type ProposeState } from "../tests/actions";

const initial: ProposeState = { error: null };

// A dedicated, AI-assisted builder for a monthly hospitality refresher. It asks
// the few things the AI needs (focus, audience), drafts a short learn-then-quiz,
// and — once approved — saves it as a continuing-education module (rotates
// monthly). Reuses the same generator as the main test builder.
export function ContinuingEdBuilder({ departments }: { departments: Department[] }) {
  const [state, formAction, pending] = useActionState(proposeTest, initial);
  const [audience, setAudience] = useState<string>("all");
  const [creating, startCreate] = useTransition();
  const [created, setCreated] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const monthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (created) {
    return (
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 text-[#15803D] font-semibold mb-2">
          <Check size={18} /> Your monthly refresher is ready
        </div>
        <p className="text-sm text-muted mb-4">
          It&apos;s set to re-assign as a fresh attempt on the 1st of each month. Review or fine-tune it, preview how staff
          will see it, or hand it out now.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/training/tests/${created}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark transition-colors">
            <Sparkles size={14} /> Review &amp; edit
          </Link>
          <Link href={`/training/tests/${created}/preview`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors">
            <Eye size={14} /> Preview
          </Link>
          <Link href={`/training/tests/${created}/assign`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors">
            <Send size={14} /> Assign now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={17} className="text-brick" />
        <span className="text-[16px] font-semibold text-ink">Build a monthly refresher with AI</span>
      </div>
      <p className="text-sm text-muted mb-4">
        Answer a couple of questions and Wingman drafts a short learn-then-quiz refresher — a &ldquo;day one&rdquo; that
        teaches, then checks understanding. You review everything before it goes live.
      </p>

      {!state.days ? (
        <form action={formAction} className="flex flex-col gap-4">
          {/* Continuing-education presets — a short, monthly, learn-then-quiz module. */}
          <input type="hidden" name="mode" value="study_quiz" />
          <input type="hidden" name="rotates_monthly" value="on" />
          <input type="hidden" name="day_count" value="1" />
          <input type="hidden" name="pass_pct" value="80" />
          <input type="hidden" name="max_retakes" value="2" />
          <input type="hidden" name="complete_within_amount" value="14" />
          <input type="hidden" name="complete_within_unit" value="days" />
          {audience !== "all" && <input type="hidden" name="target_departments" value={audience} />}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Title</span>
            <input name="title" defaultValue={`Monthly Hospitality Refresh — ${monthName}`} className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Who&apos;s it for?</span>
            <select value={audience} onChange={(e) => setAudience(e.target.value)} className={inputClass}>
              <option value="all">All staff — the hospitality standard everyone shares</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d} only — role-specific
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-2">
              Top-level hospitality should be the standard for every role; use a role for department-specific things.
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">What should this month&apos;s refresher teach?</span>
            <textarea
              name="topic"
              rows={4}
              placeholder="e.g. Warm greetings within 30 seconds, reading a table's mood, the 3-touch check-back, naming one genuine recommendation, and recovering a mistake gracefully."
              className={inputClass}
            />
            <span className="text-xs text-muted-2">Describe the focus in your own words — the AI turns it into a short lesson + quiz.</span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Optional: paste any notes or material to build from</span>
            <textarea name="material" rows={3} placeholder="Your own SOP, a section of your handbook, a manager's notes…" className={inputClass} />
          </label>

          {state.error && <p className="text-sm text-brick">{state.error}</p>}
          <div>
            <Btn type="submit" icon={Sparkles} loading={pending}>
              {pending ? "Drafting…" : "Draft with AI"}
            </Btn>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          {state.summary && <p className="text-sm text-charcoal-2">{state.summary}</p>}
          {state.days.map((day) => (
            <div key={day.day_number} className="rounded-xl border border-line p-4">
              <div className="text-[15px] font-semibold text-ink">{day.title}</div>
              {day.content && <p className="text-[13.5px] text-charcoal-2 mt-2 whitespace-pre-wrap leading-[1.5]">{day.content}</p>}
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mt-3 mb-1.5">
                Quiz — {day.questions.length} question{day.questions.length === 1 ? "" : "s"}
              </div>
              <ol className="flex flex-col gap-1.5">
                {day.questions.map((q, i) => (
                  <li key={i} className="text-[13px] text-charcoal-2 flex gap-2">
                    <span className="text-muted-2 shrink-0">{i + 1}.</span>
                    <span>{q.prompt}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}

          {createErr && <p className="text-sm text-brick">{createErr}</p>}
          <div className="flex flex-wrap gap-2">
            <Btn
              icon={Check}
              loading={creating}
              onClick={() => {
                if (!state.settings || !state.days) return;
                setCreateErr(null);
                startCreate(async () => {
                  const res = await applyTest(state.settings!, state.days!, "ai");
                  if (res.error) setCreateErr(res.error);
                  else setCreated(res.id ?? null);
                });
              }}
            >
              {creating ? "Creating…" : "Create monthly refresher"}
            </Btn>
            <Btn kind="ghost" onClick={() => window.location.reload()}>
              Start over
            </Btn>
          </div>
          <p className="text-xs text-muted-2">You can still edit every lesson and question after it&apos;s created.</p>
        </div>
      )}
    </div>
  );
}
