"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile-config";

type TurnstileAPI = {
  render: (el: HTMLElement, opts: { sitekey: string; theme?: "light" | "dark" | "auto" }) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileAPI;
  }
}

// Cloudflare Turnstile CAPTCHA. Renders explicitly once the script loads and
// injects a hidden `cf-turnstile-response` input into the enclosing <form>,
// which the server action verifies with verifyTurnstile(). Invisible for most
// real users in "Managed" mode.
export function TurnstileWidget() {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !ref.current || !window.turnstile || idRef.current) return;
    const api = window.turnstile;
    idRef.current = api.render(ref.current, { sitekey: TURNSTILE_SITE_KEY, theme: "light" });
    const id = idRef.current;
    return () => {
      if (id) api.remove(id);
      idRef.current = null;
    };
  }, [ready]);

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
