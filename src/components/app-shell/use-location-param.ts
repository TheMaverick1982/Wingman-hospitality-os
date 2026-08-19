"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Read/set the top-bar's `?location=` selection WITHOUT next/navigation's
// useSearchParams().
//
// Why not useSearchParams(): it opts the component into a Suspense/CSR bailout,
// and the persistent app shell (top-bar switcher + sidebar stat) lives inside a
// Suspense boundary whose fallback is an empty bar. On the Hiring page — which
// pushes `?app=`, `?scoreLoc=`, etc. constantly — those param changes re-trip the
// boundary and the whole switcher vanishes until a hard refresh. This has been
// "fixed" several times by adding Suspense boundaries; the real cure is to not
// use useSearchParams() in the always-mounted shell at all.
//
// Instead we track the value in state: seed it from window.location on mount,
// re-read on pathname changes and browser back/forward, and update it eagerly
// (via a custom event carrying the new value) whenever the switcher writes a new
// location — so the sidebar stat and the switcher stay in sync on same-path
// param changes without ever suspending.
const LOCATION_EVENT = "wm:location";

function readLocationFromUrl(): string {
  if (typeof window === "undefined") return "all";
  return new URLSearchParams(window.location.search).get("location") || "all";
}

export function useLocationParam(): string {
  const pathname = usePathname();
  const [location, setLocation] = useState<string>("all");

  useEffect(() => {
    const sync = () => setLocation(readLocationFromUrl());
    sync();
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setLocation(detail || "all");
    };
    window.addEventListener("popstate", sync);
    window.addEventListener(LOCATION_EVENT, onCustom as EventListener);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(LOCATION_EVENT, onCustom as EventListener);
    };
  }, [pathname]);

  return location;
}

// Navigate to a new `?location=` on the current path and notify every reader on
// the page immediately (before the router transition settles), so the switcher
// and sidebar stat update in lockstep.
export function useSetLocationParam(): (value: string) => void {
  const router = useRouter();
  const pathname = usePathname();

  return (value: string) => {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    if (value === "all") params.delete("location");
    else params.set("location", value);
    window.dispatchEvent(new CustomEvent(LOCATION_EVENT, { detail: value }));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
}
