import type { Metadata } from "next";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformPricing, dollars } from "@/lib/pricing";
import { commissionsForRep, formatCents, formatDate, totalsFor, type CommissionStatus } from "@/lib/sales-commissions";
import { listDemoTargets } from "@/lib/sales-reps";
import { ClaimForm } from "./claim-form";
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
  COMP_PLAN,
  COMP_RULES,
  AFFILIATE_CONTEXT,
} from "@/lib/sales-playbook";

export const metadata: Metadata = { title: "Sales Training · Admin" };
// The "Run a live demo" action provisions a fresh private sandbox — give it room.
export const maxDuration = 60;

const STATUS_BADGE: Record<CommissionStatus, { label: string; className: string }> = {
  pending: { label: "Pending approval", className: "text-[#B45309] bg-gold-tint" },
  owed: { label: "Owed", className: "text-[#B45309] bg-gold-tint" },
  paid: { label: "Paid", className: "text-olive bg-olive-tint" },
  denied: { label: "Denied", className: "text-muted bg-paper" },
  void: { label: "Void", className: "text-muted bg-paper" },
};

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

  const admin = createAdminClient();
  const [myCommissions, { data: orgRows }, demoTargets] = await Promise.all([
    commissionsForRep(admin, profile.userId),
    admin.from("organizations").select("id, name").order("name"),
    listDemoTargets(profile.userId),
  ]);
  const orgs = (orgRows ?? []) as { id: string; name: string }[];
  const myTotals = totalsFor(myCommissions);
  const pendingCount = myCommissions.filter((c) => c.status === "pending").length;
  const recent = myCommissions.filter((c) => c.status !== "void").slice(0, 6);
  const hasActivity = myCommissions.some((c) => c.status !== "void");

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

      {/* Your commissions — balance, claim button, and your claim history */}
      <div className="bg-white border border-line rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[15px] font-semibold text-ink">Your commissions</div>
            {pendingCount > 0 && (
              <div className="text-[12.5px] text-[#B45309] mt-0.5">{pendingCount} claim{pendingCount === 1 ? "" : "s"} awaiting the owner&rsquo;s approval</div>
            )}
          </div>
          <div className="flex gap-6">
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#B45309]">Owed to you</div>
              <div className="text-[22px] font-bold text-[#B45309] tabular-nums">{formatCents(myTotals.owedCents)}</div>
            </div>
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-olive">Paid to date</div>
              <div className="text-[22px] font-bold text-olive tabular-nums">{formatCents(myTotals.paidCents)}</div>
            </div>
          </div>
        </div>

        <ClaimForm orgs={orgs} />

        {hasActivity && (
          <div className="border-t border-[#F5F5F5] pt-3 flex flex-col gap-2.5">
            {recent.map((c) => {
              const badge = STATUS_BADGE[c.status];
              const timing =
                c.status === "paid" && c.paid_at
                  ? `Paid ${new Date(c.paid_at).toLocaleDateString()}`
                  : c.status === "owed" || c.status === "pending"
                    ? `Expected ${formatDate(c.payable_on)}`
                    : null;
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 text-[13.5px]">
                  <span className="min-w-0">
                    <span className="text-charcoal-2 block truncate">{c.label}</span>
                    {timing && <span className="text-[12px] text-muted-2">{timing}</span>}
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-ink tabular-nums">{formatCents(c.amount_cents)}</span>
                    <span className={`text-[11.5px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="text-[12px] text-muted-2">
          Only the owner can approve a claim, mark it paid, or change an amount — so these always match what they see. Questions on a line item? Ask them directly.
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

      {/* Product primer */}
      <section className="flex flex-col gap-5">
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
