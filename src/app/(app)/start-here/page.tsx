import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, PartyPopper, Plug, AlertCircle, Rocket, Handshake, CalendarClock } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getLaunchPlan, type LaunchMilestone } from "@/lib/launch-plan";
import { GetStartedTour } from "./get-started-tour";

const STATUS_PILL: Record<string, { label: string; className: string } | null> = {
  done: null,
  due: { label: "Do this now", className: "text-brick-dark bg-brick-tint" },
  overdue: { label: "Overdue", className: "text-[#B45309] bg-gold-tint" },
  upcoming: { label: "Coming up", className: "text-muted bg-paper" },
};

export default async function StartHerePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (profile.accessRole !== "super_admin") redirect("/dashboard");

  const plan = await getLaunchPlan();
  if (!plan) return null;

  const pct = Math.round((plan.doneCount / plan.totalCount) * 100);
  const dayLabel = plan.dayNumber > plan.totalDays ? `Day ${plan.dayNumber}` : `Day ${plan.dayNumber} of ${plan.totalDays}`;

  return (
    <div className="max-w-[780px] mx-auto w-full">
      <div className="mb-2 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.06em] uppercase text-brick mb-1.5">
            <Rocket size={14} /> Your 14-day launch
          </div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Get {profile.orgName} running</h1>
          <p className="text-base text-muted max-w-[540px]">
            Restaurants that win with Wingman are the ones that roll it out fast. Here&rsquo;s your plan — a couple of moves
            every few days. New here? Take the tour first.
          </p>
        </div>
        <GetStartedTour />
      </div>

      {plan.allDone ? (
        <div className="bg-olive-tint rounded-2xl p-8 flex items-center gap-4 mt-6">
          <PartyPopper size={28} className="text-[#15803d] shrink-0" />
          <div>
            <p className="text-base font-semibold text-[#15803d]">You&rsquo;re fully launched. 🎉</p>
            <p className="text-sm text-[#15803d] mt-0.5">
              Every milestone is done — you&rsquo;re not just set up, you&rsquo;re running the plays. This page will stop
              showing in the sidebar. Keep the weekly habits going and the numbers will follow.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Progress + on-track status */}
          <div className="mt-6 bg-white border border-line rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-2.5">
              <span className="text-[13px] font-semibold text-charcoal-2">{dayLabel}</span>
              <span className="text-[13px] font-semibold text-muted">
                {plan.doneCount} of {plan.totalCount} done · {pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-line overflow-hidden">
              <div className="h-full rounded-full bg-brick transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className={`mt-3 text-[13px] font-medium ${plan.onTrack ? "text-[#15803d]" : "text-[#B45309]"}`}>
              {plan.onTrack
                ? "✓ On track — nothing overdue. Keep the momentum."
                : `${plan.overdueCount} milestone${plan.overdueCount === 1 ? "" : "s"} slipped past their target day. Knock these out first.`}
            </div>
          </div>

          {/* Next moves */}
          {plan.nextActions.length > 0 && (
            <div className="mt-5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-2 mb-2">
                Your next {plan.nextActions.length === 1 ? "move" : `${plan.nextActions.length} moves`}
              </div>
              <div className="flex flex-col gap-2.5">
                {plan.nextActions.map((m) => (
                  <MilestoneRow key={m.key} m={m} emphasize />
                ))}
              </div>
            </div>
          )}

          {/* The full dated plan, phase by phase */}
          <div className="mt-8 flex flex-col gap-7">
            {plan.phases.map((phase) => {
              const phaseDone = phase.milestones.every((m) => m.done);
              return (
                <div key={phase.key}>
                  <div className="flex items-baseline gap-3 mb-3">
                    <h2 className={`text-[16px] font-bold ${phaseDone ? "text-muted" : "text-ink"}`}>{phase.title}</h2>
                    <span className="text-[12px] font-semibold text-muted-2">{phase.window}</span>
                    {phaseDone && <CheckCircle2 size={15} className="text-[#15803d]" />}
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {phase.milestones.map((m) => (
                      <MilestoneRow key={m.key} m={m} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Optional / advanced — never blocks the launch. */}
      <div className="mt-10">
        <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-2 mb-2">Explore more · Optional</div>
        <div className="flex flex-col gap-2.5">
          <ExploreCard
            href="/settings?tab=api"
            icon={<Plug size={20} className="text-muted-2 shrink-0" />}
            title="Connect your POS"
            body="On Square or Clover? Connect in one click and your guests and weekly sales sync in automatically, per location — no typing. Most owners add this once they're rolling; do it anytime."
          />
          <ExploreCard
            href="/partners"
            icon={<Handshake size={20} className="text-muted-2 shrink-0" />}
            title="Grow with Partners & Community"
            body="Build the businesses around you into catering, events, and fundraisers — log every contact and touch, and Wingman flags a partner going cold before you lose them."
          />
          <ExploreCard
            href="/training/continuing-education"
            icon={<CalendarClock size={20} className="text-muted-2 shrink-0" />}
            title="Set up monthly Continuing Education"
            body="Build a short refresher once and Wingman re-assigns it to your team on the 1st of every month — so great hospitality stays a habit, not a one-time class."
          />
        </div>
      </div>
    </div>
  );
}

function ExploreCard({ href, icon, title, body }: { href: string; icon: ReactNode; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 bg-white border border-dashed border-line rounded-2xl p-5 hover:border-brick transition-colors group"
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-ink">
          {title} <span className="text-[12px] font-medium text-muted-2">— optional</span>
        </div>
        <p className="text-[13px] text-muted mt-0.5">{body}</p>
      </div>
      <ArrowRight size={16} className="text-muted-2 shrink-0 group-hover:text-brick transition-colors" />
    </Link>
  );
}

function MilestoneRow({ m, emphasize }: { m: LaunchMilestone; emphasize?: boolean }) {
  const pill = STATUS_PILL[m.status];
  const border = m.done
    ? "border-line"
    : m.status === "overdue"
      ? "border-[#F0D9A8]"
      : emphasize || m.status === "due"
        ? "border-brick/40 hover:border-brick"
        : "border-line hover:border-brick";

  return (
    <Link
      href={m.href}
      className={`flex items-center gap-4 bg-white border rounded-2xl p-4 shadow-sm transition-colors group ${border}`}
    >
      {m.done ? (
        <CheckCircle2 size={21} className="text-[#15803d] shrink-0" />
      ) : m.status === "overdue" ? (
        <AlertCircle size={21} className="text-[#B45309] shrink-0" />
      ) : (
        <Circle size={21} className="text-muted-2 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[14.5px] font-semibold ${m.done ? "text-muted line-through" : "text-ink"}`}>{m.label}</span>
          {m.kind === "usage" && !m.done && (
            <span className="text-[10.5px] font-semibold text-olive bg-olive-tint px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Put it to work
            </span>
          )}
        </div>
        <p className="text-[13px] text-muted mt-0.5">{m.description}</p>
      </div>
      {pill && <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${pill.className}`}>{pill.label}</span>}
      {!m.done && <ArrowRight size={15} className="text-muted-2 shrink-0 group-hover:text-brick transition-colors" />}
    </Link>
  );
}
