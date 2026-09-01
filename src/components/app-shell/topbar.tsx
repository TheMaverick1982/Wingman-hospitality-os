"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { MapPin } from "lucide-react";
import type { Location } from "@/lib/data/locations";
import type { Lang } from "@/lib/i18n";
import { LanguageToggle } from "./language-toggle";
import { useLocationParam, useSetLocationParam } from "./use-location-param";
import { logout } from "@/app/login/actions";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/culture": "Culture",
  "/bounceback": "Guest Bounce Back",
  "/recovery": "Service Recovery",
  "/training": "Training & Standards",
  "/accountability": "Accountability",
  "/hiring": "Hiring",
  "/growth": "Revenue Growth Planner",
  "/reporting": "Reporting",
  "/settings": "Settings",
  "/wizard": "Setup Wizard",
};

export function Topbar({
  locations,
  canSwitch,
  orgIsMultiLocation,
  userLocationName,
  language,
}: {
  locations: Location[];
  canSwitch: boolean;
  orgIsMultiLocation: boolean;
  userLocationName: string | null;
  language: Lang;
}) {
  const pathname = usePathname();
  const currentLocation = useLocationParam();
  const setLocation = useSetLocationParam();

  // Last-known-good cache for the switcher's data. This top bar lives in the
  // always-mounted app shell, and its location list is server-rendered. If any
  // render ever hands us an EMPTY list — a transient RLS/cookie hiccup on an RSC
  // refetch, a mid-navigation blip — we fall back to the last non-empty list we
  // saw instead of hiding the switcher. This is the durable cure for the
  // recurring "location dropdown disappears" report: once shown, it stays shown
  // for the whole session, whatever the server momentarily returns. Uses React's
  // supported "store info from previous renders" pattern (a guarded setState in
  // render, never in an effect), so it can't loop and needs no ref.
  const [lastGood, setLastGood] = useState({ locations, canSwitch, orgIsMultiLocation, userLocationName });
  if (locations.length > 0 && locations !== lastGood.locations) {
    setLastGood({ locations, canSwitch, orgIsMultiLocation, userLocationName });
  }

  const haveList = locations.length > 0;
  const locs = haveList ? locations : lastGood.locations;
  const canSw = haveList ? canSwitch : canSwitch || lastGood.canSwitch;
  const multi = haveList ? orgIsMultiLocation : orgIsMultiLocation || lastGood.orgIsMultiLocation;
  const locName = userLocationName ?? lastGood.userLocationName;

  // Show a real switcher only when the member can span >1 location; otherwise,
  // in a multi-location org, just label their home location.
  const showSwitcher = canSw && locs.length > 1;
  const title = TITLES[pathname] ?? "Wingman";

  return (
    <div className="sticky top-0 z-20 min-h-16 py-2 lg:h-16 lg:py-0 bg-white/80 backdrop-blur-xl backdrop-saturate-[1.8] border-b border-line flex flex-wrap lg:flex-nowrap items-center justify-between px-5 lg:px-8 gap-x-2 gap-y-1">
      <div className="flex items-center gap-2 lg:gap-3.5 min-w-0">
        <span className="text-lg font-semibold tracking-[-0.01em] text-ink truncate">{title}</span>
        {(showSwitcher || multi) && (
          <div className="flex items-center gap-2 px-3 py-[7px] rounded-full border border-line hover:bg-paper transition-colors shrink-0 min-w-0">
            <MapPin size={13} className="text-muted-2" />
            {showSwitcher ? (
              <select
                value={currentLocation}
                onChange={(e) => setLocation(e.target.value)}
                className="text-[13px] font-semibold bg-transparent outline-none pr-1 text-charcoal-2"
              >
                <option value="all">All locations</option>
                {locs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[13px] font-semibold text-charcoal-2">{locName}</span>
            )}
            {showSwitcher && <span className="text-muted-2 text-xs">⌄</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <LanguageToggle current={language} />
        <form action={logout}>
          <button className="text-[13px] font-semibold text-muted hover:text-ink transition-colors">Sign out</button>
        </form>
      </div>
    </div>
  );
}
