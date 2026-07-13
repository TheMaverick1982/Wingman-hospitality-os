import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, PartyPopper, Plug } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getOnboardingStatus } from "@/lib/onboarding";

export default async function StartHerePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (profile.accessRole !== "super_admin") redirect("/dashboard");

  const { steps, allDone, doneCount } = await getOnboardingStatus();

  return (
    <div className="max-w-[760px] mx-auto w-full">
      <div className="mb-2">
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Start here</h1>
        <p className="text-base text-muted">
          A few steps to get {profile.orgName} fully set up. Do them in any order — each one only takes a minute.
        </p>
      </div>

      {allDone ? (
        <div className="bg-olive-tint rounded-2xl p-8 flex items-center gap-4 mt-6">
          <PartyPopper size={28} className="text-[#15803d] shrink-0" />
          <div>
            <p className="text-base font-semibold text-[#15803d]">You&apos;re all set up.</p>
            <p className="text-sm text-[#15803d] mt-0.5">
              Every step is complete — this page will stop showing in the sidebar. You can still come back here anytime.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 mt-6 mb-2">
          <div className="h-2 flex-1 rounded-full bg-line overflow-hidden">
            <div className="h-full rounded-full bg-brick" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <span className="text-sm font-semibold text-muted whitespace-nowrap">
            {doneCount} of {steps.length} done
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 mt-6">
        {steps.map((step) => (
          <Link
            key={step.key}
            href={step.href}
            className={`flex items-center gap-4 bg-white border rounded-2xl p-5 shadow-sm transition-colors group ${
              step.done ? "border-line" : "border-line hover:border-brick"
            }`}
          >
            {step.done ? (
              <CheckCircle2 size={22} className="text-[#15803d] shrink-0" />
            ) : (
              <Circle size={22} className="text-muted-2 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className={`text-[15px] font-semibold ${step.done ? "text-muted line-through" : "text-ink"}`}>{step.label}</div>
              <p className="text-[13px] text-muted mt-0.5">{step.description}</p>
            </div>
            {!step.done && (
              <ArrowRight size={16} className="text-muted-2 shrink-0 group-hover:text-brick transition-colors" />
            )}
          </Link>
        ))}
      </div>

      {/* Optional / advanced — never blocks the core setup. */}
      <div className="mt-8">
        <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-2 mb-2">Optional · Advanced</div>
        <Link
          href="/help/api-and-integrations"
          className="flex items-center gap-4 bg-white border border-dashed border-line rounded-2xl p-5 hover:border-brick transition-colors group"
        >
          <Plug size={20} className="text-muted-2 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-ink">
              Connect your POS <span className="text-[12px] font-medium text-muted-2">— optional</span>
            </div>
            <p className="text-[13px] text-muted mt-0.5">
              Have your weekly numbers fill in automatically instead of typing them. Most owners skip this at first — you can hand it to your POS provider or bookkeeper anytime.
            </p>
          </div>
          <ArrowRight size={16} className="text-muted-2 shrink-0 group-hover:text-brick transition-colors" />
        </Link>
      </div>
    </div>
  );
}
