"use client";

import { useState } from "react";
import Link from "next/link";
import { PlayCircle, X, ArrowLeft, ArrowRight, Sparkles, Heart, Footprints, RotateCcw, GraduationCap, BarChart3, Handshake, PlugZap, Rocket, type LucideIcon } from "lucide-react";

type Step = { icon: LucideIcon; title: string; body: string; href?: string; cta?: string };

// An interactive, skippable walkthrough of the system — the "show me" version of
// a tutorial video. Always current because each step points at the live app.
const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to Wingman",
    body: "Wingman turns first-time guests into regulars — through the culture, training, and accountability your team runs every shift. Here's the quick tour.",
  },
  {
    icon: Sparkles,
    title: "Start with the Setup Wizard",
    body: "Answer a few questions about your restaurant and Wingman drafts your culture statement, core values, and starting standards around it — about 3 minutes. You can change anything after.",
    href: "/wizard",
    cta: "Open the wizard",
  },
  {
    icon: Heart,
    title: "Your Culture",
    body: "Your standard, in your own words — the culture statement, core values, and this week's pre-shift focus that every hire is trained to and every shift is measured against.",
    href: "/culture",
    cta: "See Culture",
  },
  {
    icon: Footprints,
    title: "The Guest Journey",
    body: "Map the whole guest experience into moments, each with a standard and a script — and log a first-timer right at the door, straight into Guest Bounce Back.",
    href: "/journey",
    cta: "See the Journey",
  },
  {
    icon: RotateCcw,
    title: "Guest Bounce Back",
    body: "Track each guest across their first four visits, with win-back and 'ready to refer' lists that tell you exactly who to reach out to next.",
    href: "/bounceback",
    cta: "See Bounce Back",
  },
  {
    icon: GraduationCap,
    title: "Training & Accountability",
    body: "Build role-by-role training and standards, then spot-check that the standard is actually happening on the floor. Set up a short monthly Continuing Education refresher so great hospitality stays a habit, not a one-time class.",
    href: "/training",
    cta: "See Training",
  },
  {
    icon: Handshake,
    title: "Partners & Community",
    body: "Turn the businesses around you — offices, gyms, schools, non-profits — into steady catering, events, and fundraisers. Log every contact and touch, and Wingman flags a partner going cold before you lose them. (Owners & managers.)",
    href: "/partners",
    cta: "See Partners",
  },
  {
    icon: BarChart3,
    title: "Reporting",
    body: "Watch repeat rate, retention, and your money-layer trends over time — plus a 15-second AI briefing on what moved and the one thing to fix this week.",
    href: "/reporting",
    cta: "See Reporting",
  },
  {
    icon: PlugZap,
    title: "Connect your POS (optional)",
    body: "On Square or Clover? Connect it in one click under Settings → API access and your guests and weekly sales flow in automatically — no typing, per location. Totally optional; you can do it anytime.",
    href: "/settings?tab=api",
    cta: "Connect a POS",
  },
  {
    icon: Rocket,
    title: "That's the tour!",
    body: "Work through the checklist below in any order — each step takes about a minute. When you're ready, the Setup Wizard is the best place to begin.",
    href: "/wizard",
    cta: "Start the wizard",
  },
];

export function GetStartedTour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const Icon = step.icon;
  const last = i === STEPS.length - 1;

  function close() {
    setOpen(false);
    setI(0);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setI(0); setOpen(true); }}
        className="inline-flex items-center gap-2 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors"
      >
        <PlayCircle size={17} /> Take the quick tour
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={close}>
          <div className="bg-white rounded-[20px] w-full max-w-[480px] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4">
              <div className="flex gap-1.5">
                {STEPS.map((_, idx) => (
                  <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-brick" : "w-1.5 bg-line"}`} />
                ))}
              </div>
              <button type="button" onClick={close} className="text-muted-2 hover:text-ink" aria-label="Close tour">
                <X size={18} />
              </button>
            </div>

            <div className="px-7 pt-6 pb-2 text-center">
              <div className="w-14 h-14 rounded-2xl bg-brick-tint text-brick flex items-center justify-center mx-auto mb-4">
                <Icon size={26} />
              </div>
              <h3 className="text-[20px] font-bold tracking-[-0.01em] text-ink">{step.title}</h3>
              <p className="text-[14.5px] text-muted leading-[1.55] mt-2.5 max-w-[380px] mx-auto">{step.body}</p>
              {step.href && step.cta && (
                <Link href={step.href} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brick mt-4 hover:opacity-80">
                  {step.cta} <ArrowRight size={14} />
                </Link>
              )}
            </div>

            <div className="flex items-center justify-between px-5 py-4 mt-3 border-t border-[#F5F5F5]">
              <button
                type="button"
                onClick={() => setI((v) => Math.max(0, v - 1))}
                disabled={i === 0}
                className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-charcoal-2 disabled:opacity-0 hover:text-brick"
              >
                <ArrowLeft size={15} /> Back
              </button>
              <span className="text-[12px] text-muted-2">{i + 1} of {STEPS.length}</span>
              {last ? (
                <button type="button" onClick={close} className="text-[13.5px] font-semibold text-white bg-brick rounded-full px-5 py-2 hover:bg-brick-dark transition-colors">
                  Done
                </button>
              ) : (
                <button type="button" onClick={() => setI((v) => Math.min(STEPS.length - 1, v + 1))} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-white bg-brick rounded-full px-5 py-2 hover:bg-brick-dark transition-colors">
                  Next <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
