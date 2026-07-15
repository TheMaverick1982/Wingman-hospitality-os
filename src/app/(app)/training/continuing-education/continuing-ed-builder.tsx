"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, Check, Eye, Send, CalendarClock } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import type { Department } from "@/lib/constants";
import { proposeTest, applyTest, type ProposeState } from "../tests/actions";

const initial: ProposeState = { error: null };

// Idea starters by audience. Hospitality/guest-experience is the baseline for
// everyone; roles get add-on suggestions (drink specs, plating, etc.) to spark
// ideas. Tapping one appends it to the focus for the AI to build from.
function suggestionsFor(aud: string): string[] {
  const a = aud.toLowerCase();
  if (a === "all")
    return [
      "Warm greeting within 30 seconds",
      "The 3-touch check-back",
      "One genuine recommendation per visit",
      "Reading a table's mood",
      "Recovering a mistake gracefully",
      "Making a returning guest feel remembered",
    ];
  if (a.includes("bar"))
    return [
      "Cocktail specs & builds for your core menu",
      "Wine & beer pairings to suggest",
      "Upselling top-shelf without pushing",
      "Responsible service / cutting someone off gracefully",
      "Speed & consistency behind the bar",
    ];
  if (a.includes("chef") || a.includes("kitchen") || a.includes("cook") || a.includes("line"))
    return [
      "Plating & consistency standards",
      "Allergen handling & cross-contamination",
      "Executing a new or LTO menu item",
      "Ticket times & expo communication",
      "Portion & waste control",
    ];
  if (a.includes("server"))
    return [
      "Describing dishes so they sell themselves",
      "Suggestive selling & pairings",
      "The check-back at the right moment",
      "Handling a complaint tableside",
      "Reading the table & pacing the meal",
    ];
  if (a.includes("host"))
    return ["Greeting & accurate wait quotes", "Seating flow & rotation", "Managing a waitlist & large parties", "VIP & returning-guest handoffs"];
  if (a.includes("manager") || a.includes("lead"))
    return ["Running a sharp pre-shift", "Coaching in the moment", "Service recovery that keeps the guest", "Setting the energy for the shift"];
  return ["A key standard for this role", "A skill that needs more consistency", "A recent gap to close"];
}

// A dedicated, AI-assisted builder for a monthly hospitality refresher. It asks
// the few things the AI needs (focus, audience), drafts a short learn-then-quiz,
// and — once approved — saves it as a continuing-education module (rotates
// monthly). Reuses the same generator as the main test builder.
export function ContinuingEdBuilder({ departments }: { departments: Department[] }) {
  const [state, formAction, pending] = useActionState(proposeTest, initial);
  const [audience, setAudience] = useState<string>("all");
  const [focus, setFocus] = useState("");
  const [problem, setProblem] = useState("");
  const [reaction, setReaction] = useState("");
  const [standard, setStandard] = useState("");
  const [creating, startCreate] = useTransition();
  const [created, setCreated] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const monthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Fold the guiding answers into one rich topic for the generator.
  const composedTopic = [
    focus.trim() && `Focus this month: ${focus.trim()}`,
    problem.trim() && `A behavior that slipped that we want to tighten up: ${problem.trim()}`,
    reaction.trim() && `The reaction guests should walk away with: ${reaction.trim()}`,
    standard.trim() && `What "great" looks like — the standard to hold: ${standard.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");

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
              Top-level hospitality should be the standard for every role; use a role for department-specific things —
              like drink specs for bartenders or plating for the kitchen.
            </span>
          </label>

          {/* Role-aware idea starters — tap to add to the focus. */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted">
              {audience === "all" ? "Hospitality ideas — tap to add" : `${audience} add-on ideas — tap to add`}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {suggestionsFor(audience).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFocus((f) => (f.trim() ? `${f.replace(/[,\s]+$/, "")}, ${s}` : s))}
                  className="text-[12.5px] text-charcoal-2 border border-line rounded-full px-3 py-1.5 hover:border-brick hover:text-brick transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency — monthly is the recommended cadence and how the cron runs. */}
          <div className="flex items-center gap-2 rounded-xl bg-olive-tint px-4 py-3">
            <CalendarClock size={16} className="text-[#15803d] shrink-0" />
            <span className="text-sm text-[#166534]">
              <span className="font-semibold">Frequency: Monthly</span> — re-assigned to your team as a fresh attempt on the 1st of each month. (Recommended — ongoing beats one-and-done.)
            </span>
          </div>

          {/* Hidden topic composed from the guiding answers below. */}
          <input type="hidden" name="topic" value={composedTopic} />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">What should this month&apos;s refresher teach?</span>
            <textarea
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              rows={3}
              placeholder="e.g. Warm greetings within 30 seconds, reading a table's mood, the 3-touch check-back, naming one genuine recommendation, and recovering a mistake gracefully."
              className={inputClass}
            />
          </label>

          {/* A few sharpening questions — better answers, better refresher. */}
          <div className="rounded-xl border border-line p-4 flex flex-col gap-3">
            <span className="text-[13px] font-semibold text-ink">A few questions to sharpen it <span className="font-normal text-muted-2">(optional, but they make the draft much better)</span></span>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-charcoal-2">What slipped recently that you want to tighten up?</span>
              <input value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="e.g. servers stopped doing the second check-back on busy nights" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-charcoal-2">What reaction should guests walk away with?</span>
              <input value={reaction} onChange={(e) => setReaction(e.target.value)} placeholder="e.g. 'they actually remembered me' / 'that was worth telling a friend about'" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-charcoal-2">What does &ldquo;great&rdquo; look like — the standard to hold?</span>
              <input value={standard} onChange={(e) => setStandard(e.target.value)} placeholder="e.g. every table greeted in 30s, one genuine recommendation per visit" className={inputClass} />
            </label>
          </div>

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
