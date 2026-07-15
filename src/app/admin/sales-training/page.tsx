import type { Metadata } from "next";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { getPlatformPricing, dollars } from "@/lib/pricing";
import { listDemoTargets } from "@/lib/sales-reps";
import { DemoLauncher } from "./demo-launcher";
import {
  PRODUCT_ONE_LINER,
  WHY_IT_MATTERS,
  PRODUCT_TOUR,
  GOLDEN_RULES,
  RAPPORT,
  VOSS_TACTICS,
  PREP,
  MOVEMENTS,
  PIPELINE_PROCESS,
  QUESTION_BANK,
  REFRAMES,
  NEVER_DO,
  CLOSE_CHECKLIST,
  SYSTEM_REFERENCE,
  FRANCHISE_PLAYBOOK,
  COMP_PLAN,
  COMP_RULES,
  AFFILIATE_CONTEXT,
} from "@/lib/sales-playbook";

export const metadata: Metadata = { title: "Sales Training · Admin" };
// The "Run a live demo" action provisions a fresh private sandbox — give it room.
export const maxDuration = 60;

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-brick mb-1.5">{eyebrow}</div>
      <h2 className="text-[22px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
      {sub && <p className="text-sm text-muted mt-1 max-w-2xl">{sub}</p>}
    </div>
  );
}

export default async function SalesTrainingPage() {
  const profile = await requirePlatformSection("sales_training");

  const pricing = await getPlatformPricing();
  const priceSub = (s: string) => s.replaceAll("{{firstPrice}}", dollars(pricing.firstCents)).replaceAll("{{addlPrice}}", dollars(pricing.addlCents));

  const demoTargets = await listDemoTargets(profile.userId);

  return (
    <div className="flex flex-col gap-10 pb-10">
      {/* Hero */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink">Sales Training</h1>
          <p className="text-base text-muted mt-1 max-w-2xl">
            How we run a demo — and what you&rsquo;re selling. Learn the product first, then use the demo playbook to guide
            real conversations with operators.
          </p>
        </div>
        <div className="shrink-0">
          <DemoLauncher targets={demoTargets} />
        </div>
      </div>

      {/* The one rule banner */}
      <div className="bg-[#0A0A0A] rounded-[20px] p-8 text-white">
        <div className="text-xs font-semibold tracking-[0.08em] uppercase text-[#4D97FF] mb-3">Read this first</div>
        <p className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.01em] leading-[1.35] max-w-[760px]">
          You&rsquo;re a guide, not a closer. Everything here is a loose script — a guardrail, never something to read
          word-for-word. Ask where it hurts, show only what solves it, and if it&rsquo;s not a fit, say so.
        </p>
      </div>

      {/* New reps: jump to the product primer at the bottom. Daily users live
          in the working sections below; the full "what you're selling" primer
          moved to the end. */}
      <a
        href="#learn-the-product"
        className="group flex items-center justify-between gap-4 bg-brick-tint/40 border border-brick/20 rounded-2xl px-6 py-4 hover:bg-brick-tint/70 transition-colors"
      >
        <div className="min-w-0">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-brick mb-0.5">New here?</div>
          <div className="text-[15px] font-semibold text-ink">Start by learning the product</div>
          <div className="text-[13px] text-muted mt-0.5">
            The one-liner, why it matters, and what every part does. Read the primer at the bottom first — then the
            sections below are where your day-to-day lives.
          </div>
        </div>
        <span className="text-brick text-sm font-semibold shrink-0 group-hover:translate-y-0.5 transition-transform">Jump to primer ↓</span>
      </a>

      {/* Certification CTA */}
      <a
        href="/admin/sales-training/certification"
        className="group flex items-center justify-between gap-4 bg-ink text-white rounded-2xl px-6 py-4 hover:opacity-95 transition-opacity"
      >
        <div className="min-w-0">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#4D97FF] mb-0.5">Prove it</div>
          <div className="text-[15px] font-semibold">Take the certification test</div>
          <div className="text-[13px] text-white/70 mt-0.5">
            An AI-generated quiz + live roleplay drawn from everything below. Updates itself whenever this training changes.
          </div>
        </div>
        <span className="text-[#4D97FF] text-sm font-semibold shrink-0 group-hover:translate-x-0.5 transition-transform">Start →</span>
      </a>

      {/* Golden rules */}
      <section className="flex flex-col gap-4">
        <SectionHeading eyebrow="The mindset" title="Five rules for every demo" />
        <div className="grid grid-cols-1 gap-3">
          {GOLDEN_RULES.map((r, i) => (
            <div key={i} className="flex gap-4 bg-white border border-line rounded-2xl p-5">
              <span className="shrink-0 w-8 h-8 rounded-full bg-brick text-white flex items-center justify-center text-[14px] font-bold">
                {i + 1}
              </span>
              <p className="text-[14.5px] text-charcoal-2 leading-[1.5] self-center">{r}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rapport first */}
      <section className="flex flex-col gap-4">
        <SectionHeading eyebrow="Before you sell anything" title="Build rapport first" sub="The demo only works if it feels like two restaurant people talking. Earn the conversation before you earn the sale." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RAPPORT.map((r, i) => (
            <div key={i} className="flex gap-3 bg-white border border-line rounded-2xl p-5">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-brick shrink-0" />
              <p className="text-[14px] text-charcoal-2 leading-[1.5]">{r}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Conversation tactics (Chris Voss) */}
      <section className="flex flex-col gap-4">
        <SectionHeading eyebrow="Tactical empathy" title="Conversation techniques (from Chris Voss)" sub="Adapted from the negotiation method in “Never Split the Difference.” The goal is a genuine, trust-first conversation where the operator feels understood — never manipulation." />
        <div className="flex flex-col gap-3">
          {VOSS_TACTICS.map((t) => (
            <div key={t.name} className="bg-white border border-line rounded-2xl p-5">
              <div className="text-[15px] font-semibold text-ink">{t.name}</div>
              <p className="text-[13.5px] text-charcoal-2 mt-1 leading-[1.5]">{t.what}</p>
              <div className="mt-2.5 text-[13.5px] text-ink italic border-l-2 border-brick/30 pl-3 leading-[1.5]">{t.example}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Prep */}
      <section className="flex flex-col gap-4">
        <SectionHeading eyebrow="Before the call" title="Two minutes of prep" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PREP.map((p) => (
            <div key={p.label} className="bg-white border border-line rounded-2xl p-5">
              <div className="text-[15px] font-semibold text-ink">{p.label}</div>
              <div className="text-[13.5px] text-muted mt-1.5 leading-[1.5]">{priceSub(p.detail)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* The demo flow */}
      <section className="flex flex-col gap-4">
        <SectionHeading eyebrow="The demo, step by step" title="Five movements" sub="A rough shape for a ~30-minute demo. Adapt freely — the order matters more than the timing." />
        <div className="flex flex-col gap-4">
          {MOVEMENTS.map((m) => (
            <div key={m.n} className="bg-white border border-line rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <span className="shrink-0 w-9 h-9 rounded-full bg-brick-tint text-brick flex items-center justify-center text-[15px] font-bold">
                  {m.n}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-[18px] font-semibold text-ink">{m.title}</h3>
                    <span className="text-[12px] font-semibold text-charcoal-2 bg-paper rounded-full px-2.5 py-0.5">{m.minutes}</span>
                  </div>
                  <p className="text-[14px] text-muted mt-1.5 leading-[1.5]">{m.intent}</p>

                  <div className="mt-4 bg-paper rounded-xl p-4">
                    <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-2 mb-2">Loose script — say it your way</div>
                    <div className="flex flex-col gap-2.5">
                      {m.script.map((line, i) => (
                        <p key={i} className="text-[14px] text-ink italic leading-[1.5]">{line}</p>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-olive mb-1.5">Do this</div>
                      <ul className="flex flex-col gap-1.5">
                        {m.doThis.map((d, i) => (
                          <li key={i} className="text-[13.5px] text-charcoal-2 flex gap-2 leading-[1.45]">
                            <span className="text-olive font-bold shrink-0">✓</span><span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-brick mb-1.5">Don&rsquo;t</div>
                      <ul className="flex flex-col gap-1.5">
                        {m.dont.map((d, i) => (
                          <li key={i} className="text-[13.5px] text-muted flex gap-2 leading-[1.45]">
                            <span className="text-brick font-bold shrink-0">✕</span><span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* After the call — pipeline hygiene */}
      <section className="flex flex-col gap-4">
        <SectionHeading eyebrow="After the call" title="Keep the pipeline honest" sub="Some of this is automatic; the rest is on you. A pipeline you can trust is the whole point." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PIPELINE_PROCESS.map((p) => (
            <div key={p.title} className="bg-white border border-line rounded-2xl p-5">
              <div className="text-[15px] font-semibold text-ink">{p.title}</div>
              <div className="text-[13.5px] text-muted mt-1.5 leading-[1.5]">{p.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Question bank */}
      <section className="flex flex-col gap-4">
        <SectionHeading eyebrow="Discovery" title="Question bank" sub="Keep these in your back pocket. Ask, then listen — the goal is to hear their problem in their words." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUESTION_BANK.map((g) => (
            <div key={g.theme} className="bg-white border border-line rounded-2xl p-5">
              <div className="text-[14px] font-semibold text-ink mb-2.5">{g.theme}</div>
              <ul className="flex flex-col gap-2">
                {g.questions.map((q, i) => (
                  <li key={i} className="text-[13.5px] text-charcoal-2 flex gap-2 leading-[1.45]">
                    <span className="text-muted-2 shrink-0">→</span><span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Reframes */}
      <section className="flex flex-col gap-4">
        <SectionHeading eyebrow="When they hesitate" title="Reframes, not rebuttals" sub="Never argue. Acknowledge the concern, then help them see it a different way." />
        <div className="flex flex-col gap-3">
          {REFRAMES.map((r, i) => (
            <div key={i} className="bg-white border border-line rounded-2xl p-5">
              <div className="text-[14.5px] font-semibold text-ink">{r.objection}</div>
              <div className="text-[13.5px] text-charcoal-2 mt-1.5 leading-[1.5] border-l-2 border-brick/30 pl-3">{r.reframe}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Never do + close checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border border-line rounded-2xl p-6">
          <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-brick mb-3">The salesy tells</div>
          <h2 className="text-[18px] font-bold text-ink mb-4">Never do this</h2>
          <ul className="flex flex-col gap-2.5">
            {NEVER_DO.map((n, i) => (
              <li key={i} className="text-[13.5px] text-charcoal-2 flex gap-2.5 leading-[1.45]">
                <span className="text-brick font-bold shrink-0">✕</span><span>{n}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-olive-tint/60 border border-olive/20 rounded-2xl p-6">
          <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-olive mb-3">Before you hang up</div>
          <h2 className="text-[18px] font-bold text-ink mb-4">A good demo checklist</h2>
          <ul className="flex flex-col gap-3">
            {CLOSE_CHECKLIST.map((c, i) => (
              <li key={i} className="text-[14px] text-charcoal-2 flex gap-2.5 leading-[1.45]">
                <span className="mt-0.5 inline-block w-4 h-4 border-2 border-olive/50 rounded-[4px] shrink-0" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Product primer — the "learn the product" reference, anchored so the
          top "Start here" link jumps here. Lives at the bottom so daily users
          hit their working sections first. */}
      <section id="learn-the-product" className="flex flex-col gap-5 scroll-mt-6">
        <SectionHeading eyebrow="Start here — know the product" title="What you're selling" sub="Before you demo anything, you should be able to explain Wingman in a sentence and know why an operator should care." />
        <div className="bg-brick-tint/40 border border-brick/20 rounded-2xl p-6">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-brick mb-1.5">In one line</div>
          <p className="text-[18px] font-semibold text-ink leading-[1.4]">{PRODUCT_ONE_LINER}</p>
        </div>

        <div className="bg-white border border-line rounded-2xl p-6">
          <div className="text-[15px] font-semibold text-ink mb-3">Why it matters</div>
          <ul className="flex flex-col gap-2.5">
            {WHY_IT_MATTERS.map((w, i) => (
              <li key={i} className="flex gap-3 text-[14px] text-charcoal-2 leading-[1.5]">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-brick shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-[15px] font-semibold text-ink mb-3">What each part does (and the problem it solves)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRODUCT_TOUR.map((a) => (
              <div key={a.name} className="bg-white border border-line rounded-2xl p-5">
                <div className="text-[15px] font-semibold text-ink">{a.name}</div>
                <div className="text-[13.5px] text-charcoal-2 mt-1.5">{a.what}</div>
                <div className="text-[13px] text-muted mt-2 border-t border-[#F5F5F5] pt-2">
                  <span className="font-semibold text-brick">Solves: </span>{a.problem}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Franchise plan — every function + option */}
      <section className="flex flex-col gap-4">
        <SectionHeading eyebrow="Selling the franchise plan" title="Franchise: functions & options" sub="The full picture for demoing the tier to a franchisor or multi-unit brand — how it's set up, what they see, how content and billing work, and the talk track." />
        <div className="bg-white border border-line rounded-2xl p-6">
          <p className="text-[14px] text-charcoal-2 leading-[1.55]">{FRANCHISE_PLAYBOOK.summary}</p>
          <p className="text-[13px] text-muted mt-2"><span className="font-semibold text-brick">Who it's for: </span>{FRANCHISE_PLAYBOOK.whoFor}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            {FRANCHISE_PLAYBOOK.topics.map((t) => (
              <div key={t.heading}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brick mb-2">{t.heading}</div>
                <div className="flex flex-col gap-2.5">
                  {t.items.map((it) => (
                    <div key={it.title} className="border border-line rounded-xl p-3.5">
                      <div className="text-[14px] font-semibold text-ink">{it.title}</div>
                      <div className="text-[13px] text-charcoal-2 mt-1 leading-[1.5]">{it.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-[#F5F5F5] pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brick mb-2">Talk track</div>
            <ol className="list-decimal pl-5 flex flex-col gap-1.5">
              {FRANCHISE_PLAYBOOK.talkTrack.map((line, i) => (
                <li key={i} className="text-[13.5px] text-charcoal-2 leading-[1.5]">{line}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Know the system — feature reference for questions */}
      <section className="flex flex-col gap-4">
        <SectionHeading eyebrow="Know the system" title="Feature reference — for questions" sub="Not selling points — system details you should be able to answer when a prospect asks “does it do X?”. We add operational features here as they ship." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SYSTEM_REFERENCE.map((s) => (
            <div key={s.name} className="bg-white border border-line rounded-2xl p-5">
              <div className="text-[15px] font-semibold text-ink">{s.name}</div>
              <div className="text-[13.5px] text-charcoal-2 mt-1.5 leading-[1.5]">{s.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How you're paid */}
      <section className="flex flex-col gap-4">
        <SectionHeading eyebrow="Your compensation" title="How you're paid" sub="Straightforward and aligned with keeping accounts, not just signing them." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {COMP_PLAN.map((c) => (
            <div key={c.name} className="bg-white border border-line rounded-2xl p-5 flex flex-col">
              <div className="text-[14px] font-semibold text-ink">{c.name}</div>
              <div className="text-[20px] font-bold text-brick tracking-[-0.01em] mt-1">{c.amount}</div>
              <div className="text-[13px] text-muted mt-2 leading-[1.5]">{c.detail}</div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-line rounded-2xl p-6">
          <div className="text-[14px] font-semibold text-ink mb-3">The rules, plainly</div>
          <ul className="flex flex-col gap-2.5">
            {COMP_RULES.map((r, i) => (
              <li key={i} className="flex gap-3 text-[13.5px] text-charcoal-2 leading-[1.5]">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-brick shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-brick-tint/40 border border-brick/20 rounded-2xl p-5">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-brick mb-1.5">Affiliates &amp; your deals</div>
          <p className="text-[13.5px] text-charcoal-2 leading-[1.5]">{AFFILIATE_CONTEXT}</p>
        </div>
      </section>
    </div>
  );
}
