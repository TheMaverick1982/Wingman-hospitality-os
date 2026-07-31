"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { APP_STORE_URL, PLAY_STORE_URL, APPS_LIVE } from "@/lib/app-links";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  // iPadOS 13+ reports as Mac; disambiguate with touch points.
  const isIpad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iphone|ipod|ipad/i.test(ua) || isIpad) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari legacy flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3.5 items-start">
      <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-brick-tint text-brick text-sm font-semibold flex items-center justify-center">
        {n}
      </span>
      <span className="text-base leading-[1.5] text-charcoal-2">{children}</span>
    </li>
  );
}

const IOS_STEPS = [
  <>Open <strong>joinwingman.app</strong> in <strong>Safari</strong> (this page).</>,
  <>Tap the <strong>Share</strong> button — the square with an up arrow, at the bottom (or top) of Safari.</>,
  <>Scroll down and tap <strong>Add to Home Screen</strong>.</>,
  <>Tap <strong>Add</strong>. Wingman lands on your home screen with its own icon.</>,
];

const ANDROID_STEPS = [
  <>Open <strong>joinwingman.app</strong> in <strong>Chrome</strong> (this page).</>,
  <>Tap the <strong>⋮</strong> menu (top-right).</>,
  <>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</>,
  <>Confirm. Wingman lands on your home screen with its own icon.</>,
];

export function DownloadClient() {
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Read client-only APIs (navigator, matchMedia) after mount so the first
    // client render matches the server render and we avoid a hydration mismatch.
    // This is the intended "mounted gate" pattern, so the set-state-in-effect
    // rule doesn't apply here.
    /* eslint-disable react-hooks/set-state-in-effect */
    // Opened as an installed app (home-screen icon / PWA)? Don't show install
    // instructions — send them into the product. /login forwards signed-in users
    // straight to their dashboard. This is what makes the installed icon open to
    // login instead of dead-ending here: iOS starts an added-to-home-screen app
    // on the page it was added from (this one), and this also covers Android.
    if (isStandalone()) {
      setInstalled(true);
      setMounted(true);
      window.location.replace("/login");
      return;
    }
    setPlatform(detectPlatform());
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const steps = platform === "android" ? ANDROID_STEPS : IOS_STEPS;
  const stepsLabel =
    platform === "android" ? "Add to your home screen (Android)" : "Add to your home screen (iPhone / iPad)";

  return (
    <div className="w-full max-w-[560px] mx-auto flex flex-col items-center text-center">
      <div className="w-[84px] h-[84px] rounded-[20px] overflow-hidden shadow-sm ring-1 ring-line mb-6">
        <Image src="/icons/icon-512.png" alt="Wingman app icon" width={84} height={84} priority />
      </div>
      <h1 className="font-display text-4xl sm:text-5xl leading-[1.05] tracking-[-0.03em] font-bold text-ink mb-3">
        Get Wingman on your phone
      </h1>
      <p className="text-lg leading-[1.55] text-muted-2 mb-10">
        Your whole hospitality system — culture, training, checklists, and guest bounce-back — right
        in your pocket, every shift.
      </p>

      {/* Avoid a hydration flash: render nothing platform-specific until mounted. */}
      {!mounted ? (
        <div className="h-40" />
      ) : installed ? (
        <div className="w-full rounded-2xl border border-line bg-panel p-8">
          <p className="text-lg font-semibold text-ink mb-1">Opening Wingman…</p>
          <p className="text-base text-muted-2">Taking you to sign in.</p>
        </div>
      ) : APPS_LIVE ? (
        <div className="w-full flex flex-col sm:flex-row gap-3 justify-center">
          {APP_STORE_URL && (
            <a
              href={APP_STORE_URL}
              className="flex-1 rounded-xl bg-ink text-white font-semibold py-4 px-6 hover:opacity-90 transition"
            >
              Download on the App Store
            </a>
          )}
          {PLAY_STORE_URL && (
            <a
              href={PLAY_STORE_URL}
              className="flex-1 rounded-xl bg-ink text-white font-semibold py-4 px-6 hover:opacity-90 transition"
            >
              Get it on Google Play
            </a>
          )}
        </div>
      ) : (
        <div className="w-full flex flex-col gap-6">
          {platform === "desktop" ? (
            <div className="w-full rounded-2xl border border-line bg-panel p-8 text-left">
              <p className="text-lg font-semibold text-ink mb-2">Open this page on your phone</p>
              <p className="text-base leading-[1.55] text-charcoal-2">
                You&apos;re on a computer. To install Wingman, open{" "}
                <strong>joinwingman.app/download</strong> in your phone&apos;s browser, then follow the
                two-tap steps to add it to your home screen. It works exactly like an app.
              </p>
            </div>
          ) : (
            <div className="w-full rounded-2xl border border-line bg-panel p-8 text-left">
              <p className="text-sm font-semibold uppercase tracking-[0.06em] text-muted-2 mb-5">
                {stepsLabel}
              </p>
              <ol className="flex flex-col gap-4">
                {steps.map((s, i) => (
                  <Step key={i} n={i + 1}>
                    {s}
                  </Step>
                ))}
              </ol>
            </div>
          )}

          <div className="inline-flex items-center justify-center gap-2 text-sm text-muted-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            Native App Store &amp; Google Play versions are coming soon.
          </div>
        </div>
      )}
    </div>
  );
}
