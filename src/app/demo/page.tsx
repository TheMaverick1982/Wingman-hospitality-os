import Link from "next/link";
import type { Metadata } from "next";
import { WingmanLogo } from "@/components/ui/wingman-logo";
import { LaunchDemoForm } from "@/components/demo/launch-demo-form";

export const metadata: Metadata = {
  title: "Try the live demo — Wingman",
  description: "Explore a fully-loaded Wingman workspace instantly. No signup, no card — a private demo, ready in seconds.",
};

// Provisioning + seeding + lead capture runs in the launch server action; give
// it room beyond the default so a cold Supabase round-trip can't time it out.
export const maxDuration = 60;

const HIGHLIGHTS = [
  "A full example restaurant group — two locations, staff, guests, and menu already loaded",
  "Culture, training, hiring, growth, audits, and business health, all populated",
  "Click into anything and change it — it's your own private copy",
];

export default function DemoPage() {
  return (
    <div className="min-h-full flex flex-col force-light bg-panel" style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)" }}>
      <div className="max-w-[1180px] w-full mx-auto px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <WingmanLogo className="h-6 w-auto" />
        </Link>
        <p className="text-sm text-muted">
          Ready to build your own?{" "}
          <Link href="/signup" className="font-semibold text-brick">
            Get Started
          </Link>
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-10 sm:py-16">
        <div className="w-full max-w-[560px] text-center">
          <span className="inline-flex items-center gap-2 bg-brick-tint text-brick-dark text-[13px] font-semibold px-[14px] py-[6px] rounded-full mb-7">
            <span className="w-[7px] h-[7px] rounded-full bg-brick" />
            Live demo
          </span>
          <h1 className="font-display text-4xl sm:text-[46px] leading-[1.05] tracking-[-0.025em] font-bold text-ink mb-4">
            See Wingman with the lights on.
          </h1>
          <p className="text-[17px] text-muted mb-8 max-w-[460px] mx-auto">
            We&apos;ll spin up a private, fully-loaded workspace just for you — poke around, change
            anything, break whatever you want. It&apos;s yours alone and clears itself later.
          </p>

          <ul className="text-left max-w-[420px] mx-auto mb-9 flex flex-col gap-2.5">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-2.5 text-[15px] text-ink">
                <span className="mt-[7px] w-[6px] h-[6px] rounded-full bg-brick shrink-0" />
                {h}
              </li>
            ))}
          </ul>

          <LaunchDemoForm />
        </div>
      </div>
    </div>
  );
}
