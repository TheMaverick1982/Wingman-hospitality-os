"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

// The Meta (Facebook) Pixel — for the ad campaign, so it runs ONLY on public
// marketing / prospect pages (plus the /demo entry page). It never loads inside
// the authenticated app, where operators manage guest and staff data: on those
// pages the pixel isn't initialized at all, so nothing — not even the page URL —
// is reported to Meta. The demo experience itself runs under the app routes
// (/dashboard, …) once launched, so it's excluded too; only the /demo landing
// page is tracked.
//
// This is an ALLOW-list on purpose: anything not listed is untracked, so a new
// app route can never accidentally start reporting to Meta.
const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "1867814633743997";

const PUBLIC_PREFIXES = [
  "/calculator",
  "/scorecard",
  "/pricing",
  "/book-a-demo",
  "/book",
  "/booking",
  "/demo",
  "/how-it-works",
  "/guarantee",
  "/founders",
  "/contact",
  "/guest-journey",
  "/launch",
  "/api-guide",
  "/download",
  "/affiliates",
  "/privacy",
  "/terms",
  "/login",
  "/signup",
  "/forgot-password",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true; // marketing home
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function FacebookPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPublic = isPublicPath(pathname);
  // The base snippet fires the FIRST PageView when it loads on the first public
  // page. `primed` flips true on that first public render, so the effect only
  // fires PageView on SUBSEQUENT public client-side navigations (Next.js doesn't
  // reload the page, so "landing page views" would otherwise undercount).
  const primed = useRef(false);

  useEffect(() => {
    if (!isPublic) return;
    if (!primed.current) {
      primed.current = true;
      return;
    }
    const w = window as unknown as { fbq?: (...args: unknown[]) => void };
    if (typeof w.fbq === "function") w.fbq("track", "PageView");
  }, [pathname, searchParams, isPublic]);

  // Never initialize the pixel on non-public pages — no init, no beacon, nothing
  // sent to Meta about the authenticated app.
  if (!isPublic) return null;

  return (
    <Script id="fb-pixel" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window,document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${PIXEL_ID}');
        fbq('track', 'PageView');
      `}
    </Script>
  );
}
