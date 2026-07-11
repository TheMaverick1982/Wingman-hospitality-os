"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

// A dependency-free spotlight tour shown ONCE on a demo sandbox's first landing
// on /dashboard. Gated to sandboxes only (rendered from the app layout when
// profile.isDemoSandbox), so the shared wingmandemo sales-call login never sees
// it. Each step dims the screen, highlights a real element, and explains it; the
// last step is a "Create your account" call to action.

const SEEN_KEY = "wingman_demo_tour_v1";

type Step = { selector?: string; title: string; body: string };

const STEPS: Step[] = [
  {
    selector: '[data-tour="kpis"]',
    title: "Your retention scoreboard",
    body: "Repeat rate, sign-offs, culture moments — the numbers that show guests actually coming back. All live.",
  },
  {
    selector: '[data-tour="retention"]',
    title: "Every first visit → a second",
    body: "See exactly how many guests return for visits 2, 3, and 4. Turning that curve is the whole job.",
  },
  {
    selector: '[data-tour="nav"]',
    title: "Your operating system",
    body: "Culture, training, hiring, growth, audits — the standard your team runs on every shift lives here.",
  },
  {
    selector: '[data-tour="assistant"]',
    title: "Meet your AI Wingman",
    body: "Ask it anything, or have it draft your culture, training, and hiring in seconds.",
  },
  {
    title: "Make it yours",
    body: "This is a real, editable demo — change anything you like. When you're ready, spin up your own workspace in a minute.",
  },
];

const CARD_W = 330;
const CARD_H = 210;
const GAP = 14;

function isVisible(el: Element | null): el is HTMLElement {
  return !!el && (el as HTMLElement).getClientRects().length > 0;
}

export function DemoTour({ email }: { email?: string | null }) {
  const pathname = usePathname();
  const [steps, setSteps] = useState<Step[]>([]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const startedRef = useRef(false);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setSteps([]);
  }, []);

  // Start once, on the first dashboard view, if not already seen.
  useEffect(() => {
    if (startedRef.current || pathname !== "/dashboard") return;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (seen) return;
    const t = setTimeout(() => {
      // Resolve which steps have a visible target (skip e.g. the sidebar on mobile).
      const resolved = STEPS.filter((s) => !s.selector || isVisible(document.querySelector(s.selector)));
      if (resolved.length === 0) return;
      startedRef.current = true;
      setSteps(resolved);
      setI(0);
    }, 700);
    return () => clearTimeout(t);
  }, [pathname]);

  // Position the current step's highlight.
  const measure = useCallback(() => {
    const step = steps[i];
    if (!step) return;
    if (!step.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.selector);
    if (!isVisible(el)) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setRect(el.getBoundingClientRect());
  }, [steps, i]);

  useEffect(() => {
    if (steps.length === 0) return;
    const raf = requestAnimationFrame(measure); // defer first measure off the effect body
    const t = setTimeout(measure, 380); // re-measure after smooth scroll settles
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [steps, i, measure, finish]);

  if (steps.length === 0) return null;

  const step = steps[i];
  const isFinalCta = !step.selector;
  const isLast = i === steps.length - 1;

  // Tooltip placement: right of tall targets (the sidebar), otherwise below with
  // an above-fallback; clamped to the viewport.
  let top = 0;
  let left = 0;
  if (typeof window !== "undefined") {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) {
      top = vh / 2 - CARD_H / 2;
      left = vw / 2 - CARD_W / 2;
    } else if (rect.height > vh * 0.5) {
      left = Math.min(rect.right + GAP, vw - CARD_W - 12);
      top = Math.min(Math.max(rect.top + 24, 12), vh - CARD_H - 12);
    } else {
      const belowRoom = vh - rect.bottom;
      top = belowRoom >= CARD_H + GAP ? rect.bottom + GAP : Math.max(rect.top - CARD_H - GAP, 12);
      left = Math.min(Math.max(rect.left, 12), vw - CARD_W - 12);
    }
  }

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Demo walkthrough">
      {rect && !isFinalCta ? (
        <div
          className="pointer-events-none rounded-2xl ring-2 ring-white/85 transition-all duration-200"
          style={{
            position: "fixed",
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(10,10,10,0.55)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-[rgba(10,10,10,0.62)]" />
      )}

      <div
        className="fixed w-[330px] max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl p-5 transition-all duration-200"
        style={{ top, left }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-muted-2">
            {i + 1} of {steps.length}
          </span>
          {!isLast && (
            <button type="button" onClick={finish} className="text-[12px] font-medium text-muted-2 hover:text-ink transition-colors">
              Skip tour
            </button>
          )}
        </div>

        <div className="text-[16px] font-semibold text-ink mb-1.5">{step.title}</div>
        <p className="text-[14px] leading-[1.5] text-muted mb-4">{step.body}</p>

        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {steps.map((_, idx) => (
              <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-4 bg-brick" : "w-1.5 bg-line-strong"}`} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {i > 0 && !isFinalCta && (
              <button
                type="button"
                onClick={() => setI((n) => Math.max(0, n - 1))}
                className="text-[14px] font-semibold text-muted hover:text-ink px-2 py-1.5 transition-colors"
              >
                Back
              </button>
            )}
            {isFinalCta ? (
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={finish} className="text-[14px] font-semibold text-muted hover:text-ink px-2 py-1.5 transition-colors">
                  Keep looking
                </button>
                <Link
                  href={email ? `/signup?email=${encodeURIComponent(email)}` : "/signup"}
                  onClick={finish}
                  className="text-[14px] font-semibold text-white bg-brick rounded-[10px] px-4 py-2 hover:bg-brick-dark transition-colors whitespace-nowrap"
                >
                  Create your account →
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setI((n) => Math.min(steps.length - 1, n + 1))}
                className="text-[14px] font-semibold text-white bg-brick rounded-[10px] px-4 py-2 hover:bg-brick-dark transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
