"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import type { Location } from "@/lib/data/locations";
import type { Lang } from "@/lib/i18n";
import { LanguageToggle } from "./language-toggle";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLocation = searchParams.get("location") ?? "all";
  // Show a real switcher only when the member can span >1 location; otherwise,
  // in a multi-location org, just label their home location.
  const showSwitcher = canSwitch && locations.length > 1;
  const title = TITLES[pathname] ?? "Wingman";

  function onLocationChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("location");
    else params.set("location", value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="sticky top-0 z-20 min-h-16 py-2 lg:h-16 lg:py-0 bg-white/80 backdrop-blur-xl backdrop-saturate-[1.8] border-b border-line flex flex-wrap lg:flex-nowrap items-center justify-between px-4 lg:px-8 gap-x-2 gap-y-1">
      <div className="flex items-center gap-2 lg:gap-3.5 min-w-0">
        <span className="text-lg font-semibold tracking-[-0.01em] text-ink truncate">{title}</span>
        {(showSwitcher || orgIsMultiLocation) && (
          <div className="flex items-center gap-2 px-3 py-[7px] rounded-full border border-line hover:bg-paper transition-colors shrink-0 min-w-0">
            <MapPin size={13} className="text-muted-2" />
            {showSwitcher ? (
              <select
                value={currentLocation}
                onChange={(e) => onLocationChange(e.target.value)}
                className="text-[13px] font-semibold bg-transparent outline-none pr-1 text-charcoal-2"
              >
                <option value="all">All locations</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[13px] font-semibold text-charcoal-2">{userLocationName}</span>
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
