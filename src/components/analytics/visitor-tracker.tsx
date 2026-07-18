"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Fires a first-party page-view beacon on each public marketing route change.
// Skips the authenticated app so we only track the public site. The visitor id
// lives in an httpOnly cookie the server manages — this component never reads it.
const SKIP_PREFIXES = [
  "/dashboard",
  "/admin",
  "/settings",
  "/onboarding",
  "/auth",
  "/login",
  "/set-password",
  "/api",
  "/wizard",
  "/staff",
  "/training",
  "/reporting",
  "/support",
  "/recovery",
  "/start-here",
  "/print",
  "/founders",
];

export function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;

    const params = new URLSearchParams(window.location.search);
    const body = JSON.stringify({
      path: pathname,
      referrer: document.referrer || "",
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
    });
    // keepalive so the beacon survives the navigation that triggered it.
    fetch("/api/track", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  }, [pathname]);

  return null;
}
