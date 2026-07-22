"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile-config";

type RenderOptions = {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  appearance?: "always" | "execute" | "interaction-only";
  retry?: "auto" | "never";
  "refresh-expired"?: "auto" | "manual" | "never";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: (code?: string) => void;
  "timeout-callback"?: () => void;
};

type TurnstileAPI = {
  render: (el: HTMLElement, opts: RenderOptions) => string;
  remove: (id: string) => void;
  reset: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileAPI;
  }
}

// Cloudflare Turnstile CAPTCHA, run invisibly. In "interaction-only" appearance
// the widget stays hidden for real users and only surfaces a challenge when
// Cloudflare genuinely needs one, so a normal login never shows a checkbox. It
// injects a hidden `cf-turnstile-response` input into the enclosing <form> that
// the server action verifies with verifyTurnstile().
//
// Tokens expire (~5 min) and the widget can idle out, so we auto-refresh expired
// tokens and clear our copy on expiry/error/timeout — a lingering login page can
// never submit a stale token and be wrongly rejected. `onToken` reports the
// current token (or null) so the form can gate submission when one is required.
//
// Turnstile tokens are single-use: once the server verifies one it's spent, so
// after a failed submit the form must mint a fresh one. Bumping `resetSignal`
// resets the widget to issue a new token (and clears the old one meanwhile).
export function TurnstileWidget({
  onToken,
  resetSignal = 0,
}: {
  onToken?: (token: string | null) => void;
  resetSignal?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  // Keep the latest callback without re-running the render effect (which would
  // tear down and rebuild the widget on every parent re-render).
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!ready || !ref.current || !window.turnstile || idRef.current) return;
    const api = window.turnstile;
    idRef.current = api.render(ref.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "light",
      appearance: "interaction-only",
      retry: "auto",
      "refresh-expired": "auto",
      callback: (token) => onTokenRef.current?.(token),
      "expired-callback": () => onTokenRef.current?.(null),
      "error-callback": () => onTokenRef.current?.(null),
      "timeout-callback": () => onTokenRef.current?.(null),
    });
    const id = idRef.current;
    return () => {
      if (id) api.remove(id);
      idRef.current = null;
      onTokenRef.current?.(null);
    };
  }, [ready]);

  // Mint a fresh token after each attempt (a spent token would fail the next
  // verification). Skips the initial mount, where the render effect above
  // already issues the first token.
  useEffect(() => {
    if (resetSignal === 0 || !idRef.current || !window.turnstile) return;
    onTokenRef.current?.(null);
    window.turnstile.reset(idRef.current);
  }, [resetSignal]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div ref={ref} />
    </>
  );
}
